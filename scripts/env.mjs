/**
 * Environment probing shared by `setup`, `doctor` and `update`.
 *
 * Everything here answers one question: can this machine actually run the
 * thing, and if not, what exactly is missing and how is it installed. A check
 * that reports "something went wrong" is worse than no check.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, readFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const run = promisify(execFile);
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Everything writable lives here, never inside the plugin: plugin installs are
 * versioned, so an upgrade is a new directory and anything written inside it
 * would be orphaned. Indexes are expensive to rebuild, so they must survive.
 */
export const DATA_HOME = process.env.LEGAL_KIT_DATA || join(homedir(), ".legal-kit");

export const exists = async (p) => {
  try { await access(p); return true; } catch { return false; }
};

/** node:sqlite is what every local index is built on. */
export function nodeCheck() {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    name: "Node.js",
    version: process.versions.node,
    ok: major >= 22,
    required: ">= 22",
    fix: "Install Node 22 or newer (https://nodejs.org, or `brew install node`, or nvm).",
    why: "The local indexes use the built-in node:sqlite module, added in Node 22.",
  };
}

export async function sqliteCheck() {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE t USING fts5(a, tokenize='unicode61 remove_diacritics 2');");
    db.close();
    return { name: "node:sqlite with FTS5", ok: true, version: "built in" };
  } catch (e) {
    return {
      name: "node:sqlite with FTS5",
      ok: false,
      version: "unavailable",
      fix: "Use an official Node build; some minimal or distro builds omit SQLite or FTS5.",
      why: `Every local index is an FTS5 table. ${String(e.message).slice(0, 120)}`,
    };
  }
}

async function binary(cmd, args, { name, required, fix, why }) {
  try {
    const { stdout, stderr } = await run(cmd, args, { timeout: 15_000 });
    const line = (stdout || stderr).split("\n").find(Boolean) || "present";
    return { name, ok: true, version: line.trim().slice(0, 60) };
  } catch {
    return { name, ok: false, version: "not found", required, fix, why };
  }
}

export const npmCheck = () =>
  binary("npm", ["--version"], {
    name: "npm",
    required: "any",
    fix: "npm ships with Node. If it is missing, reinstall Node.",
    why: "Needed once, to install the MCP server's two dependencies.",
  });

export const pdftotextCheck = () =>
  binary("pdftotext", ["-v"], {
    name: "pdftotext (poppler)",
    required: "optional",
    fix: "macOS: `brew install poppler`. Debian/Ubuntu: `sudo apt install poppler-utils`.",
    why: "Without it, ministry guidance PDFs are indexed by title and URL only, not by their text.",
  });

export const pythonCheck = () =>
  binary("python3", ["--version"], {
    name: "python3",
    required: "optional",
    fix: "macOS: already present, or `brew install python`. Debian/Ubuntu: `sudo apt install python3`.",
    why: "Only needed for the Google Docs drafting helper (tools/gdoc.py).",
  });

export const gitCheck = () =>
  binary("git", ["--version"], {
    name: "git",
    required: "optional",
    fix: "macOS: `xcode-select --install`. Debian/Ubuntu: `sudo apt install git`.",
    why: "Only needed to pull updates to this repository.",
  });

/** Are the MCP server's dependencies installed? */
export async function depsCheck() {
  const dir = join(ROOT, "mcp", "lex", "node_modules", "@modelcontextprotocol", "sdk");
  const present = await exists(dir);
  return {
    name: "MCP server dependencies",
    ok: present,
    version: present ? "installed" : "not installed",
    fix: "Restart Claude Code: the plugin installs them on first start. If that fails, run `npm install` in the plugin's mcp/lex.",
    why: "The lex server needs @modelcontextprotocol/sdk and zod.",
  };
}

