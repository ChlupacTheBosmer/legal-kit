/**
 * Czech case law from the courts' own public databases.
 *
 *   Nejvyšší soud (NS)          rozhodnuti.nsoud.cz      search + full text
 *   Ústavní soud (ÚS / NALUS)   nalus.usoud.cz           full text by case number
 *   District & regional courts  rozhodnuti.justice.cz    official open-data API
 *   Nejvyšší správní soud (NSS) vyhledavac.nssoud.cz     search-URL builder only
 *
 * None of these publishes a documented API. The NS endpoints were derived from
 * its own search form (a Lotus Domino SearchView); the justice.cz endpoint is
 * the Ministry of Justice's published open-data REST API. See
 * docs/source-apis.md.
 */
import { request, getJSON } from "./http.js";
import { htmlToText, decodeEntities } from "./format.js";

const NS = "https://rozhodnuti.nsoud.cz";
const NS_DB = `${NS}/Judikatura/judikatura_ns.nsf`;
const NALUS = "https://nalus.usoud.cz";
const JUSTICE = "https://rozhodnuti.justice.cz";
const NSS = "https://vyhledavac.nssoud.cz";

/* ------------------------------------------------- Nejvyšší soud (Supreme) */

/** "23 Cdo 3492/2021" -> {senate:"23", register:"Cdo", number:"3492", year:"2021"} */
export function parseNsCaseNumber(s) {
  const m = String(s).trim().match(/^(\d+)\s+([A-Za-zČčŘřŠšŽžÝýÁáÉéÍíÓóÚúŮů]+)\s+(\d+)\s*\/\s*(\d{4})$/);
  if (!m) throw new Error(`"${s}" is not a Supreme Court case number (expected e.g. "23 Cdo 3492/2021").`);
  return { senate: m[1], register: m[2], number: m[3], year: m[4] };
}

