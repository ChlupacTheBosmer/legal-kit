#!/usr/bin/env node
/**
 * Build or inspect the local index of district and regional court decisions.
 *
 *   node tools/justice-index.mjs build --from 2025-01-01 [--to 2026-08-24]
 *   node tools/justice-index.mjs stats
 *
 * The Ministry of Justice API is keyed by publication date, so this walks the
 * range day by day — roughly four calls and 280 decisions per publication day.
 * Days already fetched are skipped, so the build is resumable: run it again with
 * a wider range to extend coverage.
 *
 * Only metadata is stored (ECLI, court, subject, keywords, provisions cited).
 * Full text is fetched on demand with cz_case_text court="lower".
 */
import { build, stats, DB_PATH } from "../mcp-servers/lex/lib/justice.js";

const args = process.argv.slice(2);
const cmd = args[0] || "stats";
const flag = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? undefined : args[i + 1]; };

if (cmd === "build") {
  const from = flag("from");
  if (!from) {
    console.error("build needs --from YYYY-MM-DD (and optionally --to). Start with a year or two;\n" +
                  "you can widen the range later and only the new days are fetched.");
    process.exit(2);
  }
  console.log(`Building lower-court index at ${DB_PATH}`);
  const t0 = Date.now();
  const r = await build({ from, to: flag("to"), refetch: args.includes("--refetch"),
                          onProgress: (m) => console.log("  " + m) });
  console.log(
    `\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${r.added} new, ${r.total} decisions total ` +
      `(${r.calls} API calls over ${r.days} days, ${r.emptyDays} with nothing published)\n` +
      `Decision dates ${r.oldest} → ${r.newest}`
  );
} else if (cmd === "stats") {
  try {
    const s = stats();
    console.log(`Lower-court index: ${s.decisions} decisions`);
    console.log(`  publication days indexed: ${s.daysIndexed} (${s.coverageFrom} → ${s.coverageTo})`);
    console.log(`  decision dates: ${s.decidedFrom} → ${s.decidedTo}`);
    console.log(`  top courts:`);
    for (const c of s.topCourts) console.log(`    ${String(c.n).padStart(6)}  ${c.court}`);
  } catch (e) {
    console.log(e.message);
  }
} else {
  console.error("usage: justice-index.mjs <build --from DATE [--to DATE] | stats>");
  process.exit(2);
}
