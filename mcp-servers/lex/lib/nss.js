/**
 * Nejvyšší správní soud (Supreme Administrative Court) and the regional courts
 * sitting in their administrative agenda — via vyhledavac.nssoud.cz.
 *
 * Why this matters here: Czech environmental law is administrative law almost
 * throughout. Judicial review of an EIA opinion, an integrated permit, a ČIŽP
 * penalty, or the standing of an environmental association under § 70 of Act
 * No. 114/1992 Coll. is decided by the regional administrative senates and, on
 * cassation, by NSS. None of it appears in the Ministry of Justice open-data
 * feed that `justice.js` indexes: that feed carries the civil and criminal
 * dockets only. Without this module the whole body is invisible.
 *
 * Why live search rather than a local mirror. The other Czech sources here are
 * mirrored because their upstream has no subject query worth the name. This one
 * does: the court's own search engine offers a controlled subject vocabulary
 * (Oblast úpravy), provision-level filtering down to § / odst. / písm. of a
 * named act, court and senate, date ranges, and full text with genuine Czech
 * lemmatisation (a query for "kácení dřevin" is expanded to every inflected
 * form by the server). A local index would be worse on every axis except
 * offline use, and would cost tens of thousands of requests to build. What is
 * cached locally is only the controlled vocabularies, so `cz_nss_areas` is
 * instant and the subject terms can be browsed the way `cz_us_keywords` is.
 *
 * The interface is an ASP.NET MVC form with an anti-forgery token and deeply
 * nested model binding, so a query means: GET the form, carry every control
 * forward, set the ones we want, POST it back. The tree-valued controls bind
 * through a companion field `<name>Selected` holding comma-separated numeric
 * ids, which the visible input does not carry.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, request, todayISO } from "./http.js";
import { decodeEntities, htmlToText } from "./format.js";

const BASE = "https://vyhledavac.nssoud.cz";
const VOCAB_PATH = process.env.LEX_NSS_VOCAB || join(DATA_DIR, "nss-vocab.json");
const VOCAB_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Bump when the parsed vocabulary shape changes, so stale caches are refetched. */
const VOCAB_FORMAT = 2;

/* ------------------------------------------------------------------ form */

/**
 * The court's own technical name for each criterion we drive.
 *
 * Deliberately keyed on `TechnickyNazev` rather than on the control's position
 * in the form. The form's control names are index paths generated per render
 * (`vyhledavaciSekce[2].vyhledavaciPodminka[1].vyhledavaciPodminkaHodnota[4]…`),
 * so anything that hardcodes those indexes breaks the first time the court adds
 * or reorders a criterion. The technical names are the stable identifiers, and
 * every render carries them in hidden inputs beside the control they describe,
 * so the index path is discovered at query time instead of assumed.
 */
const CRITERION = {
  court: "soudsenat",
  caseNumber: "oznacenivecivcelku",
  decided: "datumvydanirozhodnuti",
  published: "aktualizovano",
  area: "oblastupravy",
  provArticle: "aplikovanepravnipredpisysbcl",
  provSection: "aplikovanepravnipredpisysb§",
  provPara: "aplikovanepravnipredpisysbodst",
  provLetter: "aplikovanepravnipredpisysbpism",
  provKind: "aplikovanepravnipredpisysbpredpis",
  provNumber: "aplikovanepravnipredpisysbcislo",
  provYear: "aplikovanepravnipredpisysbrok",
  text: "textDokumentu",
  register: "oznacenivecidelenerejstrikovaznacka",
};

/** Which criterion supplies which controlled vocabulary. */
const VOCAB_SOURCE = { areas: "area", courts: "court", registers: "register" };

/**
 * Map every criterion's technical name to the control names of this render.
 *
 * A `TechnickyNazev` hidden input sits at
 * `…vyhledavaciPodminkaHodnota[k].TechnickyNazev`; the value control shares
 * that prefix and differs only in its suffix (HodnotaText, HodnotaCislo,
 * HodnotaCiselnikPolozky, HodnotaDatumACasOd/Do). So: find the marker, take its
 * prefix, and collect every control under it.
 */
