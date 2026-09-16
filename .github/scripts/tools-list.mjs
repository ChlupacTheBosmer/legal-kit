#!/usr/bin/env node
/**
 * CI check: the server starts, speaks the protocol, and registers its tools.
 *
 * Touches no government registry, so it is safe on every push, and it catches
 * the breakage that matters most: a server that no longer starts is a plugin
 * with no legal tools at all, which a syntax check does not notice.
 *
 * LEGAL_KIT_SCOPE=always because the full set is otherwise registered only
 * inside a configured legal project, and CI is not in one.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPECTED = 29;
const REQUIRED = ["legal_cite", "cz_act_text", "eu_act_text", "cz_nss_search", "cz_mzp_search"];

const proc = spawn(process.execPath, [join(ROOT, "mcp", "lex", "server.js")], {
  stdio: ["pipe", "pipe", "inherit"],
  env: { ...process.env, LEGAL_KIT_SCOPE: "always" },
});

const done = (code, message) => { console.log(message); proc.kill(); process.exit(code); };
const timer = setTimeout(() => done(1, "FAIL: no answer to tools/list within 30s"), 30_000);

let buf = "";
proc.stdout.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== 2) continue;
    clearTimeout(timer);
    const names = (msg.result?.tools ?? []).map((t) => t.name).sort();
    console.log(`${names.length} tools registered`);
    if (names.length < EXPECTED) return done(1, `FAIL: expected at least ${EXPECTED}, got ${names.length}`);
    const missing = REQUIRED.filter((r) => !names.includes(r));
    if (missing.length) return done(1, `FAIL: missing ${missing.join(", ")}`);
    done(0, "ok");
  }
});
proc.on("error", (e) => done(1, `FAIL: could not start the server: ${e.message}`));

const send = (o) => proc.stdin.write(JSON.stringify(o) + "\n");
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
  protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "ci", version: "1" } } });
setTimeout(() => {
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
}, 500);
