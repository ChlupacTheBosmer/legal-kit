#!/usr/bin/env node
/**
 * `make doctor` — is this workspace able to do its job right now?
 *
 * Reports four things, each with the fix attached rather than left implied:
 *   what is installed, what is reachable, what is configured, what is stale.
 *
 * Exit code 1 if something required is broken, 0 otherwise. Optional items
 * never fail the run; they are reported so you know what you are not getting.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import {
  ROOT, exists, nodeCheck, sqliteCheck, npmCheck, pdftotextCheck, pythonCheck, gitCheck,
  depsCheck, integrationChecks, reachabilityChecks, indexStatus,
} from "./env.mjs";
import { bold, dim, green, yellow, red, cyan, ok, warn, bad, rule } from "./ui.mjs";

const quick = process.argv.includes("--quick");
let failed = 0;

function report(c) {
  const label = `${c.name.padEnd(34)} ${dim(c.version || "")}`;
  if (c.ok) return ok(label);
  if (c.optional) {
    warn(label);
    if (c.fix) console.log(`        ${dim(c.fix)}`);
    return;
  }
  failed++;
  bad(label);
  if (c.why) console.log(`        ${dim(c.why)}`);
  if (c.fix) console.log(`        ${cyan(c.fix)}`);
}

console.log(bold("\nlegal-kit doctor"));

rule("Runtime");
for (const c of [nodeCheck(), await sqliteCheck(), await npmCheck(), await depsCheck()]) report(c);
for (const c of [await pdftotextCheck(), await pythonCheck(), await gitCheck()]) report({ ...c, optional: true });

rule("Your configuration");
const hasProfile = await exists(join(homedir(), ".claude", "plugins", "config", "legal-kit", "profile.md"));
report({
  name: "Your profile",
  ok: hasProfile,
  version: hasProfile ? "present" : "missing",
  fix: "Run /legal-kit:setup. Three minutes.",
  why: "Without it the assistant does not know who it is writing for.",
});
for (const c of await integrationChecks()) report(c);

if (!quick) {
  rule("Official sources");
  console.log(dim("  One request each. All public and unauthenticated.\n"));
  for (const c of await reachabilityChecks()) report(c);
}

rule("Local indexes");
const idx = await indexStatus();
for (const i of idx) {
  if (!i.built) {
    warn(`${i.label.padEnd(34)} ${dim("not built")}`);
    console.log(`        ${cyan(i.cmd)}${dim("   (or `make update` to build everything that is missing)")}`);
  } else if (i.stale) {
    warn(`${i.label.padEnd(34)} ${dim(`${i.sizeMb} MB, ${i.ageDays} days old`)}`);
    console.log(`        ${cyan(i.cmd)}${dim(`   (older than the ${i.staleDays}-day refresh interval)`)}`);
  } else {
    ok(`${i.label.padEnd(34)} ${dim(`${i.sizeMb} MB, ${i.ageDays} days old`)}`);
  }
}
console.log(
  dim("\n  The Supreme Administrative Court is searched live, so it is never stale\n" +
      "  and needs no index. Only its subject vocabulary is cached, for 30 days.")
);

rule("");
if (failed) {
  console.log(`${red(bold(`${failed} required check failed.`))} Fix the items marked ${red("fail")} above, then run ${cyan("make doctor")} again.\n`);
  process.exit(1);
}
const notBuilt = idx.filter((i) => !i.built).length;
const stale = idx.filter((i) => i.stale).length;
console.log(`${green(bold("Everything required is working."))}`);
if (notBuilt) console.log(`${notBuilt} index(es) not built yet. ${cyan("/legal-kit:update")} builds them.`);
else if (stale) console.log(`${stale} index(es) are stale. ${cyan("/legal-kit:update")} refreshes them.`);
console.log(`\nRun the full end-to-end test with ${cyan("node $CLAUDE_PLUGIN_ROOT/mcp/lex/selftest.js")}.\n`);