function discoverFields(controls) {
  const byPrefix = new Map();
  for (const c of controls) {
    const m = /^(.*\.vyhledavaciPodminkaHodnota\[\d+\]\.)([A-Za-z]+)$/.exec(c.name);
    if (!m) continue;
    const [, prefix, suffix] = m;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, {});
    byPrefix.get(prefix)[suffix] = c.value;
  }
  const fields = {};
  for (const [prefix, entry] of byPrefix) {
    const tech = entry.TechnickyNazev;
    if (!tech) continue;
    const suffix = ["HodnotaText", "HodnotaCislo", "HodnotaCiselnikPolozky", "HodnotaDatumACasOd"]
      .find((s) => s in entry);
    if (!suffix) continue;
    fields[tech] = {
      prefix,
      value: `${prefix}${suffix}`,
      from: `${prefix}HodnotaDatumACasOd`,
      to: `${prefix}HodnotaDatumACasDo`,
      tree: `${prefix}ciselnikTreeData` in entry ? entry[`${prefix}ciselnikTreeData`] : null,
      isTree: suffix === "HodnotaCiselnikPolozky",
    };
  }
  // The tree payload is a sibling control, so pick it up by name.
  for (const c of controls) {
    const m = /^(.*\.vyhledavaciPodminkaHodnota\[\d+\]\.)ciselnikTreeData$/.exec(c.name);
    if (!m) continue;
    const f = Object.values(fields).find((x) => x.prefix === m[1]);
    if (f) f.tree = c.value;
  }
  return fields;
}

/** The control names for one criterion, or a clear error naming what changed. */
function fieldFor(fields, key) {
  const tech = CRITERION[key];
  const f = fields[tech];
  if (!f) {
    throw new Error(
      `vyhledavac.nssoud.cz no longer exposes the search criterion "${tech}". ` +
        `The court has changed its search form; this tool needs updating.`
    );
  }
  return f;
}

function parseControls(html) {
  const i = html.indexOf('<form id="findform"');
  if (i < 0) throw new Error("vyhledavac.nssoud.cz did not return the search form. The site may be down or redesigned.");
  const seg = html.slice(i, html.indexOf("</form>", i));
  const out = [];
  for (const m of seg.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    const name = /\bname="([^"]*)"/.exec(attrs);
    if (!name) continue;
    const type = (/\btype="([^"]*)"/.exec(attrs) || [, "text"])[1];
    // Unchecked radios and boxes are not submitted by a browser either.
    if ((type === "radio" || type === "checkbox") && !/\bchecked\b/.test(attrs)) continue;
    const value = /\bvalue="([^"]*)"/.exec(attrs);
    out.push({ name: decodeEntities(name[1]), value: value ? decodeEntities(value[1]) : "", type });
  }
  return out;
}

/**
 * Parse a `ciselnikTreeData` payload into a flat list that remembers the
 * hierarchy. The payload is JS object literals with unquoted keys, not JSON:
 * `[{id:8147,title:"krajské soudy",subs:[{id:276,title:"Krajský soud v Brně"}]}]`.
 *
 * The hierarchy has to survive, because the court's search does not cascade a
 * parent selection down to its children: submitting the id of "krajské soudy"
 * on its own matches nothing at all. Each entry therefore carries the ids that
 * must be submitted to mean it.
 */