const czDate = (iso) => {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Date must be ISO (YYYY-MM-DD), got "${iso}"`);
  return `${m[3]}.${m[2]}.${m[1]}`;
};

/** Domino query values are unquoted, so strip the characters that break them. */
const q = (s) => String(s).replace(/[()"\[\]]/g, " ").replace(/\s+/g, " ").trim();

export function buildNsQuery(opts) {
  const parts = [];
  if (opts.text) parts.push(`([ARozhodnutiRT]=(${q(opts.text)}))`);
  if (opts.legal_thesis) parts.push(`([pravni_veta]=(${q(opts.legal_thesis)}))`);
  if (opts.annotation) parts.push(`([Anotace]=(${q(opts.annotation)}))`);
  if (opts.keyword) parts.push(`([heslo]="${q(opts.keyword)}")`);
  if (opts.ecli) parts.push(`[ecli]="${q(opts.ecli)}"`);
  if (opts.case_number) {
    const c = parseNsCaseNumber(opts.case_number);
    parts.push(`[spzn1]=${c.senate}`, `[spzn2]=${c.register}`, `[spzn3]=${c.number}`, `[spzn4]=${c.year}`);
  }
  if (opts.date_from) parts.push(`[datum_rozhodnuti]>=..${czDate(opts.date_from)}`);
  if (opts.date_to) parts.push(`[datum_rozhodnuti]<=..${czDate(opts.date_to)}`);
  if (opts.decision_type) parts.push(`([TypRozhodnuti]=${q(opts.decision_type)})`);
  if (opts.category) parts.push(`([kategorie_rozhodnuti1]=${q(opts.category)})`);
  if (!parts.length) throw new Error("A Supreme Court search needs at least one criterion.");
  return parts.join(" AND ");
}


/**
 * Domino refuses `Count` below 5 with "HCL Notes Exception - Field is too large
 * (32K) or View's column & selection formulas are too large". It is a confusing
 * error for an out-of-range page size, and it cost a long debugging session: the
 * failures looked like an intermittent outage because probes alternated between
 * Count=3 and Count=20. `SearchMax` and `Start` turned out to be irrelevant.
 * So: always ask the server for at least 5 rows, then trim locally.
 */
const NS_MIN_COUNT = 5;

/** Search the Supreme Court database. Returns {total, shown, items[]}. */
export async function nsSearch(opts) {
  const query = buildNsQuery(opts);
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 100);
  const count = Math.max(limit, NS_MIN_COUNT);
  // `Start` is 1-based (0 behaves as 1). Next page = start + limit.
  const start = Math.max(Number(opts.start) || 1, 1);

  // `SearchView` must stay a bare flag — `SearchView=` is refused.
  const url =
    `${NS_DB}/$$WebSearch1?SearchView&Query=${encodeURIComponent(query)}` +
    `&SearchMax=1000&SearchOrder=4&Start=${start}&Count=${count}&pohled=1`;

  const res = await request(url, { timeoutMs: 90_000, ttlMs: 6 * 60 * 60 * 1000, retries: 2 });
  const html = res.body.toString("utf8");
  if (res.status !== 200) {
    throw new Error(
      `The Supreme Court search returned HTTP ${res.status}. Check the query shape first — Domino reports a bad ` +
        `request as a 500. Verify by hand at https://rozhodnuti.nsoud.cz/ ; cz_case_text is unaffected.\n` +
        `Query attempted: ${query}`
    );
  }

  // Distinguish a real zero from an unparsed page: Domino prints an explicit
  // "no results" line, and reporting that as null would leave the caller unable
  // to tell "nothing matched" from "something went wrong".
  const totalM = html.match(/Výsledky\s+[\d\s]+-\s*[\d\s]+\s*z\s*([\d\s]+)\s*zobrazovan/i);
  const total = totalM
    ? Number(totalM[1].replace(/\s/g, ""))
    : /Nebyly nalezeny žádné výsledky/i.test(html)
      ? 0
      : null;

  const items = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const link = row.match(/href="([^"]*\/WebSearch\/([0-9A-F]{32})\?openDocument)"[^>]*>\s*([^<]+)</i);
    if (!link) continue;
    const court = (row.match(/<td class="td-short-wrap">([^<]*)</i) || [])[1];
    const category = (row.match(/<td class="td-short\s+category\s*">([^<]*)</i) || [])[1];
    const pdf = (row.match(/href="([^"]*\.pdf\?openElement)"/i) || [])[1];
    items.push({
      caseNumber: decodeEntities(link[3]).trim(),
      unid: link[2],
      court: court ? decodeEntities(court).trim() : "Nejvyšší soud",
      category: category ? decodeEntities(category).trim() : null,
      textUrl: `${NS_DB}/WebPrint/${link[2]}?openDocument`,
      pageUrl: `${NS}${link[1]}`,
      pdfUrl: pdf ? `${NS}${pdf.replace(/ /g, "%20")}` : null,
    });
  }
  const shown = items.slice(0, limit);
  return { total, shown: shown.length, query, items: shown };
}

const NS_HEADER_FIELDS = [
  ["Soud", "court"], ["Datum rozhodnutí", "decisionDate"], ["Spisová značka", "caseNumber"],
  ["ECLI", "ecli"], ["Typ rozhodnutí", "decisionType"], ["Heslo", "keywords"],
  ["Dotčené předpisy", "provisions"], ["Kategorie rozhodnutí", "category"],
];

