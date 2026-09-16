/**
 * Client for CELLAR, the Publications Office of the European Union's common
 * repository behind EUR-Lex. Two official access channels are used:
 *   - RESTful content negotiation on https://publications.europa.eu/resource/celex/{CELEX}
 *   - the public SPARQL endpoint https://publications.europa.eu/webapi/rdf/sparql
 * Both are documented at https://eur-lex.europa.eu/content/help/data-reuse/reuse-contents-eurlex-details.html
 */
import { request } from "./http.js";
import { htmlToText } from "./format.js";

const CELLAR = "https://publications.europa.eu/resource/celex";
const SPARQL = "https://publications.europa.eu/webapi/rdf/sparql";
export const EURLEX_UI = "https://eur-lex.europa.eu/legal-content";

const LANG3 = {
  en: "eng", eng: "eng", cs: "ces", ces: "ces", cz: "ces",
  de: "deu", deu: "deu", fr: "fra", fra: "fra", sk: "slk", slk: "slk",
  pl: "pol", pol: "pol", es: "spa", spa: "spa", it: "ita", ita: "ita",
  nl: "nld", nld: "nld", da: "dan", sv: "swe", fi: "fin", pt: "por",
  el: "ell", hu: "hun", ro: "ron", bg: "bul", hr: "hrv", sl: "slv",
  et: "est", lv: "lav", lt: "lit", mt: "mlt", ga: "gle",
};

export function toLang3(lang) {
  const key = String(lang || "en").toLowerCase();
  const v = LANG3[key];
  if (!v) throw new Error(`Unsupported language "${lang}". Use an EU official language code such as en, cs, de, fr.`);
  return v;
}

export function normalizeCelex(celex) {
  const c = String(celex).trim().toUpperCase().replace(/^CELEX[:\s]*/, "");
  // No permissive fallback: it accepted almost anything and turned a typo into a
  // confusing "CELLAR has no work" error instead of failing at the door.
  if (!/^[0-9][0-9]{4}[A-Z]{1,2}[0-9]{4}(-[0-9]{8})?(\([0-9]+\))?(R\([0-9]+\))?$/.test(c)) {
    throw new Error(`"${celex}" does not look like a CELEX number (e.g. 32016R0679, or 02016R0679-20160504 for a consolidated text).`);
  }
  return c;
}

/**
 * Does this string have a CELEX shape the rest of this module can address?
 *
 * CELLAR hands back plenty of identifiers that do not: Court summaries and
 * restatements (62024CJ0461_SUM, 62025CJ0027_RES) and national transposition
 * records (72022L2464MLT_202601480). They are legitimate CELLAR rows, they are
 * simply not documents these tools fetch. Use this to skip them; never let one
 * reach normalizeCelex on a rendering path, because one bad row would then
 * abort the whole result set and present as "nothing found".
 */
export function isCelex(celex) {
  if (!celex) return false;
  const c = String(celex).trim().toUpperCase().replace(/^CELEX[:\s]*/, "");
  return /^[0-9][0-9]{4}[A-Z]{1,2}[0-9]{4}(-[0-9]{8})?(\([0-9]+\))?(R\([0-9]+\))?$/.test(c);
}

/** uiUrl for anything with a usable CELEX shape, null otherwise. Never throws. */
export function safeUiUrl(celex, lang = "en") {
  return isCelex(celex) ? uiUrl(celex, lang) : null;
}

/** The consolidated-family CELEX prefix for a base act: 32016R0679 -> 02016R0679- */
export function consolidatedPrefix(celex) {
  const c = normalizeCelex(celex);
  if (c.startsWith("0")) return c.split("-")[0] + "-";
  return "0" + c.slice(1) + "-";
}

export function uiUrl(celex, lang = "en") {
  const l = String(lang).slice(0, 2).toUpperCase();
  return `${EURLEX_UI}/${l}/TXT/?uri=CELEX%3A${encodeURIComponent(normalizeCelex(celex))}`;
}

export function cellarUrl(celex) {
  return `${CELLAR}/${normalizeCelex(celex)}`;
}

