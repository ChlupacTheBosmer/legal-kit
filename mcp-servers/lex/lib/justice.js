/**
 * District and regional court decisions — a local subject index over the
 * Ministry of Justice open-data API (rozhodnuti.justice.cz).
 *
 * The API is keyed by publication date only: there is no subject or keyword
 * query. Each record does carry the subject of proceedings, index keywords and
 * the provisions cited, so mirroring that metadata locally turns a date-ordered
 * firehose into something searchable. Full text stays remote and is fetched on
 * demand (cz_case_text court="lower").
 *
 * Volume: roughly 280 decisions per publication day, four API calls. A year is
 * about 1,000 calls and 70,000 decisions, so the index is built for an explicit
 * date range and is resumable — days already fetched are recorded and skipped.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./http.js";
import { justiceByDay } from "./caselaw.js";
import { searchWithFallback } from "./czsearch.js";

export const DB_PATH = process.env.LEX_JUSTICE_DB || join(DATA_DIR, "justice.db");

function open(readonly = false) {
  if (readonly && !existsSync(DB_PATH)) {
    throw new Error(
      "The lower-court index has not been built yet. Run:\n" +
        "  node tools/justice-index.mjs build --from 2025-01-01\n" +
        "(about four API calls per publication day; it is resumable.)"
    );
  }
  return new DatabaseSync(DB_PATH);
}

function schema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ecli TEXT UNIQUE,
      case_number TEXT,
      court TEXT,
      subject TEXT,
      keywords TEXT,
      provisions TEXT,
      decided TEXT,
      published TEXT,
      uuid TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
      subject, keywords, provisions, court,
      content='decisions', content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, items INTEGER, done_at TEXT);
    CREATE INDEX IF NOT EXISTS idx_decided ON decisions(decided);
    CREATE INDEX IF NOT EXISTS idx_court ON decisions(court);
  `);
}

const isoDays = (from, to) => {
  const a = new Date(`${from}T00:00:00Z`), b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(+a) || Number.isNaN(+b)) throw new Error("from/to must be ISO dates (YYYY-MM-DD).");
  const out = [];
  for (let t = +a; t <= +b; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

/** Fetch a date range into the index. Days already stored are skipped. */
export async function build({ from, to, onProgress = () => {}, refetch = false } = {}) {
  await mkdir(DATA_DIR, { recursive: true });
  const db = open();
  schema(db);

  const days = isoDays(from, to || new Date().toISOString().slice(0, 10));
  const done = new Set(refetch ? [] : db.prepare("SELECT day FROM days").all().map((r) => r.day));
  const todo = days.filter((d) => !done.has(d));
  onProgress(`${days.length} day(s) requested, ${todo.length} to fetch, ${days.length - todo.length} already indexed`);

  const ins = db.prepare(`
    INSERT INTO decisions (ecli, case_number, court, subject, keywords, provisions, decided, published, uuid)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(ecli) DO NOTHING
  `);
  const markDay = db.prepare("INSERT OR REPLACE INTO days (day, items, done_at) VALUES (?,?,?)");

  let added = 0, calls = 0, emptyDays = 0, failedDays = 0;
  for (const [i, day] of todo.entries()) {
    let page = 0, totalPages = 1, dayItems = 0, dayFailed = false;
    while (page < totalPages) {
      // Empty days return 200 with an empty list. An exception is a real
      // failure, and marking the day done would burn a permanent hole in the
      // index that the coverage line would then silently overstate.
      let payload;
      try {
        payload = await justiceByDay(day, { page, pageSize: 100 });
        calls++;
      } catch {
        dayFailed = true;
        break;
      }
      totalPages = payload.totalPages ?? 1;
      for (const it of payload.items || []) {
        if (!it.ecli) continue;
        const r = ins.run(
          it.ecli, it.jednaciCislo || null, it.soud || null, it.predmetRizeni || null,
          (it.klicovaSlova || []).join("; ") || null,
          (it.zminenaUstanoveni || []).join("; ") || null,
          it.datumVydani || null, it.datumZverejneni || null,
          (it.odkaz || "").split("/").pop() || null
        );
        if (r.changes) added++;
        dayItems++;
      }
      page++;
    }
    if (dayFailed) {
      failedDays++;
    } else {
      if (!dayItems) emptyDays++;
      markDay.run(day, dayItems, new Date().toISOString());
    }
    if ((i + 1) % 25 === 0 || i === todo.length - 1) {
      onProgress(`  ${i + 1}/${todo.length} days · ${added} new decisions · ${calls} API calls`);
    }
  }

  db.exec("INSERT INTO decisions_fts(decisions_fts) VALUES('rebuild');");
  const n = db.prepare("SELECT COUNT(*) n FROM decisions").get().n;
  const range = db.prepare("SELECT MIN(decided) a, MAX(decided) b FROM decisions").get();
  db.close();
  return { added, total: n, calls, days: todo.length, emptyDays, failedDays, oldest: range.a, newest: range.b };
}

