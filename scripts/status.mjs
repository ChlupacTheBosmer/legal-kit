#!/usr/bin/env node
/**
 * `/legal-kit:status` — a one-screen answer to "what state is this workspace in?"
 *
 * Deliberately cheap: no network, no selftest. It reads what is on disk, so it
 * is safe to run while a long background index build is still going.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ROOT, DATA_HOME, exists, indexStatus } from "./env.mjs";
import { bold, dim, green, yellow, cyan, ok, warn, rule } from "./ui.mjs";

const run = promisify(execFile);

console.log(bold("\nWorkspace status"));

rule("Configuration");
const profile = join(homedir(), ".claude", "plugins", "config", "legal-kit", "profile.md");
if (await exists(profile)) {
  const body = await readFile(profile, "utf8");
  const field = (label) => (new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`).exec(body) || [])[1]?.trim();
  ok(`profile  ${dim(`${field("Name") || "(no name)"}, ${field("Role") || "role not stated"}`)}`);
  const areas = field("Main areas");
  if (areas) console.log(`        ${dim(`practises: ${areas}`)}`);
} else {
  warn(`no profile — run ${cyan("/legal-kit:setup")}`);
}

rule("Indexes");
for (const i of await indexStatus()) {
  if (!i.built) warn(`${i.label.padEnd(34)} ${dim("not built")}`);
  else if (i.stale) warn(`${i.label.padEnd(34)} ${dim(`${i.sizeMb} MB · ${i.ageDays}d old · refresh every ${i.staleDays}d`)}`);
  else ok(`${i.label.padEnd(34)} ${dim(`${i.sizeMb} MB · ${i.ageDays}d old`)}`);
}

/* A background build leaves a log; surface its last line rather than hiding it. */
rule("Background builds");
let anyRunning = false;
for (const [key, label] of [["mzp", "MŽP"], ["justice", "lower courts"], ["uoou", "ÚOOÚ"]]) {
  const log = join(DATA_HOME, `${key}-build.log`);
  if (!(await exists(log))) continue;
  let running = false;
  try {
    const { stdout } = await run("pgrep", ["-f", `${key}-index.mjs`]);
    running = Boolean(stdout.trim());
  } catch { /* pgrep exits non-zero when nothing matches */ }
  anyRunning ||= running;
  const tail = (await readFile(log, "utf8")).trimEnd().split("\n").slice(-1)[0] || "";
  if (running) ok(`${label} build running  ${dim(tail.slice(0, 70))}`);
  else console.log(`  ${dim("·")}     ${label} build finished  ${dim(tail.slice(0, 70))}`);
}
if (!anyRunning) console.log(dim("  Nothing building right now."));

rule("Schedule");
await run(process.execPath, [join(ROOT, "setup", "schedule.mjs"), "status"])
  .then(({ stdout }) => process.stdout.write(stdout.split("\n").slice(2).join("\n")))
  .catch(() => warn("could not read the schedule"));

console.log(`${dim("  Full check including network:")} ${cyan("/legal-kit:doctor")}\n`);
