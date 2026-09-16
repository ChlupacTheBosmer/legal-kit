/**
 * ÚOOÚ — Úřad pro ochranu osobních údajů, the Czech data protection authority.
 *
 * Its guidance is the thing that most often settles a GDPR question the statute
 * leaves open, and it is published as ordinary web articles with no search API
 * worth the name. So it is mirrored into a local SQLite FTS5 index.
 *
 * Two sources, both public:
 *   GET /api/articles          the site's own JSON feed — every article with its
 *                              full HTML body, publication date and URL
 *   a fixed set of section pages under /pravni-ramec/ and /cinnost/, which are
 *   static explanatory pages rather than articles
 *
 * The whole corpus is a few megabytes, so the index is rebuilt rather than
 * incrementally patched; `updated_at` still drives change reporting.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { request } from "./http.js";
import { htmlToText } from "./format.js";
import { DATA_DIR } from "./http.js";
import { ftsQuery, searchWithFallback } from "./czsearch.js";

const SITE = "https://uoou.gov.cz";
const ARTICLES_API = `${SITE}/api/articles`;
export const DB_PATH = process.env.LEX_UOOU_DB || join(DATA_DIR, "uoou.db");

/** Static explanatory pages — not in the articles feed. */
const SECTION_PAGES = [
  "pravni-ramec/ochrana-osobnich-udaju",
  "pravni-ramec/is-org-zdrojove-a-agendove-identifikatory-fyzickych-osob",
  "pravni-ramec/svobodny-pristup-k-informacim",
  "cinnost/ochrana-osobnich-udaju",
  "cinnost/obchodni-sdeleni",
  "cinnost/schengen-informacni-systemy-eu",
  "cinnost/pravo-na-informace",
  "cinnost/zahranici",
  "cinnost/informacni-system-org",
];

/** Press releases (flag 7) restate news articles (flag 1) — keep one copy. */
const FLAG_NAMES = { 1: "novinka / stanovisko", 6: "publikace", 7: "tisková zpráva", 8: "news (EN)", 10: "foto" };