/** Fetch the official text of a CELEX document in a given language. */
export async function fetchText(celex, lang = "en") {
  const c = normalizeCelex(celex);
  const l3 = toLang3(lang);
  const attempts = [
    { accept: "application/xhtml+xml", kind: "XHTML" },
    { accept: "text/html", kind: "HTML" },
  ];
  const problems = [];
  for (const a of attempts) {
    const res = await request(`${CELLAR}/${c}`, {
      headers: { Accept: a.accept, "Accept-Language": l3 },
      timeoutMs: 120_000,
    });
    if (res.status === 200 && res.body.length > 500) {
      return { celex: c, language: l3, format: a.kind, text: htmlToText(res.body.toString("utf8")) };
    }
    problems.push(`${a.kind}: HTTP ${res.status}`);
  }
  throw new Error(
    `No ${l3} text available for CELEX ${c} via CELLAR (${problems.join(", ")}). ` +
      `Older acts are sometimes PDF-only; check ${uiUrl(c, lang)}.`
  );
}

/** Run a SPARQL query against the CELLAR endpoint; returns array of row objects. */
export async function sparql(query, { timeoutMs = 120_000, ttlMs } = {}) {
  const url = `${SPARQL}?${new URLSearchParams({ query, format: "application/sparql-results+json" })}`;
  const res = await request(url, { timeoutMs, ttlMs, headers: { Accept: "application/sparql-results+json" } });
  const text = res.body.toString("utf8");
  if (res.status !== 200) throw new Error(`CELLAR SPARQL returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`CELLAR SPARQL returned non-JSON: ${text.slice(0, 300)}`);
  }
  return (json.results?.bindings || []).map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.value]))
  );
}

const escapeLiteral = (s) => String(s).replace(/["\\]/g, "\\$&");

/**
 * Full-text search over expression titles. Uses Virtuoso's text index
 * (bif:contains), which is orders of magnitude faster than a CONTAINS filter.
 */
export async function search({ query, language = "en", celexPrefix, year, limit = 20 }) {
  const l3 = toLang3(language);
  const terms = String(query).trim();
  if (!terms) throw new Error("search requires a non-empty query");
  const ftq = terms
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `'${escapeLiteral(t.replace(/'/g, ""))}'`)
    .join(" AND ");

  const filters = [];
  if (celexPrefix) filters.push(`FILTER(STRSTARTS(STR(?celex), "${escapeLiteral(String(celexPrefix).toUpperCase())}"))`);
  if (year) filters.push(`FILTER(STRSTARTS(STR(?celex), "3${escapeLiteral(String(year))}") || STRSTARTS(STR(?celex), "0${escapeLiteral(String(year))}"))`);

  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?title ?date WHERE {
  ?exp cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/${l3.toUpperCase()}> ;
       cdm:expression_title ?title ;
       cdm:expression_belongs_to_work ?work .
  ?work cdm:resource_legal_id_celex ?celex .
  OPTIONAL { ?work cdm:work_date_document ?date }
  FILTER(bif:contains(?title, "${ftq}"))
  ${filters.join("\n  ")}
}
ORDER BY DESC(?date)
LIMIT ${Math.min(Number(limit) || 20, 100)}`;
  const rows = await sparql(q, { ttlMs: 6 * 60 * 60 * 1000 });
  // Drop rows whose CELEX this module cannot address (Court summaries, national
  // transposition records). Previously they reached uiUrl() on the rendering
  // path and threw, so a single such row failed the entire search — which hit
  // hardest in exactly the subject areas with the most case law.
  return rows.filter((r) => isCelex(r.celex));
}

/** All consolidated versions of a base act, newest first. */
export async function consolidatedVersions(celex) {
  const prefix = consolidatedPrefix(celex);
  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  FILTER(STRSTARTS(STR(?celex), "${escapeLiteral(prefix)}"))
}
ORDER BY DESC(?celex)`;
  const rows = await sparql(q, { ttlMs: 24 * 60 * 60 * 1000 });
  return rows.map((r) => ({
    celex: r.celex,
    consolidatedAt: r.celex.split("-")[1]?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") || null,
  }));
}

