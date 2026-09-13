/**
 * NALUS — the Constitutional Court's decision database (nalus.usoud.cz).
 *
 * There is no API. The search is classic ASP.NET WebForms, so this drives it the
 * way a browser does:
 *
 *   1. GET  /Search/Search.aspx      -> ASP.NET_SessionId cookie + __VIEWSTATE
 *                                       + __EVENTVALIDATION + ~45 form fields
 *   2. POST /Search/Search.aspx      -> the whole form back, with the search
 *                                       criteria overridden and the clicked
 *                                       button included
 *   3. GET  /Search/Results.aspx?page=N  -> results, 0-based paging
 *
 * The part that is easy to get wrong: the form must be replayed *complete*.
 * Posting only __VIEWSTATE and a search term returns "Nebyly nalezeny žádné
 * záznamy" — the decision-form checkboxes (nalezy / usneseni / stanoviska_plena)
 * are what select which kinds of decision are searched at all, and dropping them
 * searches nothing.
 */
import { request } from "./http.js";
import { htmlToText, decodeEntities } from "./format.js";

const BASE = "https://nalus.usoud.cz";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

/**
 * Only these criteria actually execute a search.
 *
 * The form also offers klicove_slovo, predmet_rizeni, vztah_k_predpisum,
 * pravni_veta, oduvodneni, abstrakt and soudce_zpravodaj, but they are
 * readonly inputs driven by JavaScript pickers or need companion state the
 * form does not expose; posting text into them silently returns nothing.
 * `text` searches the full decision text, which covers the same ground.
 *
 * The keyword picker's vocabulary is still useful — see `keywords()`.
 */
const FIELDS = {
  text: "ctl00$MainContent$text",
  ecli: "ctl00$MainContent$ecli",
  case_number: "ctl00$MainContent$citace",
  decided_from: "ctl00$MainContent$decidedFrom",
  decided_to: "ctl00$MainContent$decidedTo",
};

const czDate = (iso) => {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error(`Date must be ISO (YYYY-MM-DD), got "${iso}"`);
  return `${Number(m[3])}. ${Number(m[2])}. ${m[1]}`;
};

/** Every submittable field with its default value — as a browser would send. */
function parseForm(doc) {
  const out = new Map();
  for (const m of doc.matchAll(/<input\b[^>]*>/gi)) {
    const tag = m[0];
    const name = tag.match(/name="([^"]+)"/i)?.[1];
    if (!name) continue;
    const type = (tag.match(/type="([^"]+)"/i)?.[1] || "text").toLowerCase();
    const value = decodeEntities(tag.match(/value="([^"]*)"/i)?.[1] ?? "");
    if (type === "checkbox" || type === "radio") {
      if (/\schecked/i.test(tag)) out.set(name, value || "on");
    } else if (type !== "submit" && type !== "image") {
      out.set(name, value);
    }
  }
  for (const m of doc.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
    const [, name, body] = m;
    const opts = [...body.matchAll(/<option\b([^>]*)>/gi)].map((o) => o[1]);
    const sel = opts.find((o) => /\sselected/i.test(o)) ?? opts[0];
    if (sel !== undefined) out.set(name, decodeEntities(sel.match(/value="([^"]*)"/i)?.[1] ?? ""));
  }
  for (const m of doc.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/gi)) {
    out.set(m[1], decodeEntities(m[2]));
  }
  return out;
}

const cookieOf = (headers) =>
  String(headers["set-cookie"] || "")
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