function parseTree(raw) {
  // Quote the bare keys, skipping anything inside a string literal, then parse
  // as JSON. A regex over the whole payload would also rewrite a title that
  // happened to contain "id:" or "subs:".
  let json = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      json += ch;
      if (ch === "\\") { json += raw[++i] ?? ""; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; json += ch; continue; }
    const key = /^(id|title|subs)\s*:/.exec(raw.slice(i));
    if (key && (json.endsWith("{") || json.endsWith(","))) {
      json += `"${key[1]}":`;
      i += key[0].length - 1;
      continue;
    }
    json += ch;
  }
  let tree;
  try {
    tree = JSON.parse(json);
  } catch {
    throw new Error("vyhledavac.nssoud.cz returned a vocabulary this version cannot parse; the site may have changed.");
  }

  const out = [];
  const walk = (nodes, parent) => {
    for (const n of nodes || []) {
      const entry = { id: n.id, title: n.title, parent: parent?.title || null, ids: [n.id] };
      out.push(entry);
      if (n.subs?.length) {
        const before = out.length;
        walk(n.subs, entry);
        // A parent means itself plus everything under it.
        entry.ids = [n.id, ...out.slice(before).flatMap((c) => c.ids)];
        entry.children = out.slice(before).filter((c) => c.parent === entry.title).length;
      }
    }
  };
  walk(tree, null);
  return out;
}

async function fetchForm() {
  // ttlMs 0: the anti-forgery token and its cookie must be a matched live pair.
  const res = await request(`${BASE}/`, { ttlMs: 0, timeoutMs: 60_000 });
  if (res.status !== 200) throw new Error(`vyhledavac.nssoud.cz returned HTTP ${res.status} for the search form.`);
  const html = res.body.toString("utf8");
  const cookie = String(res.headers["set-cookie"] || "")
    .split(/,(?=[^;]+?=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
  return { html, cookie, controls: parseControls(html) };
}

/* ----------------------------------------------------------- vocabulary */

function extractVocab(html) {
  const fields = discoverFields(parseControls(html));
  const vocab = {};
  for (const [key, criterion] of Object.entries(VOCAB_SOURCE)) {
    const raw = fields[CRITERION[criterion]]?.tree;
    vocab[key] = raw ? parseTree(raw) : [];
  }
  return vocab;
}

/**
 * The controlled vocabularies, cached on disk. `Oblast úpravy` is the court's
 * own subject index and is the right way to phrase a subject query, the way
 * cz_us_keywords is for the Constitutional Court.
 */
export async function vocabulary({ refresh = false } = {}) {
  if (!refresh) {
    try {
      const cached = JSON.parse(await readFile(VOCAB_PATH, "utf8"));
      // Re-fetch when the cached shape predates the current parser, otherwise a
      // stale file silently deprives every entry of its descendant ids.
      if (cached.format === VOCAB_FORMAT && Date.now() - Date.parse(cached.fetched_at) < VOCAB_TTL_MS) return cached;
    } catch {
      /* fall through to a fetch */
    }
  }
  const { html } = await fetchForm();
  const vocab = { format: VOCAB_FORMAT, fetched_at: new Date().toISOString(), ...extractVocab(html) };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(VOCAB_PATH, JSON.stringify(vocab, null, 1));
  return vocab;
}

const fold = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Resolve a subject/court term to its numeric id. Exact fold-match first, then
 * a unique substring match. An ambiguous term is an error naming the
 * candidates rather than a silent pick: picking one would produce a confident
 * answer about the wrong subject area.
 */
export function resolveTerm(entries, term, what) {
  const raw = String(term).trim();
  if (/^\d+$/.test(raw)) return { id: Number(raw), title: entries.find((e) => e.id === Number(raw))?.title || raw };
  const f = fold(raw);
  const exact = entries.filter((e) => fold(e.title) === f);
  if (exact.length === 1) return exact[0];
  const partial = entries.filter((e) => fold(e.title).includes(f));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    throw new Error(
      `"${term}" matches ${partial.length} ${what} terms: ${partial.map((e) => `"${e.title}"`).join(", ")}. ` +
        `Use the full term or its numeric id.`
    );
  }
  throw new Error(
    `"${term}" is not one of the court's ${what} terms. List them with cz_nss_areas` +
      (what === "subject" ? "" : ' (courts: pass `court` a name such as "Nejvyšší správní soud")') +
      ` and use the court's own wording.`
  );
}

/* --------------------------------------------------------------- search */

const czDate = (iso) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) throw new Error(`Dates must be ISO (YYYY-MM-DD); got "${iso}".`);
  return `${m[3]}.${m[2]}.${m[1]}`;
};

