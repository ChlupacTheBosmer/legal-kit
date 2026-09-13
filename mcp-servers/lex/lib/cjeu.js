/**
 * Court of Justice of the European Union (CJEU) case law.
 *
 * curia.europa.eu has no API. It is a JavaServer Faces application whose search
 * is guarded by view state, so scraping it would be as brittle as NALUS and
 * would buy nothing: every CJEU judgment, Advocate General opinion and order is
 * published in CELLAR, the Publications Office's own repository, with a CELEX
 * number and full text in every EU language. This module works from CELLAR and
 * links out to curia for the reader.
 *
 * CELEX for a CJEU document is sector 6:
 *
 *     6  YYYY  TT  NNNN
 *     |  |     |   +-- case number, zero padded to four
 *     |  |     +------ document type, see DOC_TYPES
 *     |  +------------ year the case was LODGED, not decided
 *     +--------------- sector 6, case law
 *
 * So Case C-311/18 (Schrems II, decided 2020) is 62018CJ0311.
 */
import { sparql, metadata, fetchText, uiUrl, normalizeCelex } from "./eurlex.js";

export const DOC_TYPES = {
  CJ: "judgment of the Court of Justice",
  TJ: "judgment of the General Court",
  CC: "Opinion of the Advocate General",
  CO: "order of the Court of Justice",
  TO: "order of the General Court",
  CN: "notice of the request for a preliminary ruling",
  CA: "summary notice published in the Official Journal",
  CV: "Opinion of the Court",
};

/** Case-number prefix to the CELEX letter pair for a judgment. */
const COURT_TO_TYPE = { C: "CJ", T: "TJ", F: "FJ" };

/**
 * "C-311/18" -> { court:"C", number:"0311", year:2018 }
 * Two-digit years: anything above the current year's last two digits is 19xx.
 * That puts C-6/64 in 1964 and C-311/18 in 2018.
 */
export function parseCaseNumber(input) {
  const m = String(input).trim().toUpperCase().replace(/\s+/g, "")
    .match(/^(C|T|F)[-‑]?(\d{1,4})\/(\d{2}|\d{4})(?:\s*P)?$/);
  if (!m) {
    throw new Error(`"${input}" is not a CJEU case number. Expected forms: "C-311/18", "T-604/18", "C-6/64".`);
  }
  const [, court, num, yr] = m;
  let year;
  if (yr.length === 4) {
    year = Number(yr);
  } else {
    const cutoff = new Date().getFullYear() % 100;
    year = Number(yr) <= cutoff ? 2000 + Number(yr) : 1900 + Number(yr);
  }
  return { court, number: num.padStart(4, "0"), year, caseNumber: `${court}-${Number(num)}/${yr}` };
}

/** Build the CELEX for a case number and document type. */
export function celexFor(caseInput, docType) {
  const c = parseCaseNumber(caseInput);
  const type = (docType || COURT_TO_TYPE[c.court] || "CJ").toUpperCase();
  if (!DOC_TYPES[type]) {
    throw new Error(`Unknown document type "${type}". Known: ${Object.keys(DOC_TYPES).join(", ")}.`);
  }
  return `6${c.year}${type}${c.number}`;
}

export const curiaUrl = (caseInput) => {
  const c = parseCaseNumber(caseInput);
  return `https://curia.europa.eu/juris/liste.jsf?num=${encodeURIComponent(`${c.court}-${Number(c.number)}/${String(c.year).slice(2)}`)}`;
};

/**
 * Which documents exist for one case. Probes the plausible types rather than
 * guessing: a case may have a judgment, an AG opinion, an order, or only a
 * notice if it is still pending.
 */
export async function documentsFor(caseInput, language = "en") {
  const c = parseCaseNumber(caseInput);
  const candidates = c.court === "C" ? ["CJ", "CC", "CO", "CV", "CN", "CA"] : ["TJ", "TO", "CN", "CA"];
  const found = [];
  for (const type of candidates) {
    const celex = `6${c.year}${type}${c.number}`;
    try {
      const m = await metadata(celex, language);
      found.push({ celex, type, description: DOC_TYPES[type], title: m.title, date: m.dateDocument, url: uiUrl(celex, language) });
    } catch {
      /* that document type does not exist for this case */
    }
  }
  if (!found.length) {
    throw new Error(
      `CELLAR holds no documents for case ${c.caseNumber}. Check the number, or look at ${curiaUrl(caseInput)}. ` +
        `Note the CELEX year is the year the case was lodged, not decided.`
    );
  }
  return { case: c, documents: found, curia: curiaUrl(caseInput) };
}

