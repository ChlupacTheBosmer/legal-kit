#!/usr/bin/env node
/**
 * `the weekly refresh` — install or remove a weekly index refresh.
 *
 *   node setup/schedule.mjs install     install the weekly job
 *   node setup/schedule.mjs remove      remove it
 *   node setup/schedule.mjs status      is it installed?
 *
 * macOS gets a launchd agent, Linux a crontab line. Both run `update.mjs`,
 * which refreshes only what has actually gone stale, so a weekly schedule costs
 * almost nothing in the weeks when nothing has.
 *
 * Everything it writes is shown before it is written, and removal is exact:
 * only the block this script created is touched.
 */
import { writeFile, unlink, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ROOT, DATA_HOME, exists, isMac, isLinux } from "./env.mjs";
import { bold, dim, green, yellow, cyan, ok, warn, bad, rule } from "./ui.mjs";

const run = promisify(execFile);
const cmd = process.argv[2] || "status";

const LABEL = "cz.legalkit.update";
const PLIST = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const MARK_START = "# >>> legal-kit weekly index refresh >>>";
const MARK_END = "# <<< legal-kit weekly index refresh <<<";
const LOG = join(DATA_HOME, "update.log");

/**
 * Identifiers used before this repository was renamed to legal-kit. An agent or
 * crontab entry installed under the old name is invisible to the new `remove`,
 * so it would keep firing weekly with nobody able to find it. Both paths clean
 * these up as well.
 */
const LEGACY_LABEL = "cz.lex.update";
const LEGACY_PLIST = join(homedir(), "Library", "LaunchAgents", `${LEGACY_LABEL}.plist`);
const LEGACY_MARK_START = "# >>> lex-cz weekly index refresh >>>";
const LEGACY_MARK_END = "# <<< lex-cz weekly index refresh <<<";

async function removeLegacyMac() {
  if (!(await exists(LEGACY_PLIST))) return;
  try { await run("launchctl", ["unload", LEGACY_PLIST]); } catch { /* not loaded */ }
  await unlink(LEGACY_PLIST);
  warn(`also removed an agent left by the previous name (${LEGACY_LABEL})`);
}

/* --------------------------------------------------------------- macOS */

const plistBody = () => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${join(ROOT, "setup", "update.mjs")}</string>
  </array>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
  <key>RunAtLoad</key><false/>
</dict>
</plist>
`;

async function macInstall() {
  await removeLegacyMac();
  await mkdir(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  await mkdir(DATA_HOME, { recursive: true });
  await writeFile(PLIST, plistBody());
  try { await run("launchctl", ["unload", PLIST]); } catch { /* not loaded yet */ }
  await run("launchctl", ["load", PLIST]);
  ok(`installed a launchd agent, Mondays at 09:00`);
  console.log(`        ${dim(PLIST)}`);
  console.log(`        ${dim(`log: ${LOG}`)}`);
}

async function macRemove() {
  await removeLegacyMac();
  if (!(await exists(PLIST))) return warn("no launchd agent installed");
  try { await run("launchctl", ["unload", PLIST]); } catch { /* already unloaded */ }
  await unlink(PLIST);
  ok("removed the launchd agent");
}

const macStatus = async () =>
  (await exists(PLIST)) ? { installed: true, where: PLIST } : { installed: false };

/* --------------------------------------------------------------- Linux */

async function crontab() {
  try { return (await run("crontab", ["-l"])).stdout; } catch { return ""; }
}

async function writeCrontab(text) {
  const tmp = join(DATA_HOME, "crontab.tmp");
  await mkdir(DATA_HOME, { recursive: true });
  await writeFile(tmp, text.endsWith("\n") ? text : text + "\n");
  await run("crontab", [tmp]);
  await unlink(tmp).catch(() => {});
}

function stripBlock(text) {
  for (const [start, end] of [[MARK_START, MARK_END], [LEGACY_MARK_START, LEGACY_MARK_END]]) {
    const a = text.indexOf(start);
    const b = text.indexOf(end);
    if (a !== -1 && b !== -1) text = text.slice(0, a) + text.slice(b + end.length);
  }
  return text.replace(/\n{3,}/g, "\n\n");
}

async function linuxInstall() {
  await mkdir(DATA_HOME, { recursive: true });
  const line = `0 9 * * 1 cd ${ROOT} && ${process.execPath} setup/update.mjs >> ${LOG} 2>&1`;
  const current = stripBlock(await crontab());
  await writeCrontab(`${current.trimEnd()}\n\n${MARK_START}\n${line}\n${MARK_END}\n`);
  ok("installed a crontab entry, Mondays at 09:00");
  console.log(`        ${dim(line)}`);
}

async function linuxRemove() {
  const current = await crontab();
  if (!current.includes(MARK_START)) return warn("no crontab entry installed");
  await writeCrontab(stripBlock(current));
  ok("removed the crontab entry");
}

const linuxStatus = async () =>
  (await crontab()).includes(MARK_START) ? { installed: true, where: "crontab" } : { installed: false };

/* ------------------------------------------------------------- dispatch */

const unsupported = () => {
  bad(`Scheduling is not automated on ${process.platform}.`);
  console.log(`        ${dim("Run /legal-kit:update by hand, or wire this into whatever your system uses:")}`);
  console.log(`        ${cyan(`cd ${ROOT} && ${process.execPath} setup/update.mjs`)}`);
  process.exit(1);
};

console.log(bold("\nWeekly index refresh"));

if (cmd === "install") {
  rule("Installing");
  console.log(dim("  Runs `update.mjs` weekly. That refreshes only indexes that have actually"));
  console.log(dim("  gone stale, so most weeks it does nothing and costs nothing.\n"));
  if (isMac()) await macInstall();
  else if (isLinux()) await linuxInstall();
  else unsupported();
  console.log(`\n  Remove it with ${cyan("node $CLAUDE_PLUGIN_ROOT/scripts/schedule.mjs remove")}.\n`);
} else if (cmd === "remove") {
  if (isMac()) await macRemove();
  else if (isLinux()) await linuxRemove();
  else unsupported();
  console.log();
} else {
  const s = isMac() ? await macStatus() : isLinux() ? await linuxStatus() : { installed: false };
  if (s.installed) {
    ok(`installed ${dim(s.where)}`);
    console.log(`\n  Remove it with ${cyan("node $CLAUDE_PLUGIN_ROOT/scripts/schedule.mjs remove")}.\n`);
  } else {
    warn("not installed");
    console.log(`\n  Install it with ${cyan("node $CLAUDE_PLUGIN_ROOT/scripts/schedule.mjs install")}, or just run ${cyan("/legal-kit:update")} when you think of it.\n`);
  }
}