const COUNT_RE = /Po[^<]{0,4}et nalezen[^<]{0,8}ch z[^<]{0,8}znam[^<]{0,4}:\s*(\d+)/;

/**
 * Rows of the result table, read by column heading rather than by position.
 *
 * Which columns are visible depends on the result-view the form was submitted
 * with, so a fixed cell index silently reads the wrong column when that changes.
 */
function parseRows(html) {
  const clean = (s) =>
    decodeEntities(String(s).replace(/<[^>]+>/g, " "))
      .replace(/\u00a0/g, " ")
      .replace(/&nbsp;?/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const table = [...html.matchAll(/<table[\s\S]*?<\/table>/g)]
    .map((m) => m[0])
    .find((t) => /ZobrazeneVysledky\[\d+\]\.ID/.test(t));
  if (!table) return [];

  const trs = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  const headerRow = trs.find((r) => /<th\b/.test(r));
  const header = headerRow
    ? [...headerRow.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((c) =>
        clean(c[1].replace(/<button[\s\S]*?<\/button>/g, " "))
      )
    : [];
  const at = (cells, ...labels) => {
    for (const label of labels) {
      const i = header.findIndex((h) => h && h.toLowerCase().startsWith(label.toLowerCase()));
      if (i >= 0 && cells[i]) return cells[i];
    }
    return null;
  };

  const rows = [];
  for (const tr of trs) {
    const id = /name="ZobrazeneVysledky\[\d+\]\.ID"[^>]*value="(\d+)"/.exec(tr);
    if (!id) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => clean(c[1]));
    const citation = /title="Citace: ([^"]*)"/.exec(tr);
    rows.push({
      id: id[1],
      decided: at(cells, "Datum"),
      case_number: at(cells, "Číslo jednací", "Označení věci"),
      court: at(cells, "Soud"),
      doc_type: at(cells, "Druh dokumentu"),
      outcome: at(cells, "Výrok"),
      legal_thesis: at(cells, "Právní věta"),
      parties: at(cells, "Účastníci", "Účastník"),
      citation: citation ? clean(citation[1]) : null,
    });
  }
  return rows;
}

/**
 * Search NSS and the regional administrative courts.
 *
 * Every criterion is ANDed. `text` goes to the court's own full-text engine,
 * which lemmatises Czech, so the base form of a term is the right thing to
 * pass; there is no need to enumerate inflections.
 */
