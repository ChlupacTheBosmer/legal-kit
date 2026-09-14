#!/usr/bin/env node
/**
 * `make setup` — take a fresh clone to a working workspace.
 *
 * Five things, in order, each skippable:
 *   1. check the machine can run it, and say exactly what is missing if not
 *   2. install the MCP server's two dependencies
 *   3. ask who you are, and write PROFILE.md
 *   4. build the local indexes, with honest time estimates
 *   5. offer a scheduled refresh
 *
 * Safe to re-run. It will not overwrite an existing PROFILE.md without asking,
 * and the index builders are resumable, so an interrupted build continues.
 */
import { writeFile, readFile, mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import {
  ROOT, exists, nodeCheck, sqliteCheck, npmCheck, pdftotextCheck, pythonCheck,
  depsCheck, integrationChecks,
} from "./lib/env.mjs";
import {
  ask, confirm, choose, chooseMany, closeInput, bold, dim, green, yellow, cyan,
  ok, warn, bad, rule, todayISO, humanMs,
} from "./lib/ui.mjs";

/**
 * Run a child process, showing its output.
 *
 * stdin is deliberately NOT inherited. A child that inherits it closes it when
 * it exits, which silently destroys the readline interface this script needs
 * for every question after the first child runs.
 */
const sh = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"], cwd: ROOT, ...opts });
    p.on("close", (code) => resolve(code ?? 1));
    p.on("error", () => resolve(1));
  });

console.log(bold("\n  Czech and EU legal research workspace — setup\n"));
console.log(dim("  Nothing here is sent anywhere. The legal sources are free government"));
console.log(dim("  registries, and every credential stays on this machine.\n"));

/* ------------------------------------------------------------ 1. the machine */

rule("1. Can this machine run it?");
const required = [nodeCheck(), await sqliteCheck(), await npmCheck()];
let blocked = false;
for (const c of required) {
  if (c.ok) ok(`${c.name.padEnd(24)} ${dim(c.version)}`);
  else {
    blocked = true;
    bad(`${c.name.padEnd(24)} ${dim(c.version)} ${dim(`(need ${c.required})`)}`);
    console.log(`        ${dim(c.why)}`);
    console.log(`        ${cyan(c.fix)}`);
  }
}
const pdf = await pdftotextCheck();
const py = await pythonCheck();
for (const c of [pdf, py]) {
  if (c.ok) ok(`${c.name.padEnd(24)} ${dim(c.version)}`);
  else {
    warn(`${c.name.padEnd(24)} ${dim("not found — optional")}`);
    console.log(`        ${dim(c.why)}`);
    console.log(`        ${dim(c.fix)}`);
  }
}
if (blocked) {
  console.log(`\n${bold("Stopping.")} Install the items marked fail above, then run ${cyan("make setup")} again.\n`);
  closeInput();
  process.exit(1);
}

/* ------------------------------------------------------- 2. the dependencies */

rule("2. MCP server dependencies");
if ((await depsCheck()).ok) {
  ok("already installed");
} else if (await confirm("Install the two npm dependencies now (@modelcontextprotocol/sdk, zod)?", true)) {
  const code = await sh("npm", ["install", "--no-audit", "--no-fund"], { cwd: join(ROOT, "mcp-servers", "lex") });
  if (code !== 0) {
    bad("npm install failed. Fix the error above and re-run `make setup`.");
    closeInput();
    process.exit(1);
  }
  ok("installed");
} else {
  warn("skipped — the server will not start until you run `make install`");
}

/* -------------------------------------------------------------- 3. the profile */

rule("3. Who is this for?");
console.log(dim("  This becomes PROFILE.md, which is NOT tracked by git. It tells the"));
console.log(dim("  assistant what register to write in and what to assume you know.\n"));

const profilePath = join(ROOT, "PROFILE.md");
let writeProfile = true;
if (await exists(profilePath)) {
  writeProfile = await confirm("PROFILE.md already exists. Replace it?", false);
  if (!writeProfile) info_skip();
}
function info_skip() { warn("keeping your existing PROFILE.md"); }

