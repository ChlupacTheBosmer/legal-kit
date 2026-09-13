/**
 * ARES — Administrativní registr ekonomických subjektů, the Czech Ministry of
 * Finance's register of economic entities. Public REST API, no authentication.
 * https://ares.gov.cz/stranky/vyvojar-info
 *
 * Two datasets are used:
 *   ekonomicke-subjekty     basic identity, merged across source registers
 *   ekonomicke-subjekty-vr  the Commercial Register record, incl. statutory bodies
 */
import { getJSON } from "./http.js";

const BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

const LEGAL_FORMS = {
  "100": "Podnikající fyzická osoba (sole trader)",
  "101": "Fyzická osoba podnikající dle živnostenského zákona",
  "112": "Společnost s ručením omezeným (s.r.o.)",
  "121": "Akciová společnost (a.s.)",
  "205": "Družstvo (cooperative)",
  "301": "Státní podnik",
  "331": "Příspěvková organizace",
  "706": "Spolek (association)",
  "751": "Nadace",
  "801": "Obec",
};

export function normalizeIco(ico) {
  const s = String(ico).replace(/\s/g, "");
  if (!/^\d{1,8}$/.test(s)) throw new Error(`"${ico}" is not a valid IČO (up to 8 digits).`);
  return s.padStart(8, "0");
}

/** IČO checksum (modulo 11), the standard Czech validation rule. */
export function icoChecksumValid(ico) {
  const s = normalizeIco(ico);
  const d = s.split("").map(Number);
  const sum = d.slice(0, 7).reduce((a, v, i) => a + v * (8 - i), 0);
  const rem = sum % 11;
  const check = rem === 0 ? 1 : rem === 1 ? 0 : 11 - rem;
  return check === d[7];
}

const addr = (a) =>
  a
    ? [a.nazevUlice && `${a.nazevUlice} ${a.cisloDomovni || ""}${a.cisloOrientacni ? "/" + a.cisloOrientacni : ""}`,
       a.nazevCastiObce, [a.psc, a.nazevObce].filter(Boolean).join(" "), a.nazevStatu]
        .filter(Boolean).join(", ")
    : null;

export function legalForm(code) {
  return LEGAL_FORMS[String(code)] || `code ${code}`;
}

