#!/usr/bin/env node
/**
 * Build or inspect the local MŽP guidance index (Věstník MŽP and the
 * ministry's methodological documents).
 *
 *   node tools/mzp-index.mjs build             # resumable full build
 *   node tools/mzp-index.mjs build --katalog   # also the 800-page service catalogue
 *   node tools/mzp-index.mjs build --limit 60  # stop after 60 fetches (a taste of it)
 *   node tools/mzp-index.mjs build --refetch   # discard and start over
 *   node tools/mzp-index.mjs stats             # what is in it, and how stale
 *
 * The ministry's robots.txt asks for 10 seconds between requests and that is
 * honoured, so a full build takes a couple of hours. It is resumable: pages
 * already fetched are recorded and skipped, so stopping it costs nothing.
 * Run it in the background and check `stats`.
 *
 * The index lives in .data/mzp.db (derived data, gitignored).
 */
import { build, stats, DB_PATH, pdfExtractorAvailable } from "../mcp-servers/lex/lib/mzp.js";

const argv = process.argv.slice(2);
const cmd = argv[0] || "stats";
const flag = (name) => argv.includes(`--${name}`);
const value = (name, d = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

if (cmd === "build") {
  if (!(await pdfExtractorAvailable())) {
    console.log(
      "NOTE: `pdftotext` was not found, so PDFs will be indexed by title and URL only, not by their text.\n" +
        "      Install poppler (brew install poppler) and re-run with --refetch to index their contents.\n"
    );
  }
  console.log(`Building MŽP index at ${DB_PATH}`);
  const t0 = Date.now();
  const r = await build({
    onProgress: (m) => console.log(`  ${new Date().toISOString().slice(11, 19)}  ${m}`),
    includeKatalog: flag("katalog"),
    refetch: flag("refetch"),
    limit: value("limit") ? Number(value("limit")) : null,
    delayMs: value("delay") ? Number(value("delay")) * 1000 : null,
  });
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(
    `\nDone in ${mins} min — ${r.documents} documents in the index ` +
      `(${r.stored} written this run, of which ${r.files} files), ${r.withText} with extractable text.\n` +
      `Fetched ${r.fetched}, failed ${r.failed}, skipped ${r.skippedBig} over the size cap.\n` +
      r.byKind.map((k) => `  ${k.kind}: ${k.n}`).join("\n")
  );
  if (r.failed) console.log(`\n${r.failed} URL(s) failed. Re-run \`build\` to retry only those.`);
} else if (cmd === "stats") {
  try {
    const s = stats();
    console.log(`MŽP index: ${s.documents} documents (${s.withText} with extractable text), ${s.visited} URLs visited`);
    for (const k of s.byKind) console.log(`  ${k.kind}: ${k.n}`);
    if (s.vestnikFrom) console.log(`  Věstník files span ${s.vestnikFrom} → ${s.vestnikTo}`);
    console.log(`  built ${s.builtAt} (${s.ageDays} days ago)`);
    if (s.ageDays > 90) console.log("  NOTE: over three months old — rebuild with `node tools/mzp-index.mjs build`");
  } catch (e) {
    console.log(e.message);
  }
} else {
  console.error("usage: mzp-index.mjs <build|stats> [--katalog] [--refetch] [--limit N] [--delay SECONDS]");
  process.exit(2);
}
