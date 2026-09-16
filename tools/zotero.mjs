#!/usr/bin/env node
/**
 * Zotero helper for the `law` collection.
 *
 *   node tools/zotero.mjs collections [--under law]
 *   node tools/zotero.mjs search "<query>" [--limit N]
 *   node tools/zotero.mjs add --collection KEY --type journalArticle \
 *        --title "..." [--creators "Surname, Given; Surname, Given"] \
 *        [--publication "..."] [--date 2024] [--url ...] [--doi ...] [--tags "a,b"] [--abstract "..."]
 *   node tools/zotero.mjs upload --collection KEY <file.pdf> ...
 *
 * Zotero is for *commentary* — articles, textbooks, regulator guidance PDFs.
 * Legislation and case law are cited as links to the official registry via
 * `legal_cite`, not kept as bibliography entries.
 *
 * Credentials come from the zotero MCP entry in ~/.claude.json, so the API key
 * lives in one place. Nothing is sent anywhere except api.zotero.org.
 */
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { homedir } from "node:os";

/**
 * Credentials, in order of preference:
 *   1. the environment (ZOTERO_API_KEY, ZOTERO_LIBRARY_ID, ZOTERO_LIBRARY_TYPE)
 *   2. a `zotero` MCP entry in ~/.claude.json, so the key lives in one place if
 *      you also run the Zotero MCP server
 * Nothing is sent anywhere except api.zotero.org.
 */
async function credentials() {
  if (process.env.ZOTERO_API_KEY) {
    return {
      key: process.env.ZOTERO_API_KEY,
      lib: process.env.ZOTERO_LIBRARY_ID,
      type: process.env.ZOTERO_LIBRARY_TYPE,
    };
  }
  // zotero-kit and academic-writing-kit keep their keys in a .env. Read it too,
  // so configuring either family serves both rather than asking twice.
  for (const f of [`${process.cwd()}/.env`, `${homedir()}/.claude/writing-kit/.env`]) {
    try {
      const env = {};
      for (const line of (await readFile(f, "utf8")).split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("=");
        env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
      }
      if (env.ZOTERO_API_KEY) {
        return { key: env.ZOTERO_API_KEY, lib: env.ZOTERO_LIBRARY_ID, type: env.ZOTERO_LIBRARY_TYPE };
      }
    } catch { /* not there */ }
  }
  try {
    const cfg = JSON.parse(await readFile(`${homedir()}/.claude.json`, "utf8"));
    const env = cfg.mcpServers?.zotero?.env;
    if (env?.ZOTERO_API_KEY) {
      return { key: env.ZOTERO_API_KEY, lib: env.ZOTERO_LIBRARY_ID, type: env.ZOTERO_LIBRARY_TYPE };
    }
  } catch { /* no ~/.claude.json, or not readable */ }
  throw new Error(
    "No Zotero credentials.\n\n" +
      "Set them in your shell:\n" +
      "  export ZOTERO_API_KEY=...        # zotero.org/settings/keys\n" +
      "  export ZOTERO_LIBRARY_ID=...     # your numeric user id, or the group id\n" +
      "  export ZOTERO_LIBRARY_TYPE=user  # or 'group'\n\n" +
      "Or add a `zotero` MCP entry with those in its `env` to ~/.claude.json.\n" +
      "Zotero is optional: it holds commentary and articles, while legislation and\n" +
      "case law are cited as links to the official registry via `legal_cite`."
  );
}