export async function search({
  text: fulltext,
  area,
  court,
  case_number,
  provision,
  decided_from,
  decided_to,
  published_from,
  published_to,
  limit = 20,
} = {}) {
  const criteria = [];
  const { html, cookie, controls } = await fetchForm();
  const fields = discoverFields(controls);
  const vocab = { ...extractVocab(html) };

  const body = new URLSearchParams();
  for (const c of controls) body.append(c.name, c.value);

  const setText = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    body.set(fieldFor(fields, key).value, String(value));
  };
  const setDate = (key, which, iso) => {
    if (!iso) return;
    const f = fieldFor(fields, key);
    body.set(which === "from" ? f.from : f.to, czDate(iso));
  };
  /**
   * Set a tree-valued control. The visible input holds the label; the companion
   * `<name>Selected` field holds the ids, and only that companion field is what
   * the server binds. A parent node is submitted as itself plus every
   * descendant, because the court's search does not cascade a parent selection.
   */
  const setTree = (key, entries, terms, what) => {
    const list = terms == null ? [] : Array.isArray(terms) ? terms : [terms];
    if (!list.length) return null;
    const f = fieldFor(fields, key);
    const hits = list.map((t) => resolveTerm(entries, t, what));
    body.set(f.value, hits.map((h) => h.title).join(", "));
    body.append(`${f.value}Selected`, hits.flatMap((h) => h.ids || [h.id]).join(","));
    return hits;
  };

  if (fulltext) { setText("text", fulltext); criteria.push(`text: "${fulltext}"`); }
  if (case_number) { setText("caseNumber", case_number); criteria.push(`case number: ${case_number}`); }

  // Several subject areas widen the search, as they do on the court's own form.
  const areaHits = setTree("area", vocab.areas, area, "subject");
  if (areaHits) criteria.push(`subject area: ${areaHits.map((h) => `"${h.title}"`).join(" or ")}`);

  const courtHits = setTree("court", vocab.courts, court, "court");
  if (courtHits) criteria.push(`court: ${courtHits.map((h) => `"${h.title}"`).join(" or ")}`);

  if (provision) {
    const { article, section, paragraph, letter, kind = "zákona", number, year } = provision;
    if (!number || !year) {
      throw new Error(
        "A provision filter needs at least the act's `number` and `year`, e.g. {section:'56', number:114, year:1992}."
      );
    }
    setText("provArticle", article);
    setText("provSection", section);
    setText("provPara", paragraph);
    setText("provLetter", letter);
    setText("provNumber", number);
    setText("provYear", year);
    const kinds = parseTree(fieldFor(fields, "provKind").tree || "[]");
    const kindHit = setTree("provKind", kinds, kind, "instrument kind")[0];
    const label = [
      article ? `čl. ${article}` : null,
      section ? `§ ${section}` : null,
      paragraph ? `odst. ${paragraph}` : null,
      letter ? `písm. ${letter}` : null,
    ].filter(Boolean).join(" ");
    criteria.push(`applies ${label || "any provision"} of ${kindHit.title} č. ${number}/${year} Sb.`);
  }

  if (decided_from) { setDate("decided", "from", decided_from); criteria.push(`decided from ${decided_from}`); }
  if (decided_to) { setDate("decided", "to", decided_to); criteria.push(`decided to ${decided_to}`); }
  if (published_from) { setDate("published", "from", published_from); criteria.push(`released from ${published_from}`); }
  if (published_to) { setDate("published", "to", published_to); criteria.push(`released to ${published_to}`); }

  if (!criteria.length) {
    throw new Error(
      "A search needs at least one criterion. Give `text` (Czech), an `area` from cz_nss_areas, " +
        "a `provision`, a `case_number`, or a date range."
    );
  }

  body.append("btSubmit", "");
  const res = await request(`${BASE}/`, {
    method: "POST",
    ttlMs: 0,
    timeoutMs: 120_000,
    cacheable: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
      Referer: `${BASE}/`,
      Accept: "text/html",
    },
    body: body.toString(),
  });
  const page = res.body.toString("utf8");
  const count = COUNT_RE.exec(decodeEntities(page));
  if (!count) {
    // The form re-renders without a count when a control failed to bind.
    throw new Error(
      "vyhledavac.nssoud.cz returned the form rather than a result set, which means a search criterion " +
        "was rejected. Check the subject term against cz_nss_areas and the dates against YYYY-MM-DD."
    );
  }
  const rows = parseRows(page).slice(0, limit);
  return { total: Number(count[1]), rows, criteria, shown: rows.length };
}

/* --------------------------------------------------------------- detail */

const LABELS = {
  "ECLI": "ecli",
  "Soud (senát)": "court",
  "Soudce zpravodaj": "rapporteur",
  "Sb NSS publikováno": "published_in_collection",
  "Právní věta": "has_legal_thesis",
  "Datum vydání rozhodnutí": "decided",
  "Datum právní moci": "final_on",
  "Datum zpřístupnění": "released",
  "Druh dokumentu": "doc_type",
  "Typ řízení": "proceeding_type",
  "Výrok rozhodnutí NSS": "outcome",
  "Oblast úpravy": "area",
  "Aplikováno právo EU": "eu_law_applied",
};

