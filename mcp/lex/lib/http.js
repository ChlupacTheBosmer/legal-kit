import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR =
  process.env.LEX_MCP_CACHE_DIR || join(HERE, "..", "..", "..", ".cache", "lex");

/**
 * Built indexes live here, deliberately outside CACHE_DIR: the cache is
 * documented as safe to delete, and the lower-court index costs ~2,400 API
 * calls to rebuild.
 */
export const DATA_DIR =
  process.env.LEX_MCP_DATA_DIR || join(HERE, "..", "..", "..", ".data");

const DEFAULT_TTL_MS = Number(process.env.LEX_MCP_CACHE_TTL_MS || 12 * 60 * 60 * 1000);
const USER_AGENT =
  process.env.LEX_MCP_USER_AGENT ||
  "lex-mcp/0.1 (personal legal research; contact via repository owner)";

function keyFor(parts) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 40);
}

async function readCache(key, ttlMs) {
  if (ttlMs <= 0) return null;
  const file = join(CACHE_DIR, key);
  try {
    const st = await stat(file);
    if (Date.now() - st.mtimeMs > ttlMs) return null;
    return await readFile(file);
  } catch {
    return null;
  }
}

async function writeCache(key, buf) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, key), buf);
  } catch {
    /* cache is best-effort */
  }
}

/**
 * Fetch with timeout, retry and an on-disk cache.
 * Returns { body: Buffer, status, headers, fromCache }.
 */
export async function request(url, opts = {}) {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 60_000,
    ttlMs = DEFAULT_TTL_MS,
    retries = 2,
    cacheable = method === "GET" || opts.cacheable === true,
  } = opts;

  const key = keyFor([method, url, headers.Accept || "", headers["Accept-Language"] || "", body || ""]);

  if (cacheable) {
    const hit = await readCache(key, ttlMs);
    if (hit) return { body: hit, status: 200, headers: {}, fromCache: true };
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { "User-Agent": USER_AGENT, ...headers },
        body,
        signal: ac.signal,
        redirect: "follow",
      });
      const buf = Buffer.from(await res.arrayBuffer());
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status} from ${url}`);
        await sleep(backoff(attempt));
        continue;
      }
      if (res.ok && cacheable && ttlMs > 0) await writeCache(key, buf);
      return {
        body: buf,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        fromCache: false,
      };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) await sleep(backoff(attempt));
    }
  }
  throw new Error(`Request failed: ${method} ${url} — ${lastErr?.message || "unknown error"}`);
}

export async function getJSON(url, opts = {}) {
  const res = await request(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers || {}) },
  });
  const text = res.body.toString("utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${url} but got: ${text.slice(0, 300)}`);
  }
  if (parsed && Array.isArray(parsed.chyby) && parsed.chyby.length) {
    const e = parsed.chyby[0];
    throw new Error(`Upstream API error (${e.kod}): ${String(e.popis).slice(0, 300)}`);
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 300)}`);
  }
  return parsed;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Exponential backoff with jitter: 0.6s, 1.2s, 2.4s, 4.8s, 9.6s (capped 15s).
 * Some of the sources here — the Supreme Court's Domino server in particular —
 * return 500 under load and recover on their own, so being patient beats
 * failing fast.
 */
function backoff(attempt) {
  const base = Math.min(600 * 2 ** attempt, 15_000);
  return base + Math.floor(Math.random() * 400);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
