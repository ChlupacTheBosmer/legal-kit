/**
 * Czech full-text search helpers, shared by every local index.
 *
 * Czech is heavily inflected, so exact-token matching fails constantly:
 * "pokuta" does not match "pokuty", "zaměstnanci" does not match "zaměstnanců".
 * SQLite FTS5 has no Czech stemmer, so the query side compensates.
 */

/** Function words. Left in, their prefix forms match most of any corpus. */
export const CZ_STOPWORDS = new Set([
  "pro", "při", "pri", "nad", "pod", "bez", "nebo", "ale", "jako", "také", "take",
  "podle", "které", "ktere", "která", "ktera", "který", "ktery", "být", "byt",
  "jsou", "této", "teto", "tento", "tato", "toto", "jeho", "její", "jeji", "což",
  "coz", "aby", "než", "nez", "tak", "již", "jiz", "více", "vice", "své", "sve",
  "nebo", "resp", "atd",
]);

/**
 * Clip the inflectional tail so a prefix match survives a case change.
 * "pokuta"/"pokuty"/"pokutu" all reduce to "pokut". It over-generates a little;
 * precision comes back from requiring several terms to match.
 */
export function czStem(t) {
  if (t.length >= 7) return t.slice(0, t.length - 3);
  if (t.length >= 5) return t.slice(0, t.length - 2);
  if (t.length === 4) return t.slice(0, 3);
  return t;
}

/** Diacritic- and case-folded text. */
export const fold = (x) =>
  String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The searchable stems of a query, in order, after stopword removal. */
export function queryStems(q) {
  return String(q)
    .replace(/["()*:^]/g, " ")
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3 && !CZ_STOPWORDS.has(t))
    .map(czStem);
}

/** Build an FTS5 expression. `join` is "AND" for precision, "OR" to widen. */
export function ftsQuery(q, join = "AND") {
  const raw = String(q).trim();
  if (!raw) throw new Error("A search needs a query.");
  if (/^".+"$/.test(raw)) return raw; // explicit phrase, verbatim
  const terms = queryStems(raw).map((t) => `"${t}"*`);
  if (!terms.length) {
    throw new Error(`"${q}" has no searchable terms — prepositions and words under three letters are dropped.`);
  }
  return terms.join(` ${join} `);
}

/**
 * Run AND first; if it finds nothing, widen to OR but keep only rows covering
 * at least half the query terms. Without that guard a single common term
 * ("dom"* matching "doména") drags in noise.
 */
export function searchWithFallback(query, run, textOf) {
  let rows = run(ftsQuery(query, "AND"));
  if (rows.length) return { rows, matched: "all terms" };

  const stems = queryStems(query).map(fold);
  // For one- or two-term queries there is no useful middle ground: matching one
  // of two is not a hit, it is noise. Only widen for genuinely longer queries.
  if (stems.length <= 2) return { rows: [], matched: "nothing" };
  const need = Math.ceil(stems.length / 2);
  const scored = run(ftsQuery(query, "OR")).map((r) => {
    const hay = fold(textOf(r));
    return { ...r, covered: stems.filter((s) => hay.includes(s)).length };
  });
  rows = scored.filter((r) => r.covered >= need).sort((a, b) => b.covered - a.covered || a.rank - b.rank);
  return {
    rows,
    matched: rows.length ? `${need}+ of ${stems.length} terms (no record contained all of them)` : "nothing",
  };
}

/**
 * Guard against searching a Czech corpus in English.
 *
 * This is the failure this project is most exposed to: the thinking happens in
 * English, the sources are Czech, and an English query returns nothing —
 * which reads as "no such case law" rather than "wrong language". Silence is
 * the dangerous answer, so refuse loudly instead.
 */
const EN_MARKERS = new Set([
  "the", "and", "for", "with", "law", "act", "court", "data", "personal", "protection",
  "copyright", "trademark", "contract", "consent", "processing", "controller", "processor",
  "decision", "case", "right", "rights", "employee", "employer", "damages", "liability",
  "breach", "notice", "agreement", "company", "trade", "secret", "patent", "design",
  "about", "what", "does", "when", "which", "from", "under", "legal", "obligation",
  // Environmental and administrative vocabulary. Without these, a query like
  // "environmental impact assessment" scored zero English markers and sailed
  // past the guard into a Czech corpus — the exact silence this guard exists
  // to prevent. A marker list is only as good as the subjects it covers, so
  // extend it whenever a new area of practice is added.
  "environment", "environmental", "impact", "assessment", "pollution", "emission",
  "emissions", "waste", "water", "air", "nature", "conservation", "habitat", "species",
  "forest", "soil", "landscape", "climate", "energy", "permit", "permits", "permitting",
  "licence", "license", "authorisation", "authorization", "planning", "building",
  "construction", "inspection", "inspectorate", "penalty", "fine", "sanction",
  "remediation", "liability", "damage", "nuisance", "noise", "chemical", "chemicals",
  "hazardous", "landfill", "recycling", "packaging", "biodiversity", "protected",
  "administrative", "appeal", "review", "standing", "association", "public",
  "participation", "information", "authority", "ministry", "municipality", "region",
  "regional", "supreme", "constitutional", "judgment", "ruling", "proceedings",
]);

const CZ_MARKERS = /[áčďéěíňóřšťúůýž]/i;

/**
 * Returns an explanation when the query looks English, otherwise null.
 * A query with Czech diacritics is always accepted.
 */
export function englishQueryWarning(query) {
  const raw = String(query).trim();
  if (!raw || CZ_MARKERS.test(raw)) return null;
  const words = raw.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (!words.length) return null;
  const english = words.filter((w) => EN_MARKERS.has(w)).length;
  if (english === 0) return null;
  if (english / words.length < 0.5) return null;
  return (
    `"${raw}" looks like an English query. This source is Czech and an English query will match nothing, ` +
    `which is easy to mistake for "there is no such case law". Translate the concept into the terms Czech ` +
    `lawyers actually use — cz_us_keywords lists the Constitutional Court's own index vocabulary — and search ` +
    `with several Czech variants rather than one.`
  );
}