/**
 * The document record: ECLI, whether it is published in the official
 * collection (Sbírka rozhodnutí NSS, the weight indicator), the provisions it
 * applies, the precedents it relies on, and the parties.
 */
export async function detail(id) {
  const res = await request(`${BASE}/DokumentDetail/Index/${encodeURIComponent(id)}`, {
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    timeoutMs: 60_000,
  });
  if (res.status !== 200) throw new Error(`No NSS document ${id} (HTTP ${res.status}). Ids come from cz_nss_search.`);
  const html = res.body.toString("utf8");
  const flat = decodeEntities(
    html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, "\n")
  )
    .split("\n")
    .map((l) => l.replace(/ /g, " ").trim())
    .filter(Boolean);

  const out = { id: String(id), url: `${BASE}/DokumentDetail/Index/${id}` };
  for (let i = 0; i < flat.length; i++) {
    const label = flat[i].replace(/\s*:\s*$/, "");
    if (LABELS[label] && flat[i].endsWith(":") && flat[i + 1] && !flat[i + 1].endsWith(":")) {
      const key = LABELS[label];
      if (out[key] === undefined) out[key] = flat[i + 1];
    }
  }
  // The structured blocks are real tables. Read them as tables: flattening to
  // lines first drops the empty cells, and with them the column positions, so
  // "§ 56 odst. 1" and "čl. 56 odst. 1" become indistinguishable.
  const tables = readTables(html);

  out.provisions = (tableWithHeader(tables, ["§", "předpis", "rok"]) || []).map((r) => ({
    article: r["čl."] || null,
    section: r["§"] || null,
    paragraph: r["odst."] || null,
    letter: r["písm."] || null,
    kind: r["předpis"] || null,
    act: r["číslo"] && r["rok"] ? `${r["číslo"]}/${r["rok"]} Sb.` : null,
    citation: czProvision(r),
  }));

  // Precedents carry their own weight markers: whether the cited decision is
  // in the official collection (Sb. NSS), and how this decision treats it.
  const seen = new Set();
  out.precedents = (tableWithHeader(tables, ["Prejudikatura označení věci v celku"]) || [])
    .map((r) => ({
      case_number: r["Prejudikatura označení věci v celku"],
      court: r["Název orgánu"] || null,
      collection: r["Identifikace ve sbírkách"]
        ? `${r["Identifikace ve sbírkách"]} ${r["sešit"]}/${r["judikát"]}/${r["rok"]}`.trim()
        : null,
      weight: r["Povaha"] || null,
      treatment: r["Druh"] || null,
    }))
    .filter((p) => p.case_number && !seen.has(p.case_number) && seen.add(p.case_number));

  out.parties = (tableWithHeader(tables, ["Účastník řízení", "Typ účastníka"]) || [])
    .map((r) => ({ name: r["Účastník řízení"], role: r["Typ účastníka"] }))
    .filter((p) => p.name);

  // The administrative decision actually challenged, and the regional court
  // judgment under cassation. Both were previously lost, and the second was
  // being misread as a precedent, which is a different thing entirely.
  const admin = (tableWithHeader(tables, ["Název správního orgánu"]) || [])[0];
  out.under_review = admin?.["Název správního orgánu"]
    ? {
        authority: admin["Název správního orgánu"],
        reference: admin["Sp. zn./čj. rozhodnutí správního orgánu"] || null,
        dated: admin["Datum napadeného rozhodnutí"] || null,
      }
    : null;

  const below = (tableWithHeader(tables, ["Krajský soud", "Označení rozhodnutí KS v celku"]) || [])[0];
  out.court_below = below?.["Krajský soud"]
    ? {
        court: below["Krajský soud"],
        case_number: below["Označení rozhodnutí KS v celku"] || null,
        decided: below["Datum rozhodnutí krajského soudu"] || null,
        outcome_on_cassation: below["Rozhodnuto NSS"] || null,
      }
    : null;

  // An unknown id is answered with HTTP 200 and an empty shell, not a 404. Say
  // so, rather than handing back a record with every field missing, which reads
  // as "this decision exists and records nothing".
  if (!out.ecli && !out.court && !out.decided && !out.provisions.length) {
    throw new Error(
      `No NSS document ${id}. The site answers an unknown id with an empty page rather than an error. ` +
        `Ids come from cz_nss_search.`
    );
  }

  return out;
}

