/**
 * Client for the public REST API of e-Sbírka — the Electronic Collection of Laws
 * and International Treaties of the Czech Republic, operated by the Ministry of
 * the Interior under Act No. 222/2016 Coll. Since 1 January 2024 this is the
 * legally authoritative publication channel for Czech legislation.
 *
 * The endpoints used here are the same public, unauthenticated ones the
 * e-Sbírka web application calls. They are documented at
 * https://e-sbirka.gov.cz/restful-api and https://e-sbirka.gov.cz/open-data.
 */
import { getJSON, request, sleep } from "./http.js";
import { htmlToText } from "./format.js";

const API = "https://e-sbirka.gov.cz/sbr-externi";
const FILES = "https://e-sbirka.gov.cz/souborove-sluzby";
const PORTAL = "https://www.e-sbirka.cz";

/** Structural fragment types that can be addressed as a "section". */
const ADDRESSABLE = new Set([
  "Paragraf", "Clanek", "Cast", "Hlava", "Dil", "Oddil", "Pododdil",
  "Block_Priloha", "Hlavicka_priloha",
]);

/** Fragment types that carry no text of their own. */
const STRUCTURAL_ONLY = /^Virtual_/;

export function normalizeRef({ number, year, collection = "sb" }) {
  const n = String(number).trim().replace(/\/.*$/, "");
  const y = String(year).trim();
  if (!/^\d+$/.test(n)) throw new Error(`Invalid act number: ${number}`);
  if (!/^\d{4}$/.test(y)) throw new Error(`Invalid year: ${year}`);
  const coll = String(collection).toLowerCase();
  if (!["sb", "ms"].includes(coll)) {
    throw new Error(`Unknown collection "${collection}" (use "sb" for Sbírka zákonů, "ms" for Sbírka mezinárodních smluv)`);
  }
  return { number: n, year: y, collection: coll, base: `/${coll}/${y}/${n}` };
}

export function citationOf(ref) {
  return ref.collection === "ms"
    ? `${ref.number}/${ref.year} Sb. m. s.`
    : `${ref.number}/${ref.year} Sb.`;
}

export function permalink(staleUrl) {
  return `${PORTAL}/eli/cz${staleUrl}`;
}

export function eliDataUrl(staleUrl) {
  return `https://opendata.eselpoint.gov.cz/esel-esb/eli/cz${staleUrl}`;
}

const enc = (staleUrl) => encodeURIComponent(staleUrl);

/** All consolidated versions of an act, newest first. */
export async function versions(ref) {
  const data = await getJSON(`${API}/dokumenty-sbirky/${enc(ref.base)}/historie`, {
    ttlMs: 6 * 60 * 60 * 1000,
  });
  const list = data?.historie || [];
  if (!list.length) throw new Error(`No versions found for ${citationOf(ref)} — check the number and year.`);
  return list.map((v) => ({
    staleUrl: v.staleUrl,
    effectiveFrom: v.datumUcinnostiZneniOd || null,
    effectiveTo: v.datumUcinnostiZneniDo || null,
    versionNumber: v.cisloZneni ?? null,
    status: v.typZneni, // AKTUALNI | MINULE | BUDOUCI
    promulgated: v.datumCasVyhlaseni ? String(v.datumCasVyhlaseni).slice(0, 10) : null,
    amendedBy: (v.novely || []).map((n) => ({ citation: n.kodDokumentuSbirky, staleUrl: n.staleUrl })),
    notes: v.poznamky || [],
  }));
}

/**
 * Resolve a version selector to a concrete staleUrl.
 * @param {"current"|"latest"|string} version  "current", or an ISO date; the
 *   version in force on that date is returned.
 */
export async function resolveVersion(ref, version = "current") {
  const all = await versions(ref);
  if (version === "current" || version === "latest") {
    const cur = all.find((v) => v.status === "AKTUALNI");
    if (cur) return { version: cur, all, repealed: false };
    // No version in force: the act has been repealed. Fall back to the last
    // version that was in force and say so loudly rather than failing.
    const last = all.find((v) => v.status === "MINULE") || all[0];
    return { version: last, all, repealed: true };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(version)) {
    throw new Error(`version must be "current" or an ISO date (YYYY-MM-DD), got "${version}"`);
  }
  const exact = all.find((v) => v.staleUrl.endsWith(`/${version}`));
  if (exact) return { version: exact, all };
  const inForce = all.find(
    (v) => v.effectiveFrom && v.effectiveFrom <= version && (!v.effectiveTo || v.effectiveTo >= version)
  );
  if (!inForce) {
    throw new Error(`No version of ${citationOf(ref)} was in force on ${version}. Available from: ${all.map((v) => v.effectiveFrom).join(", ")}`);
  }
  return { version: inForce, all, repealed: false };
}