if (writeProfile) {
  const name = await ask("Your name?", "");
  const role = await ask("Your role, in a few words?", "lawyer");

  const qualification = await choose("Are you legally qualified?", [
    { value: "qualified", label: "Yes, a qualified lawyer", hint: "full legal register" },
    { value: "student", label: "A law student or trainee", hint: "full register, more background" },
    { value: "lay", label: "No", hint: "keeps every citation, explains the doctrinal step too" },
  ], 0);

  const onRoll = qualification === "qualified"
    ? await confirm("Are you on the roll of advocates of the Czech Bar Association (ČAK)?", false)
    : false;

  const AREAS = [
    { value: "environmental", label: "Environmental" },
    { value: "data protection", label: "Data protection / GDPR" },
    { value: "intellectual property", label: "Intellectual property" },
    { value: "AI regulation", label: "AI regulation" },
    { value: "commercial contracts", label: "Commercial contracts" },
    { value: "corporate", label: "Corporate" },
    { value: "employment", label: "Employment" },
    { value: "administrative", label: "Administrative and public" },
    { value: "tax", label: "Tax" },
    { value: "competition", label: "Competition" },
    { value: "consumer", label: "Consumer" },
    { value: "criminal", label: "Criminal" },
  ];
  const main = await chooseMany("Which areas do you actually practise?", AREAS, []);
  const outside = await chooseMany("Which do you work in but NOT specialise in?", AREAS, []);

  const language = await choose("Language for analysis and notes?", [
    { value: "English", label: "English", hint: "Czech deliverables still drafted in Czech" },
    { value: "Czech", label: "Czech" },
  ], 0);

  const org = await ask("Organisation you mainly advise (blank if several)?", "");
  const ico = org ? await ask("Its IČO (blank if unknown)?", "") : "";
  const notes = await ask("Anything else the assistant should know (one line, optional)?", "");

  const integrations = await integrationChecks();
  const row = (n) => {
    const found = integrations.find((i) => i.name.startsWith(n));
    return found?.ok ? "yes" : "no";
  };

  const list = (xs, fallback) => (xs.length ? xs.join(", ") : fallback);
  const profile = `# Profile

Written by \`make setup\` on ${todayISO()}. Edit it by hand whenever anything
changes, or re-run \`make setup\` to rewrite it.

**This file is not tracked by git.** Nothing in it leaves your machine.

## Who you are

- **Name:** ${name || "(not given)"}
- **Role:** ${role}
- **Qualification:** ${
    { qualified: "qualified lawyer", student: "law student or trainee", lay: "not legally qualified" }[qualification]
  }
- **On the roll of advocates (ČAK)?** ${onRoll ? "Yes" : "No"}

${
  onRoll
    ? `Because you are on the roll, you may be advising clients. Flag conflicts,
deadlines and duties to the client prominently, and treat client material as
confidential under § 21 of Act No. 85/1996 Coll.`
    : `Because you are **not** on the roll, claim no legal professional privilege over
anything in this repository. § 21 of Act No. 85/1996 Coll. attaches the duty of
confidentiality to the advocate, and Czech law has no attorney work product
doctrine. Where a matter needs privilege or an advocate's authority, say so and
name the trigger.`
}

${
  qualification === "lay"
    ? `The reader is **not legally qualified**. Keep every citation and every quoted
provision, and explain the doctrinal step as well as the conclusion. Never drop
the sources in order to simplify.`
    : `Write at full legal register. Assume the doctrinal grammar, but set out
background in the areas listed below as outside the specialism.`
}

## What you practise

- **Main areas:** ${list(main, "(not stated)")}
- **Outside your specialism:** ${list(outside, "(not stated)")}

Set out doctrinal background in the areas outside the specialism rather than
assuming it. Assume it in the main areas.

## Jurisdiction

- **Primary:** Czech Republic, within the European Union framework
- **Never:** United States law

The installed \`claude-for-legal\` plugins, if any, are drafted for United States
practice. Correct their output against \`docs/jurisdiction-overlay.md\` before
delivering anything from them.

## Language

- **Analysis, notes and conversation:** ${language}
- **Czech deliverables:** drafted in Czech, in full, never translated from an
  English draft
- **Quoted provisions:** always in their own language

## Organisation

${org ? `- **Acting for:** ${org}\n${ico ? `- **IČO:** ${ico}\n` : ""}` : "- Not tied to one organisation. Use the matter-workspace skills to keep clients separate.\n"}
## Integrations configured

| Integration | Configured? |
| --- | --- |
| Zotero | ${row("Zotero")} |
| Google Docs and Drive | ${row("Google")} |
| claude-for-legal plugins | ${row("claude-for-legal")} |

Re-run \`make doctor\` after configuring any of them.

## Notes to the assistant

${notes || "(none)"}
`;
  await writeFile(profilePath, profile);
  ok(`wrote ${cyan("PROFILE.md")}`);
}