const escapeLiteral = (s) => String(s).replace(/["\\]/g, "\\$&");

/**
 * Search CJEU case law by words in the title. CELLAR titles for judgments carry
 * the parties and the subject-matter keywords, so this finds cases by topic as
 * well as by party.
 */
export async function search({ query, language = "en", court, docType, from, to, limit = 20 }) {
  const terms = String(query || "").trim();
  if (!terms) throw new Error("A CJEU search needs a query.");
  const ftq = terms.split(/\s+/).filter(Boolean).map((t) => `'${escapeLiteral(t.replace(/'/g, ""))}'`).join(" AND ");

  const filters = ['FILTER(STRSTARTS(STR(?celex), "6"))'];
  if (docType) {
    filters.push(`FILTER(REGEX(STR(?celex), "^6[0-9]{4}${escapeLiteral(docType.toUpperCase())}"))`);
  } else if (court) {
    const letters = court.toUpperCase() === "T" ? "TJ|TO" : "CJ|CC|CO|CV";
    filters.push(`FILTER(REGEX(STR(?celex), "^6[0-9]{4}(${letters})"))`);
  }
  if (from) filters.push(`FILTER(?date >= "${escapeLiteral(from)}"^^<http://www.w3.org/2001/XMLSchema#date>)`);
  if (to) filters.push(`FILTER(?date <= "${escapeLiteral(to)}"^^<http://www.w3.org/2001/XMLSchema#date>)`);

  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT DISTINCT ?celex ?title ?date WHERE {
  ?exp cdm:expression_uses_language <http://publications.europa.eu/resource/authority/language/${language.toUpperCase() === "CS" ? "CES" : "ENG"}> ;
       cdm:expression_title ?title ;
       cdm:expression_belongs_to_work ?work .
  ?work cdm:resource_legal_id_celex ?celex .
  OPTIONAL { ?work cdm:work_date_document ?date }
  FILTER(bif:contains(?title, "${ftq}"))
  ${filters.join("\n  ")}
}
ORDER BY DESC(?date)
LIMIT ${Math.min(Number(limit) * 3 || 60, 200)}`;

  const rows = await sparql(q, { ttlMs: 6 * 60 * 60 * 1000 });

  // CELLAR publishes several records per case: the judgment, plus restatement
  // and information variants suffixed "_RES" / "_INF", plus a summary notice
  // (CA/TA) and the original request (CN). One row per case is what is useful,
  // so collapse them and keep the most substantive document.
  const RANK = { CJ: 0, TJ: 0, CC: 1, CV: 1, CO: 2, TO: 2, FJ: 0, CN: 8, CA: 9, TA: 9 };
  const best = new Map();
  for (const r of rows) {
    const celex = String(r.celex).replace(/_[A-Z]+$/, "");
    if (!/^6\d{4}[A-Z]{2}\d{4}$/.test(celex)) continue;
    const type = celex.slice(5, 7);
    const caseKey = celex.slice(0, 5) + celex.slice(7);      // year + number, type-agnostic
    const rank = RANK[type] ?? 5;
    const prior = best.get(caseKey);
    if (prior && prior.rank <= rank) continue;
    best.set(caseKey, {
      rank,
      celex,
      caseNumber: `${type.startsWith("T") ? "T" : "C"}-${Number(celex.slice(7))}/${celex.slice(3, 5)}`,
      type,
      description: DOC_TYPES[type] || "document",
      date: r.date || null,
      title: String(r.title).replace(/#/g, " | ").replace(/\s+/g, " ").trim(),
      url: uiUrl(celex, language),
    });
  }
  const out = [...best.values()]
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, Number(limit) || 20)
    .map(({ rank, ...rest }) => rest);
  return out;
}

export { fetchText, metadata, normalizeCelex };
