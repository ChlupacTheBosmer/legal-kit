#!/usr/bin/env node
/**
 * Build or inspect the local ÚOOÚ guidance index.
 *
 *   node tools/uoou-index.mjs build    # fetch everything, rebuild the index
 *   node tools/uoou-index.mjs stats    # what is in it, and how stale
 *
 * The index lives in .cache/lex/uoou.db (gitignored — it is derived data).
 * Rebuild it when you need current guidance; ÚOOÚ publishes a few items a month.
 */
import { build, stats, DB_PATH } from "../mcp-servers/lex/lib/uoou.js";

const cmd = process.argv[2] || "stats";

if (cmd === "build") {
  console.log(`Building ÚOOÚ index at ${DB_PATH}`);
  const t0 = Date.now();
  const r = await build({ onProgress: (m) => console.log("  " + m) });
  console.log(
    `\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${r.documents} documents ` +
      `(${r.articles} articles, ${r.pages} section pages), ${r.oldest} → ${r.newest}`
  );
} else if (cmd === "stats") {
  try {
    const s = stats();
    console.log(`ÚOOÚ index: ${s.documents} documents`);
    for (const k of s.byKind) console.log(`  ${k.kind}: ${k.n}`);
    console.log(`  published ${s.oldest} → ${s.newest}`);
    console.log(`  built ${s.builtAt} (${s.ageDays} days ago)`);
    if (s.ageDays > 30) console.log("  NOTE: over a month old — rebuild with `node tools/uoou-index.mjs build`");
  } catch (e) {
    console.log(e.message);
  }
} else {
  console.error("usage: uoou-index.mjs <build|stats>");
  process.exit(2);
}