export async function documentId(staleUrl) {
  const res = await request(`${API}/dokumenty-sbirky/${enc(staleUrl)}/id`, {
    headers: { Accept: "application/json" },
  });
  const id = res.body.toString("utf8").trim();
  if (!/^\d+$/.test(id)) throw new Error(`Could not resolve document id for ${staleUrl}: ${id.slice(0, 200)}`);
  return id;
}

export async function tableOfContents(staleUrl) {
  const data = await getJSON(`${API}/dokumenty-sbirky/${enc(staleUrl)}/obsah`);
  return (data?.polozkyObsahu || []).map((p) => ({
    label: p.oznaceniUstanoveni || "",
    title: p.nazev || "",
    range: p.rozsah || "",
    fragmentId: p.fragmentId,
  }));
}

export async function downloadLinks(staleUrl) {
  return getJSON(`${API}/dokumenty-sbirky/${enc(staleUrl)}/odkazy-ke-stazeni`);
}

/** Ask for a generated file, wait for it, return the bytes. */
async function fetchGeneratedFile(docId, format) {
  const start = await getJSON(`${API}/stahni/informativni-zneni/${docId}/${format}`, { ttlMs: 60 * 60 * 1000 });
  let fileId = start.id;
  if (start.stavPozadavku !== "OK" || !fileId) {
    const reqId = start.pozadavekId;
    if (!reqId) throw new Error(`e-Sbírka did not accept the ${format} export request.`);
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const st = await getJSON(`${FILES}/verejne-pozadavky-dokumenty/pozadavky/${reqId}`, { ttlMs: 0 });
      if (st.stav === "OK" && st.id) { fileId = st.id; break; }
      if (st.stav && !["PROBIHA", "CEKA", "OK"].includes(st.stav)) {
        throw new Error(`e-Sbírka export failed with state ${st.stav}`);
      }
    }
    if (!fileId) throw new Error(`e-Sbírka did not finish the ${format} export within 30 s.`);
  }
  const res = await request(`${FILES}/soubory/${fileId}`, { timeoutMs: 90_000 });
  if (res.status !== 200) throw new Error(`Downloading the generated ${format} file failed (HTTP ${res.status}).`);
  return { bytes: res.body, fileName: start.nazevDokumentu || `${docId}.${format.toLowerCase()}` };
}

/** Structured full text of a consolidated version, as a flat fragment list. */
export async function fragments(staleUrl) {
  const docId = await documentId(staleUrl);
  const { bytes, fileName } = await fetchGeneratedFile(docId, "JSON");
  const doc = JSON.parse(bytes.toString("utf8"));
  return {
    docId,
    fileName,
    metadata: doc.metadata || {},
    fragments: (doc.fragmenty || []).map((f) => ({
      id: f.fragmentId,
      depth: f.hloubka,
      type: f.typ,
      text: htmlToText(f.xhtml),
    })),
  };
}

function normalizeSectionLabel(s) {
  return String(s)
    .replace(/[§\s.]/g, "")
    .replace(/^cl(anek)?/i, "")
    .toLowerCase();
}

/**
 * Slice the fragment list down to one addressable unit and everything nested
 * under it. Returns null when the label is not found.
 */
export function sliceSection(frags, sectionLabel) {
  const want = normalizeSectionLabel(sectionLabel);
  const startIdx = frags.findIndex(
    (f) => ADDRESSABLE.has(f.type) && f.text && normalizeSectionLabel(f.text) === want
  );
  if (startIdx === -1) return null;
  const depth = frags[startIdx].depth;
  let end = frags.length;
  for (let i = startIdx + 1; i < frags.length; i++) {
    if (frags[i].depth <= depth) { end = i; break; }
  }
  return frags.slice(startIdx, end);
}

/** List every addressable label present, for error messages and discovery. */
export function addressableLabels(frags) {
  return frags.filter((f) => ADDRESSABLE.has(f.type) && f.text).map((f) => f.text);
}

/** Render fragments as readable, indentation-free plain text. */
export function renderFragments(frags) {
  const out = [];
  for (const f of frags) {
    if (STRUCTURAL_ONLY.test(f.type) || !f.text) continue;
    if (["Paragraf", "Clanek", "Cast", "Hlava", "Dil", "Oddil", "Pododdil"].includes(f.type)) {
      out.push("", f.text);
    } else if (f.type.startsWith("Nadpis") || f.type === "Hlavicka_priloha") {
      out.push(f.text);
    } else if (f.type === "Poznamka" || f.type === "PPC") {
      out.push(`  [pozn.] ${f.text}`);
    } else {
      out.push(f.text);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Descriptive metadata: act subtype, approval date, subject-matter concepts. */
export async function getJSONInfo(staleUrl) {
  return getJSON(`${API}/dokumenty-sbirky/${enc(staleUrl)}/dalsi-informace`);
}

/** Relations to other acts, grouped by relation type (incl. ODKAZUJE_DO_EU). */
export async function relations(staleUrl) {
  return getJSON(`${API}/dokumenty-sbirky/${enc(staleUrl)}/souvislosti`, { timeoutMs: 90_000 });
}
