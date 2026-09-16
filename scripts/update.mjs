#!/usr/bin/env node
/**
 * `make update` — refresh whatever has gone stale, and nothing else.
 *
 * Each index carries its own refresh interval, chosen from how fast the source
 * actually changes: ÚOOÚ publishes a few items a month, the ministry at least
 * four Věstník issues a year, the courts continuously. An index inside its
 * interval is left alone, so this is cheap to run often and safe to schedule.
 *
 *   node setup/update.mjs            refresh what is stale or missing
 *   node setup/update.mjs --force    refresh everything regardless
 *   node setup/update.mjs --check    report only, change nothing (exit 1 if stale)
 */
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, DATA_HOME, exists, indexStatus, pdftotextCheck } from "./env.mjs";
import { bold, dim, green, yellow, cyan, ok, warn, bad, rule, todayISO, humanMs } from "./ui.mjs";

const force = process.argv.includes("--force");
const checkOnly = process.argv.includes("--check");

const JOBS = {
  "uoou.db": { label: "ÚOOÚ guidance", args: [join(ROOT, "tools", "uoou-index.mjs"), "build"], interval: 30 },
  "mzp.db": { label: "MŽP guidance and Věstník", args: [join(ROOT, "tools", "mzp-index.mjs"), "build"], interval: 90 },
  "justice.db": {
    label: "District and regional courts",
    args: ["tools/justice-index.mjs", "build", "--from", `${new Date().getFullYear() - 1}-01-01`],
    interval: 90,
  },
};

const sh = (args) =>
  new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, args, { stdio: "inherit", cwd: ROOT });
    p.on("close", (code) => resolve({ code: code ?? 1, ms: Date.now() - t0 }));
    p.on("error", () => resolve({ code: 1, ms: Date.now() - t0 }));
  });

console.log(bold("\nRefreshing local indexes"));

const status = await indexStatus();
const todo = status.filter((i) => force || !i.built || i.stale);

if (!todo.length) {
  console.log(`\n${green("Everything is current.")} Nothing to do.\n`);
  for (const i of status) ok(`${i.label.padEnd(34)} ${dim(`${i.ageDays} days old, refreshed every ${i.staleDays}`)}`);
  console.log();
  process.exit(0);
}

console.log();
for (const i of todo) {
  const why = !i.built ? "not built" : force ? "forced" : `${i.ageDays} days old`;
  warn(`${i.label.padEnd(34)} ${dim(why)}`);
}

if (checkOnly) {
  console.log(`\n${yellow(`${todo.length} index(es) need attention.`)} Run ${cyan("/legal-kit:update")}.\n`);
  process.exit(1);
}

if (!(await pdftotextCheck()).ok && todo.some((i) => i.file.endsWith("mzp.db"))) {
  warn("pdftotext is not installed, so ministry PDFs will be indexed by title only.");
  console.log(`        ${dim("macOS: brew install poppler · Debian/Ubuntu: sudo apt install poppler-utils")}`);
}

let failures = 0;
for (const i of todo) {
  const key = i.file.split("/").pop();
  const job = JOBS[key];
  if (!job) continue;
  rule(job.label);
  const { code, ms } = await sh(job.args);
  if (code === 0) ok(`done in ${humanMs(ms)}`);
  else { failures++; bad(`exited with code ${code} — the builders are resumable, so re-running continues`); }
}

/* Record it, so the maintenance log reflects reality rather than intentions. */
const logPath = join(DATA_HOME, "maintenance-log.md");
if (await exists(logPath)) {
  try {
    let log = await readFile(logPath, "utf8");
    const today = todayISO();
    const rows = {
      "ÚOOÚ index rebuild": 30,
      "MŽP guidance index rebuild": 90,
      "Lower-court index refresh": 90,
    };
    const done = todo.map((i) => i.label);
    for (const [row, days] of Object.entries(rows)) {
      const matches = done.some((d) => row.toLowerCase().includes(d.toLowerCase().split(" ")[0]));
      if (!matches) continue;
      const next = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      log = log.replace(
        new RegExp(`\\| ${row.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")} \\|[^|]*\\|[^|]*\\|[^|]*\\|`),
        `| ${row} | ${today} | **${next}** | no |`
      );
    }
    log = log.replace("## History\n", `## History\n\n- **${today}**: \`make update\` refreshed ${done.join(", ")}.`);
    await writeFile(logPath, log);
    ok("maintenance log updated");
  } catch {
    warn("could not update the maintenance log; edit it by hand");
  }
}

rule("");
if (failures) {
  console.log(`${yellow(`${failures} build(s) did not finish.`)} They are resumable: run ${cyan("/legal-kit:update")} again.\n`);
  process.exit(1);
}
console.log(`${green(bold("Indexes refreshed."))}\n`);