/** Optional integrations, reported but never required. */
export async function integrationChecks() {
  const out = [];

  // Two separate prerequisites, reported separately: people hit the missing
  // Python libraries long after they thought Google was "set up".
  const googleToken = join(homedir(), ".claude_google_token.json");
  const hasToken = await exists(googleToken);
  let hasLibs = false;
  try {
    await run("python3", ["-c", "import google.oauth2.credentials, googleapiclient.discovery"], { timeout: 20_000 });
    hasLibs = true;
  } catch { /* not installed */ }
  out.push({
    name: "Google Docs / Drive",
    ok: hasToken && hasLibs,
    version: hasToken && hasLibs ? "ready" : hasToken ? "token present, Python libraries missing" : "not configured",
    optional: true,
    fix: hasToken && !hasLibs
      ? "python3 -m pip install -r tools/requirements.txt"
      : "python3 -m pip install -r tools/requirements.txt && python3 tools/google-auth.py <client_secret.json>  (see docs/google-docs-workflow.md)",
  });

  let zotero = Boolean(process.env.ZOTERO_API_KEY);
  let zoteroWhere = zotero ? "from the environment" : "";
  if (!zotero) {
    try {
      const cfg = JSON.parse(await readFile(join(homedir(), ".claude.json"), "utf8"));
      zotero = Boolean(cfg?.mcpServers?.zotero?.env?.ZOTERO_API_KEY);
      if (zotero) zoteroWhere = "from ~/.claude.json";
    } catch { /* no config, no Zotero */ }
  }
  out.push({
    name: "Zotero",
    ok: zotero,
    version: zotero ? `API key present ${zoteroWhere}` : "not configured",
    optional: true,
    fix: "export ZOTERO_API_KEY / ZOTERO_LIBRARY_ID / ZOTERO_LIBRARY_TYPE, or add a `zotero` MCP entry to ~/.claude.json. Key from zotero.org/settings/keys.",
  });

  const pluginCfg = join(homedir(), ".claude", "plugins", "config", "claude-for-legal");
  out.push({
    name: "claude-for-legal plugins",
    ok: await exists(pluginCfg),
    version: (await exists(pluginCfg)) ? "configured" : "not installed",
    optional: true,
    fix: "Optional. If installed, their US defaults must be corrected against docs/jurisdiction-overlay.md.",
  });

  return out;
}

/** Can we reach the official registries? One cheap request each. */
export async function reachabilityChecks() {
  const targets = [
    ["e-Sbírka (Czech Collection of Laws)", "https://www.e-sbirka.cz/"],
    ["EUR-Lex / CELLAR (EU law)", "https://eur-lex.europa.eu/"],
    ["Nejvyšší správní soud", "https://vyhledavac.nssoud.cz/"],
    ["Nejvyšší soud", "https://rozhodnuti.nsoud.cz/"],
    ["Ústavní soud (NALUS)", "https://nalus.usoud.cz/"],
    ["Ministry of Justice open data", "https://rozhodnuti.justice.cz/"],
    ["ÚOOÚ", "https://uoou.gov.cz/"],
    ["MŽP", "https://www.mzp.gov.cz/"],
    ["ARES (business register)", "https://ares.gov.cz/"],
  ];
  return Promise.all(
    targets.map(async ([name, url]) => {
      const t0 = Date.now();
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 20_000);
        const res = await fetch(url, { method: "GET", signal: ac.signal, redirect: "follow" });
        clearTimeout(timer);
        return { name, ok: res.status < 500, version: `HTTP ${res.status} in ${Date.now() - t0}ms`, optional: false };
      } catch (e) {
        return {
          name, ok: false, version: "unreachable", optional: false,
          fix: "Check your network or proxy. All of these are public and unauthenticated.",
          why: String(e.message).slice(0, 80),
        };
      }
    })
  );
}

/** Index files, their size and their age. */
export async function indexStatus() {
  const dataDir = process.env.LEX_MCP_DATA_DIR || join(DATA_HOME, "data");
  const names = [
    ["ÚOOÚ guidance", "uoou.db", 30, "/legal-kit:update"],
    ["MŽP guidance and Věstník", "mzp.db", 90, "/legal-kit:update"],
    ["District and regional courts", "justice.db", 90, "/legal-kit:update"],
  ];
  const out = [];
  for (const [label, file, staleDays, cmd] of names) {
    const p = join(dataDir, file);
    try {
      const st = await stat(p);
      const ageDays = Math.floor((Date.now() - st.mtimeMs) / 86_400_000);
      out.push({
        label, file: p, built: true, ageDays, staleDays, cmd,
        sizeMb: +(st.size / 1048576).toFixed(1),
        stale: ageDays > staleDays,
      });
    } catch {
      out.push({ label, file: p, built: false, cmd, staleDays });
    }
  }
  return out;
}

export const isMac = () => platform() === "darwin";
export const isLinux = () => platform() === "linux";