const creds = await credentials();
if (!creds.lib) throw new Error("ZOTERO_LIBRARY_ID is not set. It is your numeric user id from zotero.org/settings/keys.");
const KEY = creds.key;
const LIB = creds.lib;
const TYPE = creds.type === "group" ? "groups" : "users";
const BASE = `https://api.zotero.org/${TYPE}/${LIB}`;
const H = { "Zotero-API-Version": "3", "Zotero-API-Key": KEY };

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const body = await res.text();
  if (!res.ok) throw new Error(`Zotero ${opts.method || "GET"} ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null;
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

async function allCollections() {
  const out = [];
  for (let start = 0; ; start += 100) {
    const page = await api(`/collections?limit=100&start=${start}`);
    out.push(...page);
    if (page.length < 100) break;
  }
  return out;
}

async function cmdCollections(f) {
  const cols = await allCollections();
  const byKey = Object.fromEntries(cols.map((c) => [c.key, c]));
  const rootName = f.under || "law";
  const root = cols.find((c) => c.data.name === rootName && !c.data.parentCollection);
  if (!root) {
    console.log(`No top-level collection named "${rootName}". Top-level collections:`);
    cols.filter((c) => !c.data.parentCollection).forEach((c) => console.log(`  ${c.data.name}  ${c.key}`));
    return;
  }
  console.log(`${root.data.name}  ${root.key}  (${root.meta.numItems} items)`);
  cols
    .filter((c) => c.data.parentCollection === root.key)
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .forEach((c) => console.log(`  ${c.data.name.padEnd(30)} ${c.key}  (${c.meta.numItems} items)`));
}

async function cmdSearch(f) {
  const q = f._[0];
  if (!q) throw new Error('usage: zotero.mjs search "<query>"');
  const items = await api(`/items?q=${encodeURIComponent(q)}&qmode=everything&limit=${f.limit || 15}`);
  if (!items.length) return console.log("no matches");
  for (const it of items) {
    const d = it.data;
    if (d.itemType === "attachment") continue;
    const who = (d.creators || []).map((c) => c.lastName || c.name).join(", ");
    console.log(`- ${d.title}\n  ${who}${d.date ? ` (${d.date})` : ""} · ${d.itemType} · key ${it.key}`);
  }
}

async function cmdAdd(f) {
  if (!f.collection || !f.title) throw new Error("add requires --collection and --title");
  const creators = (f.creators || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [last, first] = s.split(",").map((x) => x.trim());
      return first ? { creatorType: "author", lastName: last, firstName: first }
                   : { creatorType: "author", name: last };
    });
  const item = {
    itemType: f.type || "journalArticle",
    title: f.title,
    creators,
    collections: [f.collection],
    tags: (f.tags || "law").split(",").map((t) => ({ tag: t.trim() })).filter((t) => t.tag),
  };
  if (f.publication) item.publicationTitle = f.publication;
  if (f.date) item.date = String(f.date);
  if (f.url) item.url = f.url;
  if (f.doi) item.DOI = f.doi;
  if (f.abstract) item.abstractNote = f.abstract;
  if (f.pages) item.pages = String(f.pages);

  const r = await api("/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([item]),
  });
  if (r.failed && Object.keys(r.failed).length) throw new Error(JSON.stringify(r.failed));
  const key = Object.values(r.successful)[0].key;
  console.log(`added ${item.itemType}: ${item.title}\n  key ${key}`);
}

const titleFrom = (file) => basename(file, ".pdf").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

async function uploadOne(collection, file) {
  const bytes = await readFile(file);
  const st = await stat(file);
  const md5 = createHash("md5").update(bytes).digest("hex");
  const name = basename(file);

  const parent = await api("/items", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ itemType: "document", title: titleFrom(file), collections: [collection], tags: [{ tag: "law" }] }]),
  });
  const parentKey = parent.successful["0"].key;

  const att = await api("/items", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ itemType: "attachment", parentItem: parentKey, linkMode: "imported_file",
                            title: name, filename: name, contentType: "application/pdf" }]),
  });
  const attKey = att.successful["0"].key;

  const authRes = await fetch(`${BASE}/items/${attKey}/file`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/x-www-form-urlencoded", "If-None-Match": "*" },
    body: new URLSearchParams({ md5, filename: name, filesize: String(st.size), mtime: String(Math.floor(st.mtimeMs)), params: "1" }),
  });
  const auth = JSON.parse(await authRes.text());
  if (auth.exists) return { file: name, parentKey, status: "already stored" };

  const form = new FormData();
  for (const [k, v] of Object.entries(auth.params)) form.append(k, v);
  form.append("file", new Blob([bytes], { type: "application/pdf" }), name);
  const up = await fetch(auth.url, { method: "POST", body: form });
  if (!up.ok) throw new Error(`storage upload failed (${up.status})`);

  const reg = await fetch(`${BASE}/items/${attKey}/file`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/x-www-form-urlencoded", "If-None-Match": "*" },
    body: new URLSearchParams({ upload: auth.uploadKey }),
  });
  if (!reg.ok) throw new Error(`registering upload failed (${reg.status})`);
  return { file: name, parentKey, status: "uploaded" };
}

async function cmdUpload(f) {
  if (!f.collection || !f._.length) throw new Error("upload requires --collection KEY and at least one file");
  for (const file of f._) {
    try {
      const r = await uploadOne(f.collection, file);
      console.log(`  ${r.status.padEnd(14)} ${r.file}  (item ${r.parentKey})`);
    } catch (e) {
      console.log(`  FAILED         ${basename(file)}: ${e.message.slice(0, 160)}`);
    }
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const f = flags(rest);
const table = { collections: cmdCollections, search: cmdSearch, add: cmdAdd, upload: cmdUpload };
if (!table[cmd]) {
  console.error(`usage: zotero.mjs <collections|search|add|upload> ...\n\n${await readFile(new URL(import.meta.url)).then((b) => b.toString().split("*/")[0].split("\n").slice(2, 18).join("\n"))}`);
  process.exit(2);
}
await table[cmd](f);
