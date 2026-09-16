#!/usr/bin/env node
/**
 * CI check: the plugin is dormant outside a legal project.
 *
 * This is the property that keeps twenty-nine tool definitions, about eight
 * thousand tokens, out of every unrelated session on a user's machine. It is
 * easy to break by accident (a stray default, a changed env name) and the
 * breakage is invisible: everything still works, it just costs everyone
 * context forever. So it is asserted rather than trusted.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function toolsWith(env, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn("sh", [join(ROOT, "scripts", "launch.sh")], {
      stdio: ["pipe", "pipe", "ignore"], cwd,
      env: { ...process.env, LEGAL_KIT_SCOPE: "", ...env },
    });
    const timer = setTimeout(() => { p.kill(); reject(new Error("timeout")); }, 30_000);
    let buf = "";
    p.stdout.on("data", (c) => {
      buf += c;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 2) { clearTimeout(timer); p.kill(); resolve(m.result.tools.map((t) => t.name)); }
      }
    });
    p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
      protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "ci", version: "1" } } }) + "\n");
    setTimeout(() => {
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
    }, 500);
  });
}

const { mkdtemp, mkdir, writeFile } = await import("node:fs/promises");
const { tmpdir } = await import("node:os");

const plain = await mkdtemp(join(tmpdir(), "lk-plain-"));
const legal = await mkdtemp(join(tmpdir(), "lk-legal-"));
await mkdir(join(legal, ".legal-kit"), { recursive: true });
await writeFile(join(legal, ".legal-kit", "project.md"), "# test\n");

let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `\n        ${detail}`}`);
  if (!ok) failed++;
};

const outside = await toolsWith({}, plain);
check("dormant outside a legal project", outside.length === 1 && outside[0] === "legal_cite",
  `registered ${outside.length}: ${outside.join(", ")}`);

const inside = await toolsWith({}, legal);
check("full set inside a legal project", inside.length >= 29, `registered ${inside.length}`);

const forced = await toolsWith({ LEGAL_KIT_SCOPE: "always" }, plain);
check("LEGAL_KIT_SCOPE=always overrides", forced.length >= 29, `registered ${forced.length}`);

process.exit(failed ? 1 : 0);