function parseResults(html) {
  const totalM = html.match(/Výsledky\s+[\d\s]+-\s*[\d\s]+\s*z\s*celkem\s*([\d\s]+)/i);
  const total = totalM ? Number(totalM[1].replace(/\s/g, "")) : null;

  // Every result renders as two <tr>s: one carries the identity and the data
  // cells, the other the action icons with the GetText link. Which is which is
  // not stable, so consume them in pairs and parse the combined markup.
  const rows = [...html.matchAll(/<tr class='resultData\d'[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  const items = [];
  for (let i = 0; i < rows.length; i += 2) {
    const blob = rows[i] + (rows[i + 1] || "");
    const cells = [...blob.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((c) => htmlToText(c[1]).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const sz = blob.match(/GetText\.aspx\?sz=([^"'&]+)/)?.[1] || null;
    const citation = blob.match(/ShowLink\("((?:nález|usnesení|stanovisko)[^"]*)"/i)?.[1] || null;
    const internalId = blob.match(/saveSelectedValue\("(\d+)"\)/)?.[1] || null;
    const idBlock = cells.find((c) => /ÚS\s*\d+\/\d+/.test(c)) || "";
    const caseNumber = idBlock.match(/((?:Pl|I{1,3}|IV)\s*\.?\s*ÚS\s*\d+\/\d+)/)?.[1]?.replace(/\s+/g, " ").trim() || null;
    const ecli = idBlock.match(/(ECLI:CZ:US:[^\s]+)/)?.[1] || null;
    if (!caseNumber) continue;
    const data = cells.filter((c) => c !== idBlock);
    items.push({
      caseNumber, ecli, citation, sz, internalId,
      party_and_subject: data[0] || null,
      dates: data[1] || null,
      provisions: data[2] || null,
      form: data[3] || null,
      verdict: data[4] || null,
      textUrl: sz ? `${BASE}/Search/GetText.aspx?sz=${sz}` : null,
    });
  }
  return { total, items };
}

/**
 * Search the Constitutional Court. Criteria are ANDed by NALUS itself.
 * `page` is 0-based.
 */
export async function search(opts = {}) {
  const used = Object.keys(FIELDS).filter((k) => opts[k]);
  if (!used.length) throw new Error("A Constitutional Court search needs at least one criterion.");

  // 1. open the form, keep the session
  const start = await request(`${BASE}/Search/Search.aspx`, {
    timeoutMs: 60_000, ttlMs: 0, headers: { "User-Agent": UA },
  });
  if (start.status !== 200) throw new Error(`NALUS search page returned HTTP ${start.status}`);
  const cookie = cookieOf(start.headers);
  const doc = start.body.toString("utf8");
  const form = parseForm(doc);

  // 2. post the complete form with our criteria on top
  form.set("__EVENTTARGET", "");
  form.set("__EVENTARGUMENT", "");
  for (const [ours, theirs] of Object.entries(FIELDS)) {
    if (!opts[ours]) continue;
    const v = ours.endsWith("_from") || ours.endsWith("_to") ? czDate(opts[ours]) : String(opts[ours]);
    form.set(theirs, v);
  }
  if (opts.page_size) form.set("ctl00$MainContent$resultsPageSize", String(opts.page_size));
  form.set("ctl00$MainContent$but_search", "Vyhledat");

  const body = new URLSearchParams([...form.entries()]).toString();
  const posted = await request(`${BASE}/Search/Search.aspx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${BASE}/Search/Search.aspx`,
      Cookie: cookie,
      "User-Agent": UA,
    },
    body, timeoutMs: 90_000, cacheable: false, retries: 1,
  });
  if (posted.status !== 200) throw new Error(`NALUS search POST returned HTTP ${posted.status}`);

  // 3. the session now holds the result set; page through it
  const page = Math.max(Number(opts.page) || 0, 0);
  let html = posted.body.toString("utf8");
  if (page > 0) {
    const paged = await request(`${BASE}/Search/Results.aspx?page=${page}`, {
      headers: { Cookie: cookie, Referer: `${BASE}/Search/Results.aspx`, "User-Agent": UA },
      timeoutMs: 60_000, cacheable: false,
    });
    if (paged.status !== 200) throw new Error(`NALUS results page ${page} returned HTTP ${paged.status}`);
    html = paged.body.toString("utf8");
  }

  const parsed = parseResults(html);
  if (!parsed.items.length && /Nebyly nalezeny žádné záznamy/i.test(html)) {
    return { total: 0, items: [], criteria: used };
  }
  return { ...parsed, criteria: used, page };
}

/**
 * The Constitutional Court's own subject index (věcný rejstřík) — 500-odd
 * controlled terms. The search form cannot be driven by them, but they are the
 * court's own vocabulary, which makes them the right words to put into a
 * full-text query. Use them to turn a concept into the phrasing ÚS uses.
 */
let _keywordCache = null;
export async function keywords(filter) {
  if (!_keywordCache) {
    // Without a session the popup returns a stub, not the tree.
    const seed = await request(`${BASE}/Search/Search.aspx`, {
      timeoutMs: 60_000, ttlMs: 0, headers: { "User-Agent": UA },
    });
    const cookie = cookieOf(seed.headers);
    const res = await request(
      `${BASE}/dialogs/PopupCiselnikTree.aspx?control=x&type=klicove_slovo&targetInfo=y`,
      // Not cached: the response depends on the session cookie, which the cache
      // key does not include. Held in memory for the life of the process instead.
      { timeoutMs: 90_000, ttlMs: 0, cacheable: false,
        headers: { "User-Agent": UA, Cookie: cookie, Referer: `${BASE}/Search/Search.aspx` } }
    );
    if (res.status !== 200) throw new Error(`NALUS keyword list returned HTTP ${res.status}`);
    const html = res.body.toString("utf8");
    const terms = [...html.matchAll(/<a[^>]*class="TreeViewDB[^"]*"[^>]*>([\s\S]{0,120}?)<\/a>/gi)]
      .map((m) => htmlToText(m[1]).trim())
      .filter((t) => t.length > 1);
    _keywordCache = [...new Set(terms)].sort((a, b) => a.localeCompare(b, "cs"));
  }
  if (!filter) return _keywordCache;
  const fold = (x) => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const f = fold(filter);
  return _keywordCache.filter((t) => fold(t).includes(f));
}