/**
 * Which court registers (rejstříky) the index actually holds, commonest first.
 *
 * The date window is not the only axis on which this index is partial: the
 * Ministry of Justice feed publishes the ordinary courts' civil and criminal
 * dockets, and carries no administrative-justice agenda at all. Saying only
 * "2025-01-01 → 2026-08-24" implies completeness within that window and invites
 * an empty result on an administrative-law subject to be read as absence of
 * authority. So the registers travel with the coverage line.
 */
function dockets(db) {
  const rows = db
    .prepare(
      `SELECT UPPER(TRIM(REPLACE(SUBSTR(case_number, INSTR(case_number,' ')+1,
              INSTR(SUBSTR(case_number, INSTR(case_number,' ')+1),' ')), CHAR(160), ' '))) AS reg,
              COUNT(*) n
         FROM decisions WHERE case_number LIKE '% % %'
        GROUP BY reg ORDER BY n DESC LIMIT 12`
    )
    .all();
  return rows.filter((r) => r.reg && /^[A-ZĚŠČŘŽÝÁÍÉÚŮŇŤĎ]{1,5}$/.test(r.reg));
}

export function search({ query, court, provision, from, to, limit = 15 }) {
  const db = open(true);
  try {
    const run = (expr) => {
      const where = ["decisions_fts MATCH ?"];
      const args = [expr];
      if (court) { where.push("d.court LIKE ?"); args.push(`%${court}%`); }
      if (provision) { where.push("d.provisions LIKE ?"); args.push(`%${provision}%`); }
      if (from) { where.push("d.decided >= ?"); args.push(from); }
      if (to) { where.push("d.decided <= ?"); args.push(to); }
      args.push(Math.min(Number(limit) || 15, 50));
      return db.prepare(`
        SELECT d.id, d.ecli, d.case_number, d.court, d.subject, d.keywords, d.provisions,
               d.decided, d.published, d.uuid,
               bm25(decisions_fts, 4.0, 6.0, 3.0, 1.0) AS rank
        FROM decisions_fts JOIN decisions d ON d.id = decisions_fts.rowid
        WHERE ${where.join(" AND ")}
        ORDER BY rank
        LIMIT ?
      `).all(...args);
    };
    const { rows, matched } = searchWithFallback(query, run, (r) =>
      `${r.subject || ""} ${r.keywords || ""} ${r.provisions || ""}`
    );
    const total = db.prepare("SELECT COUNT(*) n FROM decisions").get().n;
    const cov = db.prepare("SELECT MIN(day) a, MAX(day) b, COUNT(*) n FROM days").get();
    return { rows, matched, corpus: total, coverage: cov, dockets: dockets(db) };
  } finally {
    db.close();
  }
}

export function stats() {
  const db = open(true);
  try {
    const n = db.prepare("SELECT COUNT(*) n FROM decisions").get().n;
    const cov = db.prepare("SELECT MIN(day) a, MAX(day) b, COUNT(*) n FROM days").get();
    const courts = db.prepare("SELECT court, COUNT(*) n FROM decisions GROUP BY court ORDER BY n DESC LIMIT 8").all();
    const range = db.prepare("SELECT MIN(decided) a, MAX(decided) b FROM decisions").get();
    return { decisions: n, daysIndexed: cov.n, coverageFrom: cov.a, coverageTo: cov.b,
             decidedFrom: range.a, decidedTo: range.b, topCourts: courts };
  } finally {
    db.close();
  }
}

export const dbExists = () => existsSync(DB_PATH);