/** Full text of one Supreme Court decision, by UNID. */
export async function nsText(unid) {
  if (!/^[0-9A-F]{32}$/i.test(String(unid))) {
    throw new Error(`"${unid}" is not a Supreme Court document id (32 hex characters, from cz_case_search).`);
  }
  const url = `${NS_DB}/WebPrint/${unid}?openDocument`;
  const res = await request(url, { timeoutMs: 90_000 });
  if (res.status !== 200) throw new Error(`Supreme Court returned HTTP ${res.status} for ${unid}`);
  const text = htmlToText(res.body.toString("utf8"));

  const header = {};
  for (const [label, key] of NS_HEADER_FIELDS) {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n]*)`, "i");
    const hit = text.slice(0, 2000).match(re);
    if (hit && hit[1].trim()) header[key] = hit[1].trim();
  }
  return { unid, url, header, text };
}

/* ------------------------------------------ Ústavní soud (Constitutional) */

/** "I. ÚS 1234/21", "Pl. ÚS 19/14", "III.ÚS 3457/22" -> NALUS `sz` parameter. */
export function parseUsCaseNumber(s) {
  const t = String(s).trim().replace(/\s+/g, " ");
  const m = t.match(/^(Pl|I{1,3}|IV)\s*\.?\s*ÚS\s*(\d+)\s*\/\s*(\d{2,4})$/i);
  if (!m) throw new Error(`"${s}" is not a Constitutional Court case number (expected e.g. "I. ÚS 1234/21" or "Pl. ÚS 19/14").`);
  const senateMap = { I: "1", II: "2", III: "3", IV: "4", PL: "Pl" };
  const senate = senateMap[m[1].toUpperCase()];
  if (!senate) throw new Error(`Unknown Constitutional Court panel "${m[1]}".`);
  const year = m[3].length === 4 ? m[3].slice(2) : m[3];
  return { sz: `${senate}-${m[2]}-${year}`, senate, number: m[2], year };
}

/** Full text of one Constitutional Court decision, by case number. */
export async function usText(caseNumber) {
  const { sz } = parseUsCaseNumber(caseNumber);
  const url = `${NALUS}/Search/GetText.aspx?sz=${encodeURIComponent(sz)}`;
  const res = await request(url, { timeoutMs: 90_000 });
  if (res.status !== 200) throw new Error(`NALUS returned HTTP ${res.status} for ${caseNumber}`);
  const text = htmlToText(res.body.toString("utf8"));
  // A miss still returns 200 with a near-empty shell.
  if (text.length < 1200) {
    throw new Error(
      `NALUS has no decision text for ${caseNumber}. Check the case number, or search at ${usSearchUrl(caseNumber)}`
    );
  }
  const heading = text.match(/((?:Pl|I{1,3}|IV)\.ÚS\s*\d+\/\d+[^\n]*)/);
  return { caseNumber, sz, url, heading: heading ? heading[1].trim() : null, text };
}

export const usSearchUrl = (term) =>
  `${NALUS}/Search/Search.aspx?${new URLSearchParams({ Search: String(term) })}`;

/* ------------------------------- District & regional courts (open data) */

/** One day of published decisions; the API is indexed by publication date. */
export async function justiceByDay(date, { page = 0, pageSize = 100 } = {}) {
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Date must be ISO (YYYY-MM-DD), got "${date}"`);
  const url =
    `${JUSTICE}/api/opendata/${Number(m[1])}/${Number(m[2])}/${Number(m[3])}?` +
    new URLSearchParams({ pageNumber: String(page), pageSize: String(pageSize) });
  return getJSON(url, { timeoutMs: 60_000, ttlMs: 7 * 24 * 60 * 60 * 1000 });
}

/** Diacritic- and case-insensitive comparison key for Czech text. */
const fold = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Scan published decisions over a date range and filter client-side.
 * The API has no keyword index, so this genuinely walks the days requested —
 * keep ranges short and say what was scanned.
 */