/** Search entities by name and/or seat. */
export async function search({ name, ico, municipality, limit = 10 }) {
  const body = { start: 0, pocet: Math.min(Number(limit) || 10, 200) };
  if (name) body.obchodniJmeno = String(name);
  if (ico) body.ico = [normalizeIco(ico)];
  if (municipality) body.sidlo = { nazevObce: String(municipality) };
  if (!name && !ico && !municipality) throw new Error("ares_search needs at least one of: name, ico, municipality");

  // getJSON, not request: it checks the HTTP status and the ARES `chyby` error
  // envelope. Parsing the body directly turned a 400 into "no entity matched".
  const data = await getJSON(`${BASE}/ekonomicke-subjekty/vyhledat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cacheable: true,
    ttlMs: 6 * 60 * 60 * 1000,
  });
  return {
    total: data.pocetCelkem ?? 0,
    items: (data.ekonomickeSubjekty || []).map((e) => ({
      ico: e.ico,
      name: e.obchodniJmeno,
      seat: addr(e.sidlo),
      legalForm: legalForm(e.pravniForma),
      established: e.datumVzniku || null,
      dissolved: e.datumZaniku || null,
    })),
  };
}

/** Full identity record for one IČO. */
export async function detail(ico) {
  const id = normalizeIco(ico);
  if (!icoChecksumValid(id)) {
    throw new Error(`IČO ${id} fails the mod-11 checksum, so it is almost certainly a typo rather than an unregistered entity.`);
  }
  const e = await getJSON(`${BASE}/ekonomicke-subjekty/${id}`, { ttlMs: 6 * 60 * 60 * 1000 });
  return {
    ico: e.ico,
    name: e.obchodniJmeno,
    vatId: e.dic || null,
    legalForm: legalForm(e.pravniForma),
    seat: addr(e.sidlo),
    postalAddress: e.adresaDorucovaci
      ? [e.adresaDorucovaci.radekAdresy1, e.adresaDorucovaci.radekAdresy2, e.adresaDorucovaci.radekAdresy3].filter(Boolean).join(", ")
      : null,
    established: e.datumVzniku || null,
    dissolved: e.datumZaniku || null,
    lastUpdated: e.datumAktualizace || null,
    registrations: e.seznamRegistraci || {},
    nace: e.czNace2008 || e.czNace || [],
  };
}

const REGISTRY_COURTS = {
  MSPH: "Městský soud v Praze", KSCB: "Krajský soud v Českých Budějovicích",
  KSPL: "Krajský soud v Plzni", KSUL: "Krajský soud v Ústí nad Labem",
  KSHK: "Krajský soud v Hradci Králové", KSBR: "Krajský soud v Brně",
  KSOS: "Krajský soud v Ostravě",
};

/** ARES writes money as "2604000;00" — a semicolon decimal separator. */
function money(v) {
  if (v == null) return null;
  const s = String(v).replace(";", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n.toLocaleString("cs-CZ") : s;
}

/** Entries in the Commercial Register are historical; drop the struck-out ones. */
const current = (arr) => (Array.isArray(arr) ? arr.filter((x) => !x.datumVymazu) : []);

/** Commercial Register record: statutory bodies, acting rules, capital, file number. */
export async function commercialRegister(ico) {
  const id = normalizeIco(ico);
  const d = await getJSON(`${BASE}/ekonomicke-subjekty-vr/${id}`, { ttlMs: 6 * 60 * 60 * 1000 });
  const rec = (d.zaznamy || []).find((z) => z.primarniZaznam) || (d.zaznamy || [])[0];
  if (!rec) {
    throw new Error(`IČO ${id} has no Commercial Register record. Sole traders appear only in the Trade Register — use cz_company_search / the basic record instead.`);
  }

  const actingRules = [];
  const people = [];
  for (const organ of current(rec.statutarniOrgany)) {
    for (const z of current(organ.zpusobJednani)) {
      if (z.hodnota) actingRules.push({ organ: organ.nazevOrganu, rule: z.hodnota, since: z.datumZapisu });
    }
    for (const m of current(organ.clenoveOrganu)) {
      const fo = m.fyzickaOsoba, po = m.pravnickaOsoba;
      const name = fo
        ? [fo.titulPredJmenem, fo.jmeno, fo.prijmeni, fo.titulZaJmenem].filter(Boolean).join(" ")
        : po?.obchodniJmeno || "?";
      people.push({
        organ: organ.nazevOrganu || "statutární orgán",
        role: m.clenstvi?.funkce?.nazev || m.nazevAngazma || null,
        name,
        since: m.clenstvi?.clenstvi?.vznikClenstvi || m.datumZapisu || null,
      });
    }
  }

  const sz = current(rec.spisovaZnacka)[0];
  const capital = current(rec.zakladniKapital).find((k) => k.typJmeni === "ZAKLADNI_JMENI") || current(rec.zakladniKapital)[0];

  return {
    ico: rec.ico,
    name: current(rec.obchodniJmeno)[0]?.hodnota || null,
    fileNumber: sz ? `${sz.oddil} ${sz.vlozka} vedená u ${REGISTRY_COURTS[sz.soud] || sz.soud}` : null,
    registeredSince: typeof rec.datumZapisu === "string" ? rec.datumZapisu : current(rec.datumZapisu)[0]?.hodnota || null,
    capital: capital?.vklad ? `${money(capital.vklad.hodnota)} ${capital.vklad.typObnos === "KORUNY" ? "CZK" : capital.vklad.typObnos}` : null,
    actingRules,
    statutoryBodies: people,
    status: rec.stavSubjektu || null,
  };
}

export const justiceUrl = (ico) =>
  `https://or.justice.cz/ias/ui/rejstrik-$firma?ico=${normalizeIco(ico)}`;
export const aresUrl = (ico) =>
  `https://ares.gov.cz/ekonomicke-subjekty?ico=${normalizeIco(ico)}`;
