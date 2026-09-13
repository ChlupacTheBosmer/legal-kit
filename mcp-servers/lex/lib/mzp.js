/**
 * MŽP — Ministerstvo životního prostředí, the Czech Ministry of the
 * Environment: the Věstník MŽP and the ministry's methodological guidance,
 * mirrored into a local SQLite FTS5 index.
 *
 * Why it earns a mirror. For a Czech environmental question the ministry's
 * methodological instruction is often what decides how a provision is applied
 * in practice, the way ÚOOÚ guidance decides a GDPR question the Regulation
 * leaves open. The Věstník is more than that again: the ministry states on its
 * own page that publication there is a condition of validity of the resort
 * instruments it carries ("uveřejnění ve Věstníku je podmínkou jejich
 * platnosti"), so an instrument that is not in it is not in force.
 *
 * What this is not: none of it is binding law. A methodological instruction
 * binds subordinate authorities administratively and a court may depart from
 * it. The search tool says so on every result, because the distinction between
 * the rule and the regulator's reading of the rule is the one most easily lost
 * once both are full-text searchable in the same box.
 *
 * Sources, all public:
 *   /cz/sitemap.xml                      every content page, by section
 *   the Věstník view, filtered by year   the issues, as PDFs
 *   file attachments on content pages    the instructions themselves, as PDFs
 *
 * The site is Drupal and its robots.txt sets Crawl-delay: 10. That is honoured
 * (read from robots.txt rather than hardcoded), which makes a full build slow
 * and resumable rather than fast: pages already fetched are recorded and
 * skipped, so an interrupted build continues where it stopped.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA_DIR, request, sleep } from "./http.js";
import { htmlToText, decodeEntities } from "./format.js";
import { searchWithFallback } from "./czsearch.js";

const execFileAsync = promisify(execFile);

const SITE = "https://www.mzp.gov.cz";
export const DB_PATH = process.env.LEX_MZP_DB || join(DATA_DIR, "mzp.db");

/**
 * Sections worth mirroring, and what to call them. `agenda` pages carry the
 * ministry's standing position on each area of practice; `metodika` is the
 * methodological-documents hub; `legislativa` explains the ministry's reading
 * of its own statutes.
 */
const SECTIONS = [
  { prefix: "/cz/agenda/", kind: "agenda" },
  { prefix: "/cz/ministerstvo/metodicke-dokumenty", kind: "metodika" },
  { prefix: "/cz/ministerstvo/legislativa", kind: "legislativa" },
  { prefix: "/cz/zahranicni-vztahy/mezinarodni-smlouvy", kind: "smlouvy" },
  { prefix: "/cz/pro-media-a-verejnost/poskytovani-informaci", kind: "informace" },
];

/** The service catalogue: 800+ procedural descriptions. Opt in with --katalog. */
const KATALOG = { prefix: "/cz/pro-media-a-verejnost/katalog-sluzeb", kind: "katalog" };

const VESTNIK_PATH = "/cz/pro-media-a-verejnost/vestnik";
const VESTNIK_FILTER = "field_journal_year_value_fsf";