/* --------------------------------------- 3b. mirror into the plugin profile */

const pluginDir = join(homedir(), ".claude", "plugins", "config", "claude-for-legal");
if (await exists(pluginDir)) {
  rule("3b. claude-for-legal plugins");
  console.log(dim("  Those plugins read their own profile and are drafted for US practice."));
  if (await confirm("Add the Czech/EU jurisdiction rules to their shared profile?", true)) {
    const target = join(pluginDir, "company-profile.md");
    const banner = `\n\n<!-- added by lex-cz setup on ${todayISO()} -->\n## Jurisdiction: Czech Republic within the EU. Never United States law.\n\nThis workspace answers Czech and EU legal questions. Before delivering any output\nof these plugins that contains a legal statement, correct it against\n\`docs/jurisdiction-overlay.md\` in the lex-cz repository and say what was\ncorrected. Watch for: fair use, assignment of copyright, work made for hire,\nat-will employment, discovery, punitive damages. None of them exist in Czech law.\n\nEvery cited provision carries its text, its instrument named in full, a link and\na version date. Expand every abbreviation on first use. No em-dashes.\n`;
    try {
      const existing = (await exists(target)) ? await readFile(target, "utf8") : "# Company profile\n";
      if (existing.includes("lex-cz setup")) ok("already mirrored");
      else { await writeFile(target, existing + banner); ok(`appended the jurisdiction rules to ${dim(target)}`); }
    } catch (e) {
      warn(`could not write ${target}: ${e.message}`);
    }
  }
}

/* -------------------------------------------------------- 3c. integrations */

rule("3c. Optional integrations");
console.log(dim("  None of these are required. The legal research tools use only free,"));
console.log(dim("  unauthenticated government registries and work without any of them.\n"));
{
  const found = await integrationChecks();
  for (const i of found) {
    if (i.ok) { ok(`${i.name.padEnd(26)} ${dim(i.version)}`); continue; }
    warn(`${i.name.padEnd(26)} ${dim(i.version)}`);
    if (i.fix) console.log(`        ${dim(i.fix)}`);
  }
  const google = found.find((i) => i.name.startsWith("Google"));
  if (!google?.ok) {
    console.log(`\n  ${dim("Google Docs lets you draft into a real document and work from the comments")}`);
    console.log(`  ${dim("colleagues leave on it. Setup is three steps and one of them is a trip to")}`);
    console.log(`  ${dim("the Google Cloud console, so it is not done here.")}`);
    console.log(`  ${cyan("docs/google-docs-workflow.md")}${dim("  has the whole procedure.")}`);
  }
}

/* ---------------------------------------------------------- 4. the maintenance log */

const logPath = join(ROOT, "vault", "50-Handbook", "Maintenance log.md");
if (!(await exists(logPath))) {
  const tmpl = join(ROOT, "vault", "50-Handbook", "Maintenance log.template.md");
  if (await exists(tmpl)) {
    const body = (await readFile(tmpl, "utf8")).replaceAll("SETUP_DATE", todayISO());
    await writeFile(logPath, body);
  }
}

