#!/usr/bin/env node
/**
 * `make check-private` — would `git push` publish something personal?
 *
 * This repository is meant to be forked and shared, and its whole point is that
 * people keep real legal work in it. Those two facts pull against each other, so
 * the check is explicit rather than left to everyone's care with .gitignore.
 *
 * It looks at what git would actually commit, not at what is on disk, because
 * .gitignore is the thing most likely to be wrong.
 *
 * Exit 1 if anything looks personal. False positives are expected and fine:
 * this exists to make you look, not to be clever.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { ROOT } from "./lib/env.mjs";
import { bold, dim, green, yellow, red, cyan, ok, warn, bad, rule } from "./lib/ui.mjs";

const run = promisify(execFile);

/** Paths that should never be tracked, whatever .gitignore says. */
const FORBIDDEN_PATHS = [
  [/^PROFILE\.md$/, "your personal profile"],
  [/^vault\/50-Handbook\/Maintenance log\.md$/, "your maintenance history"],
  [/^\.data\//, "built indexes"],
  [/^\.cache\//, "the HTTP cache"],
  [/^sources\//, "third-party source material you may not redistribute"],
  [/^\.claude\/settings\.local\.json$/, "your local Claude Code settings"],
  [/^(privacy|contracts|ai-governance)\/(?!README\.md$).*\.(md|docx?|pdf)$/i, "work product"],
  [/^vault\/(00-Inbox|10-Topics|20-Instruments|30-Memos)\/.+\.md$/, "your own notes"],
  [/node_modules\//, "installed dependencies"],
];

/** Content that suggests something personal or secret got in. */
const PATTERNS = [
  [/\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, "an email address"],
  [/[A-ZÁ-Ž][\w.\-]*(?:\s+[\w.\-]+){0,3}\s+(?:s\.r\.o\.|a\.s\.|z\.s\.|o\.p\.s\.|s\.p\.)/g, "a Czech company name (possible client or employer)"],
  [/\bIČO?[:\s]*\d{8}\b/gi, "an IČO (company identifier)"],
  [/\b(?:AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/g, "an API key"],
  [/"?(?:api[_-]?key|client[_-]?secret|refresh[_-]?token|access[_-]?token|password)"?\s*[:=]\s*["'][^"']{12,}/gi, "a credential assignment"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "a private key"],
];

/** Files whose content we do not scan for prose patterns. */
const SKIP_CONTENT = new Set([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".ico", ".woff", ".woff2"]);

/** Known-good mentions that are documentation, not leakage. */
const ALLOWED = [
  "noreply@anthropic.com",
  "example.com",
  "jane.example",
  "DirectCase",
  // The worked example in PROFILE.example.md. Left allowed so a fresh clone
  // reports genuinely clean: a check that cries wolf on first run teaches
  // people to ignore it, which is worse than not having it.
  "Example Software s.r.o.",
];

console.log(bold("\nChecking what git would publish"));

let tracked;
try {
  const { stdout } = await run("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 });
  tracked = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
} catch {
  bad("This is not a git repository yet, so there is nothing to check.");
  console.log(`        ${dim("Run `git init` first, or ignore this until you are ready to publish.")}\n`);
  process.exit(0);
}

rule(`${tracked.length} file(s) tracked or untracked-but-not-ignored`);

let problems = 0;

for (const [re, why] of FORBIDDEN_PATHS) {
  const hits = tracked.filter((f) => re.test(f));
  if (!hits.length) continue;
  problems += hits.length;
  bad(`${why}:`);
  for (const h of hits.slice(0, 8)) console.log(`        ${red(h)}`);
  if (hits.length > 8) console.log(`        ${dim(`… and ${hits.length - 8} more`)}`);
}

const findings = new Map();
for (const f of tracked) {
  if (SKIP_CONTENT.has(extname(f).toLowerCase())) continue;
  let body;
  try { body = await readFile(f, "utf8"); } catch { continue; }
  if (body.length > 2_000_000) continue;
  for (const [re, why] of PATTERNS) {
    for (const m of body.matchAll(re)) {
      const hit = m[0].slice(0, 60);
      if (ALLOWED.some((a) => hit.includes(a))) continue;
      const key = `${why}|${hit}`;
      if (!findings.has(key)) findings.set(key, { why, hit, files: new Set() });
      findings.get(key).files.add(f);
    }
  }
}

if (findings.size) {
  rule("Content worth a look");
  console.log(dim("  These are guesses, not verdicts. Most will be fine.\n"));
  for (const { why, hit, files } of findings.values()) {
    warn(`${why}: ${yellow(hit)}`);
    for (const f of [...files].slice(0, 4)) console.log(`        ${dim(f)}`);
    if (files.size > 4) console.log(`        ${dim(`… and ${files.size - 4} more files`)}`);
  }
}

rule("");
if (problems) {
  console.log(`${red(bold(`${problems} file(s) should not be published.`))}`);
  console.log(`Add them to .gitignore, or ${cyan("git rm --cached <file>")} if they are already tracked.\n`);
  process.exit(1);
}
if (findings.size) {
  console.log(`${yellow(bold("Nothing forbidden is tracked."))} Read the content findings above and decide.\n`);
  process.exit(0);
}
console.log(`${green(bold("Nothing personal found."))} Safe to push.\n`);