export async function justiceScan({ date_from, date_to, keyword, provision, court, limit = 25 }) {
  const start = new Date(`${date_from}T00:00:00Z`);
  const end = new Date(`${date_to || date_from}T00:00:00Z`);
  if (Number.isNaN(+start) || Number.isNaN(+end)) throw new Error("date_from / date_to must be ISO dates (YYYY-MM-DD).");
  const days = Math.round((end - start) / 86_400_000) + 1;
  if (days < 1) throw new Error("date_to must not be before date_from.");
  if (days > 31) throw new Error(`Range is ${days} days; the open-data API is indexed by day, so scan at most 31 days at a time.`);

  const kw = keyword ? fold(keyword) : null;
  const pv = provision ? fold(provision) : null;
  const ct = court ? fold(court) : null;
  const hits = [];
  let scanned = 0, daysDone = 0, failed = 0;

  for (let i = 0; i < days && hits.length < limit; i++) {
    const d = new Date(+start + i * 86_400_000).toISOString().slice(0, 10);
    let page = 0, totalPages = 1;
    while (page < totalPages && hits.length < limit) {
      // A day with nothing published returns 200 with an empty list, so a thrown
      // error here is a real failure — count it rather than passing it off as
      // "nothing found", which would understate the scan.
      let payload;
      try {
        payload = await justiceByDay(d, { page });
      } catch {
        failed++;
        break;
      }
      totalPages = payload.totalPages ?? 1;
      for (const it of payload.items || []) {
        scanned++;
        const hay = fold(
          [it.predmetRizeni, (it.klicovaSlova || []).join(" "), (it.zminenaUstanoveni || []).join(" ")].join(" ")
        );
        if (kw && !hay.includes(kw)) continue;
        if (pv && !fold((it.zminenaUstanoveni || []).join(" ")).includes(pv)) continue;
        if (ct && !fold(it.soud || "").includes(ct)) continue;
        hits.push({
          caseNumber: it.jednaciCislo, court: it.soud, ecli: it.ecli,
          subject: it.predmetRizeni, decided: it.datumVydani, published: it.datumZverejneni,
          keywords: it.klicovaSlova || [], provisions: it.zminenaUstanoveni || [],
          textUrl: it.odkaz,
        });
        if (hits.length >= limit) break;
      }
      page++;
    }
    daysDone++;
  }
  return { hits, scanned, daysScanned: daysDone, daysRequested: days, failedDays: failed };
}

/** Full (anonymised) text of one lower-court decision. */
export async function justiceText(urlOrUuid) {
  const uuid = String(urlOrUuid).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!uuid) throw new Error(`"${urlOrUuid}" does not contain a decision UUID.`);
  const doc = await getJSON(`${JUSTICE}/api/finaldoc/${uuid[0]}`, { timeoutMs: 60_000 });

  // The payload carries each section twice: as an array of styled blocks and as
  // a flat *Text string. Use the strings — they are the authoritative full text.
  // An earlier version guessed at section names ("reasoning", "oduvodneni"),
  // matched only header+verdict, and silently returned a decision without its
  // reasoning: about 1 kB in place of 17 kB, under a banner claiming it was the
  // official text. Assemble from the real keys and verify nothing was dropped.
  const flatten = (blocks) =>
    (blocks || []).map((b) => (b.texts || []).map((t) => t.text).join("")).filter(Boolean).join("\n");

  const parts = [
    ["", doc.headerText ?? flatten(doc.header)],
    ["VÝROK", doc.verdictText ?? flatten(doc.verdict)],
    ["ODŮVODNĚNÍ", doc.justificationText ?? flatten(doc.justification)],
    ["POUČENÍ", doc.informationText ?? flatten(doc.information)],
  ];
  const text = parts
    .filter(([, body]) => body && body.trim())
    .map(([label, body]) => (label ? `${label}\n\n${body}` : body))
    .join("\n\n")
    .trim();

  // Guard against a future key rename doing the same thing again: if the
  // assembled text is far shorter than the text actually present in the
  // payload, fail loudly rather than return a plausible fragment.
  const available = Object.entries(doc)
    .filter(([k, v]) => typeof v === "string" && k !== "uuid" && v.length > 40)
    .reduce((n, [, v]) => n + v.length, 0);
  if (available && text.length < available * 0.6) {
    throw new Error(
      `Refusing to return a partial decision: assembled ${text.length} characters from a payload holding ` +
        `at least ${available}. The justice.cz response shape has changed — keys present: ${Object.keys(doc).join(", ")}.`
    );
  }
  if (!text) throw new Error(`Decision ${uuid[0]} returned no text. Keys present: ${Object.keys(doc).join(", ")}.`);

  return { uuid: uuid[0], url: `${JUSTICE}/api/finaldoc/${uuid[0]}`, text };
}

/* --------------------------- Nejvyšší správní soud (Supreme Administrative) */

/**
 * The NSS search is an ASP.NET form guarded by an anti-forgery token and a
 * session cookie, with dynamically numbered field names. It is not stable
 * enough to script, so this returns the URL a human (or WebFetch) should open.
 */
export const nssSearchUrl = () => `${NSS}/Home/Index?formular=1`;
export const nssDocumentUrl = (id) => `${NSS}/DokumentOriginal/Html/${encodeURIComponent(id)}`;