/** Every table on the page, as { header: [...], rows: [{col: value}] }. */
function readTables(html) {
  const cellText = (c) =>
    decodeEntities(c.replace(/<[^>]+>/g, " "))
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const out = [];
  for (const t of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const trs = [...t[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((tr) =>
      [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => cellText(c[1]))
    );
    if (trs.length < 2) continue;
    const [header, ...body] = trs;
    out.push({
      header,
      rows: body
        .filter((r) => r.some(Boolean))
        .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] || ""]))),
    });
  }
  return out;
}

/** The rows of the first table whose header contains all of `cols`. */
function tableWithHeader(tables, cols) {
  const t = tables.find((x) => cols.every((c) => x.header.includes(c)));
  return t ? t.rows : null;
}

/** Render a provisions row the way a Czech lawyer writes it. */
function czProvision(r) {
  if (!r["číslo"] || !r["rok"]) return null;
  const parts = [
    r["čl."] ? `čl. ${r["čl."]}` : null,
    r["§"] ? `§ ${r["§"]}` : null,
    r["odst."] ? `odst. ${r["odst."]}` : null,
    r["písm."] ? `písm. ${r["písm."]}` : null,
  ].filter(Boolean);
  const kind = r["předpis"] || "zákona";
  return `${parts.join(" ")} ${kind} č. ${r["číslo"]}/${r["rok"]} Sb.`.trim();
}

/* ----------------------------------------------------------------- text */

/**
 * Decide the encoding from the bytes, falling back to the declared charset.
 *
 * This endpoint serves UTF-16LE while most of the site is UTF-8, and the
 * charset is declared only in the Content-Type header. Trusting that header
 * alone is wrong here: on a cache hit `request()` returns an empty header map,
 * so the same document decoded correctly when fetched and as mojibake when
 * replayed from cache — a corruption that produces plausible-looking Czech-less
 * text rather than an error. Sniffing the bytes is right in both cases.
 */
function decodeBody(buf, contentType) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.swap16().toString("utf16le");
  // No BOM: UTF-16LE ASCII-range text interleaves NUL bytes in odd positions.
  const probe = buf.subarray(0, Math.min(buf.length, 512));
  let odd = 0;
  for (let i = 1; i < probe.length; i += 2) if (probe[i] === 0) odd++;
  if (probe.length > 16 && odd / Math.floor(probe.length / 2) > 0.8) return buf.toString("utf16le");
  const charset = /charset=([\w-]+)/i.exec(String(contentType || ""))?.[1]?.toLowerCase();
  if (charset === "utf-16" || charset === "utf-16le") return buf.toString("utf16le");
  return buf.toString("utf8");
}

/** Full text of a decision, including the reasoning. */
export async function fulltext(id) {
  const res = await request(`${BASE}/DokumentOriginal/Text/${encodeURIComponent(id)}`, {
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    timeoutMs: 90_000,
  });
  if (res.status !== 200) throw new Error(`No text for NSS document ${id} (HTTP ${res.status}).`);
  const body = htmlToText(decodeBody(res.body, res.headers["content-type"]));
  if (!body || body.length < 200) {
    throw new Error(
      `NSS document ${id} has no text (the site returned an empty document). Check the id with cz_nss_search.`
    );
  }
  return {
    id: String(id),
    text: body,
    url: `${BASE}/DokumentOriginal/Html/${id}`,
    source: `${BASE}/DokumentOriginal/Text/${id}`,
    retrieved: todayISO(),
  };
}

export const docUrl = (id) => `${BASE}/DokumentDetail/Index/${id}`;
export const SITE = BASE;