/** Resolve a CELEX number to its CELLAR work URI. */
export async function workUri(celex) {
  const c = normalizeCelex(celex);
  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
SELECT ?work WHERE { ?work cdm:resource_legal_id_celex "${escapeLiteral(c)}"^^xsd:string } LIMIT 1`;
  const rows = await sparql(q, { ttlMs: 24 * 60 * 60 * 1000 });
  if (!rows.length) {
    throw new Error(`CELLAR has no work with CELEX ${c}. Check the number at ${uiUrl(c, "en")}.`);
  }
  return { celex: c, work: rows[0].work };
}

const CDM = "http://publications.europa.eu/ontology/cdm#";

/**
 * Core metadata for one CELEX: title, dates, force status, ELI.
 * Resolved in two steps because the CELLAR query planner does not reliably
 * join expressions when the work is selected by a CELEX literal in one query.
 */
export async function metadata(celex, language = "en") {
  const l3 = toLang3(language);
  const { celex: c, work } = await workUri(celex);

  const factsQ = `SELECT ?p ?o WHERE { <${work}> ?p ?o }`;
  const facts = await sparql(factsQ, { ttlMs: 24 * 60 * 60 * 1000 });
  const pick = (local) =>
    facts.filter((f) => f.p === CDM + local).map((f) => f.o);

  const titleQ = `PREFIX cdm: <${CDM}>
SELECT ?title WHERE {
  ?exp cdm:expression_belongs_to_work <${work}> ;
       cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/${l3.toUpperCase()}> ;
       cdm:expression_title ?title
} LIMIT 1`;
  const titleRows = await sparql(titleQ, { ttlMs: 24 * 60 * 60 * 1000 });

  const inForce = pick("resource_legal_in-force")[0];
  return {
    celex: c,
    workUri: work,
    title: titleRows[0]?.title || null,
    language: l3,
    dateDocument: pick("work_date_document")[0] || pick("resource_legal_date_signature")[0] || null,
    entryIntoForce: pick("resource_legal_date_entry-into-force").sort()[0] || null,
    endOfValidity: pick("resource_legal_date_end-of-validity")[0] || null,
    inForce: inForce === undefined ? null : inForce === "true" || inForce === "1",
    eli: pick("resource_legal_eli")[0] || null,
    basedOn: pick("resource_legal_based_on_resource_legal").slice(0, 10),
    amendedBy: pick("resource_legal_amended_by_resource_legal").slice(0, 20),
    repealedBy: pick("resource_legal_repealed_by_resource_legal").slice(0, 10),
    uiUrl: uiUrl(c, language),
    cellarUrl: cellarUrl(c),
  };
}

const ARTICLE_WORD = {
  eng: "Article", ces: "Článek", deu: "Artikel", fra: "Article", slk: "Článok",
  pol: "Artykuł", spa: "Artículo", ita: "Articolo", nld: "Artikel", por: "Artigo",
};

/**
 * Extract one article from a plain-text EU act.
 *
 * Works on heading lines — a line consisting only of "Article 30" (or the
 * language equivalent) — and runs to the next such heading. Recitals reference
 * articles inside sentences, which is why only standalone heading lines count.
 * Returns null when no heading matches.
 */
export function sliceArticle(fullText, article, language = "en") {
  const l3 = toLang3(language);
  const word = ARTICLE_WORD[l3] || ARTICLE_WORD.eng;
  const n = String(article).trim().replace(/^(art\.?|article|článek)\s*/i, "");
  const lines = fullText.split("\n");
  const headingAt = (i, num) => {
    const re = new RegExp(`^\\s*${word}\\s+${num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
    return re.test(lines[i]);
  };
  let start = -1;
  for (let i = 0; i < lines.length; i++) if (headingAt(i, n)) { start = i; break; }
  if (start === -1) return null;

  const anyHeading = new RegExp(`^\\s*${word}\\s+\\d+[a-z]?\\s*$`, "i");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (anyHeading.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n").trim();
}