function open(readonly = false) {
  if (readonly && !existsSync(DB_PATH)) {
    throw new Error(
      `The ÚOOÚ index has not been built yet. Run /legal-kit:update (one API call, a few seconds).`
    );
  }
  return new DatabaseSync(DB_PATH);
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      perex TEXT,
      body TEXT,
      url TEXT NOT NULL,
      published TEXT,
      updated TEXT,
      flag INTEGER
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      title, perex, body,
      content='docs', content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `);
}

/** Fetch everything and rebuild the index. Returns a summary. */
export async function build({ onProgress = () => {} } = {}) {
  await mkdir(DATA_DIR, { recursive: true });
  const db = open();
  schema(db);
  // On an external-content FTS5 table, DELETE FROM the index does not clear the
  // inverted index — it needs the content rows to compute delete keys, and they
  // are gone by then. Stale terms then survive a rebuild as phantom matches.
  db.exec("INSERT INTO docs_fts(docs_fts) VALUES('delete-all');");
  db.exec("DELETE FROM docs;");

  onProgress("fetching /api/articles …");
  const res = await request(ARTICLES_API, { timeoutMs: 120_000, ttlMs: 0, headers: { Accept: "application/json" } });
  if (res.status !== 200) throw new Error(`ÚOOÚ articles API returned HTTP ${res.status}`);
  const articles = JSON.parse(res.body.toString("utf8")).data || [];

  // Drop the press-release duplicates of news items, and the photo galleries.
  // The same item appears as a news article and as a press release, sometimes a
  // day apart. Treat same title within a week as one document; a genuine
  // re-issue years later is a different document and is kept.
  const byTitle = new Map();
  const keep = [];
  for (const a of articles.sort((x, y) => (x.flag_id ?? 99) - (y.flag_id ?? 99))) {
    if (a.flag_id === 10) continue;
    // Normalise: the feed contains pairs differing only by non-breaking spaces.
    const title = (a.title || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
    const when = Date.parse(a.publish_at || "") || 0;
    const prior = byTitle.get(title) || [];
    if (prior.some((t) => Math.abs(t - when) < 7 * 86_400_000)) continue;
    byTitle.set(title, [...prior, when]);
    keep.push(a);
  }

  const insert = db.prepare(
    "INSERT OR REPLACE INTO docs (id, kind, title, perex, body, url, published, updated, flag) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  for (const a of keep) {
    insert.run(
      a.id,
      "article",
      a.title || "(bez názvu)",
      a.perex || null,
      htmlToText(a.text || "") || null,
      a.full_url || `${SITE}/${a.url}`,
      a.publish_at ? String(a.publish_at).slice(0, 10) : null,
      a.updated_at ? String(a.updated_at).slice(0, 10) : null,
      a.flag_id ?? null
    );
  }
  onProgress(`stored ${keep.length} articles (${articles.length - keep.length} duplicates/galleries skipped)`);

  let pages = 0;
  for (const [i, path] of SECTION_PAGES.entries()) {
    try {
      const r = await request(`${SITE}/${path}`, { timeoutMs: 60_000, ttlMs: 0 });
      if (r.status !== 200) continue;
      const html = r.body.toString("utf8");
      const main = html.match(/id="mainblock"([\s\S]*?)(?:<footer|<\/main)/i);
      const body = htmlToText((main ? main[1] : html).replace(/<svg[\s\S]*?<\/svg>/gi, " "));
      const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.split("|")[0].trim() || path;
      insert.run(-(i + 1), "page", title, null, body, `${SITE}/${path}`, null, null, null);
      pages++;
    } catch {
      /* a missing section page is not fatal */
    }
  }
  onProgress(`stored ${pages} section pages`);

  db.exec("INSERT INTO docs_fts(rowid, title, perex, body) SELECT id, title, perex, body FROM docs;");
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('built_at', ?)").run(new Date().toISOString());
  const { n } = db.prepare("SELECT COUNT(*) n FROM docs").get();
  const range = db.prepare("SELECT MIN(published) a, MAX(published) b FROM docs WHERE published IS NOT NULL").get();
  db.close();
  return { documents: n, articles: keep.length, pages, oldest: range.a, newest: range.b };
}

export function search({ query, from, to, kind, limit = 10 }) {
  const db = open(true);
  try {
    const run = (expr) => {
      const where = ["docs_fts MATCH ?"];
      const args = [expr];
      if (from) { where.push("d.published >= ?"); args.push(from); }
      if (to) { where.push("d.published <= ?"); args.push(to); }
      if (kind) { where.push("d.kind = ?"); args.push(kind); }
      args.push(Math.min(Number(limit) || 10, 50));
      return db.prepare(`
        SELECT d.id, d.kind, d.title, d.perex, d.url, d.published, d.flag,
               snippet(docs_fts, 2, '«', '»', ' … ', 24) AS snip,
               bm25(docs_fts, 8.0, 4.0, 1.0) AS rank
        FROM docs_fts JOIN docs d ON d.id = docs_fts.rowid
        WHERE ${where.join(" AND ")}
        ORDER BY rank
        LIMIT ?
      `).all(...args);
    };
    const { rows, matched } = searchWithFallback(query, run, (r) => `${r.title} ${r.perex || ""} ${r.snip || ""}`);
    const built = db.prepare("SELECT value FROM meta WHERE key='built_at'").get();
    const total = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
    return { rows, matched, builtAt: built?.value || null, corpus: total };
  } finally {
    db.close();
  }
}

export function get(idOrUrl) {
  const db = open(true);
  try {
    const byId = /^-?\d+$/.test(String(idOrUrl));
    const row = byId
      ? db.prepare("SELECT * FROM docs WHERE id = ?").get(Number(idOrUrl))
      : db.prepare("SELECT * FROM docs WHERE url = ? OR url LIKE ?").get(String(idOrUrl), `%${String(idOrUrl)}%`);
    if (!row) throw new Error(`No ÚOOÚ document matches "${idOrUrl}". Use cz_guidance_search to find one.`);
    return row;
  } finally {
    db.close();
  }
}

export function stats() {
  const db = open(true);
  try {
    const n = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
    const byKind = db.prepare("SELECT kind, COUNT(*) n FROM docs GROUP BY kind").all();
    const range = db.prepare("SELECT MIN(published) a, MAX(published) b FROM docs WHERE published IS NOT NULL").get();
    const built = db.prepare("SELECT value FROM meta WHERE key='built_at'").get();
    return { documents: n, byKind, oldest: range.a, newest: range.b, builtAt: built?.value || null,
             ageDays: built ? Math.floor((Date.now() - Date.parse(built.value)) / 86_400_000) : null };
  } finally {
    db.close();
  }
}

export const flagName = (f) => FLAG_NAMES[f] || "dokument";
export const dbExists = () => existsSync(DB_PATH);