/* --------------------------------------------------------------- 5. the indexes */

rule("4. Local indexes");
console.log(dim("  Case law from the Supreme Administrative Court is searched live and needs"));
console.log(dim("  no index. These three are local mirrors of sources with no usable API.\n"));

const JOBS = [
  {
    key: "uoou", label: "ÚOOÚ guidance (data protection authority)",
    estimate: "a few seconds", cmd: ["tools/uoou-index.mjs", "build"],
    why: "For a GDPR question this usually settles it in practice.",
    recommend: true,
  },
  {
    key: "mzp", label: "MŽP guidance and Věstník (Ministry of the Environment)",
    estimate: "a few hours", cmd: ["tools/mzp-index.mjs", "build"],
    why: "For an environmental question this usually settles it. The ministry asks for ten seconds between requests and that is honoured, so it is slow. It is resumable and can run in the background.",
    recommend: false, background: true,
  },
  {
    key: "justice", label: "District and regional courts (civil and criminal)",
    estimate: "a few minutes per year of coverage", cmd: ["tools/justice-index.mjs", "build", "--from"],
    why: "First-instance civil and criminal decisions. Note it holds no administrative justice at all.",
    recommend: false, needsFrom: true,
  },
];

for (const job of JOBS) {
  console.log(`\n  ${bold(job.label)}`);
  console.log(`  ${dim(job.why)}`);
  console.log(`  ${dim(`Takes ${job.estimate}.`)}`);
  if (!(await confirm(`Build it now?`, job.recommend))) {
    warn(`skipped — build it later with ${cyan(`make index-${job.key}`)}`);
    continue;
  }
  let args = [...job.cmd];
  if (job.needsFrom) {
    const from = await ask("From which date? (YYYY-MM-DD)", `${new Date().getFullYear()}-01-01`);
    args.push(from);
  }
  if (job.background) {
    const bg = await confirm("Run it in the background so setup can finish?", true);
    if (bg) {
      const { spawn: sp } = await import("node:child_process");
      const out = await import("node:fs");
      await mkdir(join(ROOT, ".data"), { recursive: true });
      const logFile = join(ROOT, ".data", `${job.key}-build.log`);
      const fd = out.openSync(logFile, "a");
      const child = sp(process.execPath, args, { cwd: ROOT, detached: true, stdio: ["ignore", fd, fd] });
      child.unref();
      ok(`started in the background (pid ${child.pid})`);
      console.log(`        ${dim(`progress: tail -f ${logFile}`)}`);
      console.log(`        ${dim(`status:   make status`)}`);
      continue;
    }
  }
  const t0 = Date.now();
  const code = await sh(process.execPath, args);
  if (code === 0) ok(`built in ${humanMs(Date.now() - t0)}`);
  else warn(`the build exited with code ${code}. It is resumable: re-run ${cyan(`make index-${job.key}`)}.`);
}

/* ------------------------------------------------------------- 6. the schedule */

rule("5. Keeping the indexes fresh");
console.log(dim("  A stale mirror of a regulator is worse than none, because it looks current."));
console.log(dim("  This installs a weekly job that refreshes whatever has gone stale.\n"));
if (await confirm("Install the weekly refresh now?", false)) {
  await sh(process.execPath, ["setup/schedule.mjs", "install"]);
} else {
  warn(`skipped — install it later with ${cyan("make schedule")}, or just run ${cyan("make update")} when you think of it`);
}

/* ------------------------------------------------------------------- finish */

rule("");
console.log(`${green(bold("Setup complete."))}\n`);
console.log(`  ${bold("Next:")}`);
console.log(`    ${cyan("make doctor")}   check everything, including whether the sources are reachable`);
console.log(`    ${cyan("make test")}     run the full end-to-end test against the live registries`);
console.log(`    ${cyan("claude")}        start Claude Code here; the lex tools are registered automatically\n`);
console.log(`  ${dim("Read vault/50-Handbook/Start here.md for what this can and cannot do.")}\n`);
closeInput();