function open(readonly = false) {
  if (readonly && !existsSync(DB_PATH)) {
    throw new Error(
      "The MŽP guidance index has not been built yet. Run:\n" +
        "  node tools/mzp-index.mjs build\n" +
        "(the ministry's robots.txt asks for 10 seconds between requests, so a full build takes a couple " +
        "of hours; it is resumable and can be run in the background.)"
    );
  }
  return new DatabaseSync(DB_PATH);
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT,
      body TEXT,
      published TEXT,
      year INTEGER,
      format TEXT,
      parent_url TEXT,
      bytes INTEGER,
      fetched_at TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      title, section, body,
      content='docs', content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS visited (url TEXT PRIMARY KEY, status INTEGER, done_at TEXT);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE INDEX IF NOT EXISTS idx_kind ON docs(kind);
    CREATE INDEX IF NOT EXISTS idx_year ON docs(year);
  `);
}

/* ------------------------------------------------------------ politeness */

/** Crawl-delay from the site's own robots.txt, in ms. Never below 1s. */
async function crawlDelayMs() {
  try {
    const r = await request(`${SITE}/robots.txt`, { ttlMs: 24 * 60 * 60 * 1000, timeoutMs: 30_000 });
    const m = /^\s*crawl-delay:\s*(\d+(?:\.\d+)?)/im.exec(r.body.toString("utf8"));
    if (m) return Math.max(1000, Number(m[1]) * 1000);
  } catch {
    /* fall through to the conservative default */
  }
  return 10_000;
}

/* ---------------------------------------------------------------- parsing */

const abs = (href) => (href.startsWith("http") ? href : `${SITE}${href.startsWith("/") ? "" : "/"}${href}`);

/** Page title, main text, and the file attachments linked from it. */
function parsePage(html, url) {
  const title =
    decodeEntities((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "")
      .split("|")[0]
      .trim() || url;
  // Drop chrome so the newsletter box and the events calendar do not become
  // searchable text on every single page.
  const main =
    (/<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html) || [])[1] ||
    (/<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html) || [])[1] ||
    html;
  const cleaned = main
    .replace(/<(script|style|nav|header|footer|form|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const body = htmlToText(cleaned);

  const files = [];
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+\.(pdf|docx?|xlsx?|odt|ods|zip))(\?[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decodeEntities(m[4].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .replace(/\((PDF|DOCX?|XLSX?|ODT|ODS|ZIP),?[^)]*\)/i, "")
      .trim();
    files.push({ url: abs(m[1]), format: m[2].toLowerCase(), label: label || m[1].split("/").pop() });
  }
  // A published date, where the page carries one.
  const date =
    (/datetime="(\d{4}-\d{2}-\d{2})/.exec(html) || [])[1] ||
    (/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/.exec(body.slice(0, 400)) || []).slice(1).reverse().join("-") ||
    null;
  return { title, body, files, published: normaliseDate(date) };
}

function normaliseDate(d) {
  if (!d) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
  if (!iso) return null;
  return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
}

/** Text of a PDF. Returns null when no extractor is available on this machine. */
async function pdfText(buf) {
  const tmp = join(tmpdir(), `lex-mzp-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(tmp, buf);
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", tmp, "-"], {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    });
    return stdout;
  } catch (err) {
    if (err?.code === "ENOENT") return null; // pdftotext not installed
    return "";
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function pdfExtractorAvailable() {
  try {
    await execFileAsync("pdftotext", ["-v"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ build */

async function sitemapUrls() {
  const r = await request(`${SITE}/cz/sitemap.xml`, { ttlMs: 6 * 60 * 60 * 1000, timeoutMs: 120_000 });
  const xml = r.body.toString("utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** The years the Věstník facet offers. */
async function vestnikYears() {
  const r = await request(`${SITE}${VESTNIK_PATH}`, { ttlMs: 6 * 60 * 60 * 1000, timeoutMs: 60_000 });
  const html = r.body.toString("utf8");
  const sel = /<select[^>]*name="field_journal_year_value_fsf"[\s\S]*?<\/select>/i.exec(html);
  if (!sel) return [];
  return [...sel[0].matchAll(/value="(\d{4})"/g)].map((m) => Number(m[1])).sort((a, b) => b - a);
}

/**
 * Fetch everything and build the index. Resumable: URLs already recorded in
 * `visited` are skipped unless `refetch` is set.
 */
export async function build({
  onProgress = () => {},
  includeKatalog = false,
  maxPdfBytes = 40 * 1024 * 1024,
  refetch = false,
  delayMs = null,
  limit = null,
} = {}) {
  await mkdir(DATA_DIR, { recursive: true });
  const db = open();
  schema(db);
  if (refetch) {
    db.exec("INSERT INTO docs_fts(docs_fts) VALUES('delete-all');");
    db.exec("DELETE FROM docs; DELETE FROM visited;");
  }

  const robotsDelay = await crawlDelayMs();
  const delay = delayMs ?? robotsDelay;
  const source =
    delayMs == null ? "from robots.txt" : `overridden locally; robots.txt asks for ${robotsDelay / 1000}s`;
  const havePdf = await pdfExtractorAvailable();
  onProgress(
    `crawl delay ${delay / 1000}s (${source}); PDF text extraction ` +
      `${havePdf ? "available" : "NOT available — PDFs will be indexed by title and URL only"}`
  );

  const sections = includeKatalog ? [...SECTIONS, KATALOG] : SECTIONS;
  const all = await sitemapUrls();
  const pages = all
    .map((u) => {
      const path = u.replace(/^https?:\/\/[^/]+/, "");
      const sec = sections.find((s) => path.startsWith(s.prefix));
      return sec ? { url: u.replace(/^https?:\/\/[^/]+/, SITE), kind: sec.kind, path } : null;
    })
    .filter(Boolean);

  const years = await vestnikYears();
  onProgress(
    `sitemap: ${all.length} urls, ${pages.length} in scope; Věstník years: ${years.join(", ") || "none found"}`
  );

  const done = new Set(db.prepare("SELECT url FROM visited").all().map((r) => r.url));
  const mark = db.prepare("INSERT OR REPLACE INTO visited (url, status, done_at) VALUES (?,?,?)");
  const ins = db.prepare(`
    INSERT INTO docs (url, kind, title, section, body, published, year, format, parent_url, bytes, fetched_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(url) DO UPDATE SET
      title=excluded.title, body=excluded.body, published=excluded.published,
      year=excluded.year, bytes=excluded.bytes, fetched_at=excluded.fetched_at
  `);

  let fetched = 0, stored = 0, files = 0, failed = 0, skippedBig = 0;
  const budget = () => limit !== null && fetched >= limit;

  const get = async (url, opts = {}) => {
    if (fetched) await sleep(delay);
    fetched++;
    return request(url, { ttlMs: 0, timeoutMs: 180_000, retries: 1, ...opts });
  };

  /** Index one attachment: the instruction itself, usually a PDF. */
  const storeFile = async (f, parentUrl, section, kind) => {
    if (done.has(f.url) || budget()) return;
    try {
      const r = await get(f.url, { cacheable: false });
      if (r.status !== 200) { mark.run(f.url, r.status, new Date().toISOString()); failed++; return; }
      let body = null;
      if (r.body.length > maxPdfBytes) {
        skippedBig++;
      } else if (f.format === "pdf") {
        body = havePdf ? await pdfText(r.body) : null;
      }
      const year = Number((/\/(\d{4})-\d{2}\//.exec(f.url) || [])[1]) || null;
      ins.run(f.url, kind, f.label, section, body, null, year, f.format, parentUrl, r.body.length, new Date().toISOString());
      mark.run(f.url, r.status, new Date().toISOString());
      done.add(f.url);
      files++; stored++;
    } catch {
      mark.run(f.url, 0, new Date().toISOString());
      failed++;
    }
  };

  // Order matters for an interruptible build. Content pages are HTML and cost
  // roughly the crawl delay each, so they come first and give broad coverage
  // quickly. Věstník issues are large PDFs that take far longer per document,
  // so they follow: a run stopped early then still has the ministry's guidance
  // rather than nothing but back issues.

  // ---- Content pages and their attachments ------------------------------
  for (const [i, p] of pages.entries()) {
    if (budget()) break;
    if (done.has(p.url)) continue;
    try {
      const r = await get(p.url);
      if (r.status !== 200) { mark.run(p.url, r.status, new Date().toISOString()); failed++; continue; }
      const html = r.body.toString("utf8");
      const parsed = parsePage(html, p.url);
      const section = p.path.split("/").slice(2, 4).join(" / ");
      ins.run(p.url, p.kind, parsed.title, section, parsed.body, parsed.published, null, "html", null, html.length, new Date().toISOString());
      mark.run(p.url, 200, new Date().toISOString());
      done.add(p.url);
      stored++;
      for (const f of parsed.files) await storeFile(f, p.url, section, "dokument");
      if (i % 20 === 0) onProgress(`pages ${i + 1}/${pages.length} · stored ${stored} · files ${files} · failed ${failed}`);
    } catch {
      mark.run(p.url, 0, new Date().toISOString());
      failed++;
    }
  }

  // ---- Věstník, year by year, newest first -------------------------------
  for (const year of years) {
    if (budget()) break;
    const listUrl = `${SITE}${VESTNIK_PATH}?${VESTNIK_FILTER}=${year}`;
    try {
      const r = await get(listUrl);
      if (r.status !== 200) { failed++; continue; }
      const { files: attached } = parsePage(r.body.toString("utf8"), listUrl);
      const issues = attached.filter((f) => /vestnik/i.test(f.url));
      onProgress(`Věstník ${year}: ${issues.length} file(s)`);
      for (const f of issues) await storeFile(f, listUrl, `Věstník MŽP ${year}`, "vestnik");
    } catch {
      failed++;
    }
  }

  db.exec("INSERT INTO docs_fts(docs_fts) VALUES('delete-all');");
  db.exec("INSERT INTO docs_fts(rowid, title, section, body) SELECT id, title, section, body FROM docs;");
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('built_at', ?)").run(new Date().toISOString());
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('pdf_text', ?)").run(String(havePdf));
  const n = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
  const byKind = db.prepare("SELECT kind, COUNT(*) n FROM docs GROUP BY kind ORDER BY n DESC").all();
  const withText = db.prepare("SELECT COUNT(*) n FROM docs WHERE body IS NOT NULL AND LENGTH(body) > 200").get().n;
  db.close();
  return { documents: n, stored, files, failed, skippedBig, fetched, byKind, withText, pdfText: havePdf };
}


/* ----------------------------------------------------------------- search */

export function search({ query, kind, from, to, year, limit = 10 }) {
  const db = open(true);
  try {
    const run = (expr) => {
      const where = ["docs_fts MATCH ?"];
      const args = [expr];
      if (kind) { where.push("d.kind = ?"); args.push(kind); }
      if (year) { where.push("d.year = ?"); args.push(Number(year)); }
      if (from) { where.push("(d.published >= ? OR d.year >= ?)"); args.push(from, Number(String(from).slice(0, 4))); }
      if (to) { where.push("(d.published <= ? OR d.year <= ?)"); args.push(to, Number(String(to).slice(0, 4))); }
      args.push(Math.min(Number(limit) || 10, 50));
      return db.prepare(`
        SELECT d.id, d.url, d.kind, d.title, d.section, d.published, d.year, d.format, d.parent_url,
               snippet(docs_fts, 2, '«', '»', ' … ', 28) AS snip,
               bm25(docs_fts, 8.0, 2.0, 1.0) AS rank
        FROM docs_fts JOIN docs d ON d.id = docs_fts.rowid
        WHERE ${where.join(" AND ")}
        ORDER BY rank
        LIMIT ?
      `).all(...args);
    };
    const { rows, matched } = searchWithFallback(query, run, (r) => `${r.title} ${r.section || ""} ${r.snip || ""}`);
    const built = db.prepare("SELECT value FROM meta WHERE key='built_at'").get();
    const pdf = db.prepare("SELECT value FROM meta WHERE key='pdf_text'").get();
    const total = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
    const noText = db.prepare("SELECT COUNT(*) n FROM docs WHERE (body IS NULL OR LENGTH(body) < 200)").get().n;
    return {
      rows, matched, corpus: total, noText,
      builtAt: built?.value || null,
      pdfText: pdf?.value === "true",
      ageDays: built ? Math.floor((Date.now() - Date.parse(built.value)) / 86_400_000) : null,
    };
  } finally {
    db.close();
  }
}

export function get(idOrUrl) {
  const db = open(true);
  try {
    const row = /^\d+$/.test(String(idOrUrl))
      ? db.prepare("SELECT * FROM docs WHERE id = ?").get(Number(idOrUrl))
      : db.prepare("SELECT * FROM docs WHERE url = ? OR url LIKE ?").get(String(idOrUrl), `%${idOrUrl}%`);
    if (!row) throw new Error(`No MŽP document matches "${idOrUrl}". Find one with cz_mzp_search.`);
    return row;
  } finally {
    db.close();
  }
}

export function stats() {
  const db = open(true);
  try {
    const n = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
    const byKind = db.prepare("SELECT kind, COUNT(*) n FROM docs GROUP BY kind ORDER BY n DESC").all();
    const years = db.prepare("SELECT MIN(year) a, MAX(year) b FROM docs WHERE year IS NOT NULL").get();
    const built = db.prepare("SELECT value FROM meta WHERE key='built_at'").get();
    const visited = db.prepare("SELECT COUNT(*) n FROM visited").get().n;
    const withText = db.prepare("SELECT COUNT(*) n FROM docs WHERE body IS NOT NULL AND LENGTH(body) > 200").get().n;
    return {
      documents: n, byKind, visited, withText,
      vestnikFrom: years.a, vestnikTo: years.b,
      builtAt: built?.value || null,
      ageDays: built ? Math.floor((Date.now() - Date.parse(built.value)) / 86_400_000) : null,
    };
  } finally {
    db.close();
  }
}

export const dbExists = () => existsSync(DB_PATH);
export const SITE_URL = SITE;
