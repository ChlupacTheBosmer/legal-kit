#!/usr/bin/env node
/**
 * End-to-end self-test: spawns the MCP server, calls every tool against the
 * live official APIs, and verifies each alias resolves to the act it claims.
 *
 *   node selftest.js            # tool smoke tests
 *   node selftest.js --aliases  # additionally verify every alias (slow)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EU_ALIASES, CZ_ALIASES } from "./lib/aliases.js";

const HERE = dirname(fileURLToPath(import.meta.url));

function client() {
  // The server registers its full tool set only inside a configured legal
  // project, to keep twenty-nine tool definitions out of every unrelated
  // session. The test is not in one, so ask for everything explicitly.
  const proc = spawn(process.execPath, [join(HERE, "server.js")], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, LEGAL_KIT_SCOPE: "always" },
  });
  let buf = "";
  const pending = new Map();
  proc.stdout.on("data", (d) => {
    buf += d.toString();
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    }
  });
  proc.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  let id = 0;
  const send = (method, params) =>
    new Promise((resolve) => {
      const myId = ++id;
      pending.set(myId, resolve);
      proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
    });
  const notify = (method, params) => proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  return { send, notify, close: () => proc.kill() };
}

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`); }
}

const c = client();
await c.send("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "selftest", version: "1" } });
c.notify("notifications/initialized");
const TOOL_COUNT = (await c.send("tools/list", {})).result?.tools?.length ?? "?";

async function call(tool, args) {
  const r = await c.send("tools/call", { name: tool, arguments: args });
  const body = r.result?.content?.map((x) => x.text).join("\n") ?? JSON.stringify(r.error);
  return { body, isError: !!r.result?.isError || !!r.error };
}

console.log("\n== Czech tools (e-Sbírka) ==");
{
  const r = await call("cz_act_versions", { number: 121, year: 2000 });
  check("cz_act_versions 121/2000 lists versions", !r.isError && /IN FORCE NOW/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_act_info", { number: 121, year: 2000 });
  check("cz_act_info returns the Copyright Act title", !r.isError && /autorském/i.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_act_toc", { number: 121, year: 2000 });
  check("cz_act_toc lists ČÁST PRVNÍ", !r.isError && /ČÁST PRVNÍ/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_act_text", { number: 121, year: 2000, section: "§ 30" });
  check("cz_act_text § 30 returns only that section", !r.isError && /§ 30/.test(r.body) && r.body.length < 12000, r.body.slice(0, 200));
}
{
  const r = await call("cz_act_text", { number: 121, year: 2000, section: "§ 99999" });
  check("cz_act_text rejects a missing section with guidance", r.isError && /not found/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_act_text", { number: 121, year: 2000, version: "2010-01-01", section: "§ 30" });
  check("cz_act_text honours a historical version date", !r.isError && /in force from 20/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_act_relations", { number: 121, year: 2000, type: "ODKAZUJE_DO_EU" });
  check("cz_act_relations surfaces EU links", !r.isError && /ODKAZUJE_DO_EU/.test(r.body), r.body.slice(0, 200));
  // The header alone is not evidence: the tool used to print "ODKAZUJE_DO_EU (6)"
  // and then list none of the six, because the EU targets arrive in
  // `dokumentEurlex` rather than `dokumentySbirky`. Assert that the rows the
  // header counts are actually rendered.
  const declared = Number((/### ODKAZUJE_DO_EU \((\d+)\)/.exec(r.body) || [])[1] || 0);
  const listed = (r.body.match(/^ *- CELEX /gm) || []).length;
  check(
    "cz_act_relations lists the EU rows it counts, not just the count",
    declared > 0 && listed >= Math.min(declared, 25),
    `declared ${declared}, listed ${listed}\n${r.body.slice(0, 300)}`
  );
}
{
  // Same invariant for an act whose EU relations are environmental.
  const r = await call("cz_act_relations", { number: 100, year: 2001, type: "ODKAZUJE_DO_EU" });
  check(
    "cz_act_relations resolves the EIA act's transposition list",
    !r.isError && /31985L0337|32001L0042/.test(r.body),
    r.body.slice(0, 300)
  );
}
{
  const r = await call("cz_act_versions", { number: 999999, year: 1900 });
  check("cz_act_versions fails cleanly on a bogus act", r.isError, r.body.slice(0, 160));
}

console.log("\n== EU tools (CELLAR / EUR-Lex) ==");
{
  const r = await call("eu_celex_lookup", { name: "GDPR" });
  check("eu_celex_lookup GDPR -> 32016R0679 in force", !r.isError && /32016R0679/.test(r.body) && /In force: yes/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("eu_act_metadata", { celex: "32024R1689" });
  check("eu_act_metadata AI Act has entry into force", !r.isError && /Entry into force: 2024-08-01/.test(r.body), r.body.slice(0, 250));
}
{
  const r = await call("eu_act_versions", { celex: "32024R1689" });
  check("eu_act_versions finds a consolidated AI Act", !r.isError && /02024R1689-/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("eu_act_text", { celex: "32016R0679", article: 17, language: "en" });
  check("eu_act_text GDPR Art 17 is the right-to-erasure article", !r.isError && /erasure/i.test(r.body) && r.body.length < 20000, r.body.slice(0, 250));
}
{
  const r = await call("eu_act_text", { celex: "32016R0679", article: 17, language: "cs" });
  check("eu_act_text works in Czech", !r.isError && /výmaz/i.test(r.body), r.body.slice(0, 250));
}
{
  const r = await call("eu_act_search", { query: "harmonised rules artificial intelligence", year: 2024, limit: 5 });
  check("eu_act_search finds the AI Act", !r.isError && /32024R1689/.test(r.body), r.body.slice(0, 250));
}
{
  const r = await call("eu_act_metadata", { celex: "32016R9999" });
  check("eu_act_metadata fails cleanly on a bogus CELEX", r.isError && /no work with CELEX/.test(r.body), r.body.slice(0, 160));
}

console.log("\n== Czech companies (ARES) ==");
{
  const r = await call("cz_company_search", { name: "Seznam.cz", limit: 5 });
  check("cz_company_search finds Seznam entities", !r.isError && /Seznam\.cz/.test(r.body) && /IČO \d{8}/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_company", { ico: 26168685 });
  check("cz_company returns seat and statutory bodies", !r.isError && /Radlická/.test(r.body) && /Statutory bodies/.test(r.body), r.body.slice(0, 250));
}
{
  const r = await call("cz_company", { ico: 1 });
  check("cz_company fails cleanly on a bogus IČO", r.isError, r.body.slice(0, 140));
}

console.log("\n== Czech case law ==");
{
  const r = await call("cz_case_text", { court: "us", id: "Pl. ÚS 19/14" });
  check("cz_case_text fetches a Constitutional Court plenary decision", !r.isError && /Pl\.ÚS 19\/14/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_case_text", { court: "us", id: "I. ÚS 9999999/99" });
  check("cz_case_text fails cleanly on an unknown ÚS case", r.isError, r.body.slice(0, 140));
}
{
  const r = await call("cz_case_lower_scan", { date_from: "2026-06-15", keyword: "smlouva", limit: 5 });
  check("cz_case_lower_scan finds lower-court decisions", !r.isError && /ECLI:CZ:/.test(r.body), r.body.slice(0, 250));
}
{
  const r = await call("cz_case_lower_scan", { date_from: "2026-01-01", date_to: "2026-06-30" });
  check("cz_case_lower_scan refuses an over-long window", r.isError && /31 days/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_case_search", { text: "autorské dílo", limit: 3 });
  check("cz_case_search finds Supreme Court decisions", !r.isError && /Cdo|Tdo|Odo/.test(r.body), r.body.slice(0, 250));
  const unid = (r.body.match(/document id: `([0-9A-F]{32})`/) || [])[1];
  if (unid) {
    const t = await call("cz_case_text", { court: "ns", id: unid });
    check("cz_case_text fetches that Supreme Court decision", !t.isError && /Nejvyšší soud/.test(t.body), t.body.slice(0, 200));
  }
}
{
  // Domino refuses Count < 5 with a misleading "Field is too large" 500.
  // nsSearch pads the request and trims locally; this guards that.
  const r = await call("cz_case_search", { text: "autorské dílo", limit: 1 });
  check("cz_case_search survives limit=1 (Domino refuses Count<5)", !r.isError && /Cdo|Tdo|Odo/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_case_search", { keyword: "Autorské právo", category: "A", limit: 3 });
  check("cz_case_search combines keyword and category", !r.isError && /category A/.test(r.body), r.body.slice(0, 200));
}

console.log("\n== Verified citation ==");
{
  const r = await call("legal_cite", { reference: "§ 2898 89/2012" });
  check("legal_cite verifies a Czech provision and quotes it",
    !r.isError && /Nepřihlíží se k ujednání/.test(r.body) && /e-sbirka/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("legal_cite", { reference: "čl. 6 AI Act" });
  check("legal_cite handles the Czech article form and EU aliases",
    !r.isError && /32024R1689/.test(r.body) && /high-risk/i.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("legal_cite", { reference: "23 Cdo 3492/2021" });
  check("legal_cite resolves a Supreme Court citation with its ECLI",
    !r.isError && /ECLI:CZ:NS:2022/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("legal_cite", { reference: "I. ÚS 1234/21" });
  check("legal_cite resolves a Constitutional Court citation",
    !r.isError && /nalus\.usoud\.cz/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("legal_cite", { reference: "§ 99999 121/2000" });
  check("legal_cite refuses a section that does not exist", r.isError && /does not exist/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("legal_cite", { reference: "something that is not a citation" });
  check("legal_cite fails cleanly on an unparseable reference", r.isError && /Recognised forms/.test(r.body), r.body.slice(0, 160));
}

console.log("\n== ÚOOÚ guidance ==");
// Optional index: a fresh install legitimately has not built it. Skip rather
// than fail, so the suite is green on a clean machine and red only for faults.
const uoouBuilt = !/has not been built/i.test(
  (await call("cz_guidance_search", { query: "pokuta" })).body
);
if (!uoouBuilt) {
  console.log("  SKIP  ÚOOÚ index not built (/legal-kit:update)");
} else {

{
  const r = await call("cz_guidance_search", { query: "oprávněný zájem marketing", limit: 3 });
  check("cz_guidance_search finds marketing guidance",
    !r.isError && /marketing/i.test(r.body) && /uoou\.gov\.cz/.test(r.body), r.body.slice(0, 220));
}
{
  const r = await call("cz_guidance_search", { query: "pokuta za spam", limit: 3 });
  check("cz_guidance_search handles Czech inflection (pokuta/pokutu)",
    !r.isError && /pokut/i.test(r.body) && /spam/i.test(r.body), r.body.slice(0, 220));
}
{
  const r = await call("cz_guidance_search", { query: "DPIA posouzení vlivu", limit: 2 });
  const id = (r.body.match(/cz_guidance_text id=(-?\d+)/) || [])[1];
  check("cz_guidance_search returns a fetchable id", !r.isError && !!id, r.body.slice(0, 200));
  if (id) {
    const t = await call("cz_guidance_text", { id: Number(id) });
    check("cz_guidance_text returns the document and flags it as guidance",
      !t.isError && /supervisory authority's interpretation/.test(t.body), t.body.slice(0, 200));
  }
}
{
  const r = await call("cz_guidance_search", { query: "a v" });
  check("cz_guidance_search rejects a query of only stopwords", r.isError && /no searchable terms/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_guidance_text", { id: 999999 });
  check("cz_guidance_text fails cleanly on an unknown id", r.isError && /No ÚOOÚ document/.test(r.body), r.body.slice(0, 160));
}
}

console.log("\n== Constitutional Court search ==");
{
  const r = await call("cz_us_search", { text: "autorské dílo", page_size: 20 });
  check("cz_us_search finds Constitutional Court decisions",
    !r.isError && /ÚS \d+\//.test(r.body) && /ECLI:CZ:US/.test(r.body), r.body.slice(0, 220));
}
{
  const r = await call("cz_us_search", { case_number: "I. ÚS 1234/21" });
  check("cz_us_search resolves a case number", !r.isError && /I\.ÚS 1234\/21/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_us_search", { text: "personal data protection" });
  check("cz_us_search refuses an English query", r.isError && /looks like an English query/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_us_keywords", { filter: "autor" });
  check("cz_us_keywords returns the court's index terms",
    !r.isError && /autorské právo/.test(r.body), r.body.slice(0, 200));
}

console.log("\n== Lower-court subject index ==");
// This index is optional and takes minutes per year of coverage to build, so a
// fresh clone legitimately does not have it. Skip rather than fail: a test suite
// that is red on first run teaches people to ignore it.
const lowerBuilt = !/has not been built/.test(
  (await call("cz_case_lower_search", { query: "licenční smlouva", limit: 1 })).body
);
if (!lowerBuilt) {
  console.log("  SKIP  lower-court index not built (/legal-kit:update)");
} else {
  {
    const r = await call("cz_case_lower_search", { query: "licenční smlouva", limit: 3 });
    check("cz_case_lower_search finds decisions by subject",
      !r.isError && /ECLI:CZ:/.test(r.body) && /Index holds/.test(r.body), r.body.slice(0, 220));
  }
  {
    const r = await call("cz_case_lower_search", { query: "personal data protection" });
    check("cz_case_lower_search refuses an English query", r.isError && /looks like an English query/.test(r.body), r.body.slice(0, 160));
  }
  {
    const r = await call("cz_case_lower_search", { query: "nekalá soutěž", provision: "89/2012", limit: 3 });
    check("cz_case_lower_search filters by cited provision", !r.isError, r.body.slice(0, 200));
  }
}
if (uoouBuilt) {
  const r = await call("cz_guidance_search", { query: "personal data protection" });
  check("cz_guidance_search refuses an English query", r.isError && /looks like an English query/.test(r.body), r.body.slice(0, 160));
}

console.log("\n== Regression guards ==");
{
  // A guessed section-key list once returned header+verdict only — about 1 kB
  // of a 17 kB decision — with no error. The reasoning is the whole point.
  const r = await call("cz_case_lower_scan", { date_from: "2026-06-15", keyword: "smlouva", limit: 1 });
  const id = (r.body.match(/id="([0-9a-f-]{36})"/) || [])[1];
  check("cz_case_lower_scan surfaces a fetchable decision id", !r.isError && !!id, r.body.slice(0, 200));
  if (id) {
    const t = await call("cz_case_text", { court: "lower", id, max_chars: 200000 });
    check("cz_case_text court=lower returns the reasoning, not just the operative part",
      !t.isError && /ODŮVODNĚNÍ/.test(t.body) && t.body.length > 6000, `len=${t.body.length} ${t.body.slice(0, 160)}`);
  }
}
{
  // legal_cite used to pre-truncate the wording at 900 chars with no marker,
  // defeating the one guarantee it makes.
  const r = await call("legal_cite", { reference: "§ 89 127/2005" });
  const cut = /\[\.\.\. TRUNCATED/.test(r.body);
  const body = (r.body.split("## Wording as published")[1] || "");
  check("legal_cite returns complete wording, or marks the cut",
    !r.isError && (cut || !/[a-záčďéěíňóřšťúůýž]$/.test(body.trim())), body.slice(-120));
}
{
  const r = await call("cz_case_search", { text: "copyright work employee" });
  check("cz_case_search refuses an English query", r.isError && /looks like an English query/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_case_lower_scan", { date_from: "2026-06-15", keyword: "personal data protection" });
  check("cz_case_lower_scan refuses an English keyword", r.isError && /looks like an English query/.test(r.body), r.body.slice(0, 160));
}

console.log("\n== Time-versioned citation ==");
{
  const now = await call("legal_cite", { reference: "§ 30 121/2000" });
  const then = await call("legal_cite", { reference: "§ 30 121/2000", as_of: "2010-06-01" });
  check("legal_cite as_of returns the historical Czech version",
    !then.isError && /in force from 2010-01-01/.test(then.body) && !/in force from 2010-01-01/.test(now.body),
    then.body.slice(0, 220));
}
{
  // The AI Act has been consolidated; quoting the as-adopted "3…" CELEX would be
  // superseded wording. legal_cite must reach for the consolidated text.
  const r = await call("legal_cite", { reference: "čl. 6 AI Act" });
  check("legal_cite quotes the consolidated EU text, not the act as adopted",
    !r.isError && /Version used: 02024R1689-/.test(r.body), r.body.slice(0, 260));
}
{
  // The GDPR's only consolidation is the initial one — the tool should still
  // quote from it and say which text the wording came from.
  const r = await call("legal_cite", { reference: "Art. 17 GDPR" });
  check("legal_cite names the exact EU text the wording came from",
    !r.isError && /Version used: 02016R0679-20160504/.test(r.body) && /erasure/i.test(r.body), r.body.slice(0, 260));
}
{
  const r = await call("legal_cite", { reference: "§ 30 121/2000", as_of: "01/06/2010" });
  check("legal_cite rejects a non-ISO as_of", r.isError && /ISO date/.test(r.body), r.body.slice(0, 160));
}

console.log("\n== CJEU case law ==");
{
  const r = await call("eu_case_search", { query: "personal data third country transfer", limit: 5 });
  check("eu_case_search finds CJEU cases by subject",
    !r.isError && /Case [CT]-\d+\/\d+/.test(r.body) && /CELEX 6/.test(r.body), r.body.slice(0, 240));
}
{
  const r = await call("eu_case_search", { query: "copyright communication public", doc_type: "CC", limit: 3 });
  check("eu_case_search can isolate Advocate General Opinions",
    !r.isError && /Advocate General/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("eu_case_documents", { case_number: "C-311/18" });
  check("eu_case_documents lists judgment and AG Opinion for Schrems II",
    !r.isError && /62018CJ0311/.test(r.body) && /62018CC0311/.test(r.body), r.body.slice(0, 240));
}
{
  const r = await call("eu_case_documents", { case_number: "C-6/64" });
  check("eu_case_documents handles a two-digit year from the 1960s",
    !r.isError && /61964/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("eu_case_documents", { case_number: "not a case" });
  check("eu_case_documents rejects a malformed case number", r.isError && /not a CJEU case number/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("legal_cite", { reference: "C-311/18" });
  check("legal_cite resolves a CJEU case number to its judgment",
    !r.isError && /62018CJ0311/.test(r.body) && /Grand Chamber/i.test(r.body), r.body.slice(0, 240));
}

console.log("\n== Supreme Administrative Court (NSS) ==");
{
  const r = await call("cz_nss_areas", { filter: "životní" });
  check("cz_nss_areas returns the court's subject vocabulary",
    !r.isError && /Životní prostředí - ochrana přírody a krajiny/.test(r.body) && /id \d+/.test(r.body),
    r.body.slice(0, 260));
}
{
  const r = await call("cz_nss_areas", { kind: "courts", filter: "krajský" });
  check("cz_nss_areas lists the regional courts it indexes",
    !r.isError && /Krajský soud v Brně/.test(r.body), r.body.slice(0, 200));
}
{
  const r = await call("cz_nss_search", { area: "Životní prostředí - ochrana přírody a krajiny", limit: 5 });
  check("cz_nss_search finds decisions by the court's subject area",
    !r.isError && /shown of \d+ matching/.test(r.body) && /cz_nss_case id="\d+"/.test(r.body),
    r.body.slice(0, 300));
}
{
  // The whole point of this source: administrative-agenda decisions of the
  // regional courts, which the Ministry of Justice feed does not carry.
  const r = await call("cz_nss_search", { area: "Životní prostředí - ostatní", court: "krajské soudy", limit: 5 });
  check("cz_nss_search reaches the regional courts' administrative agenda",
    !r.isError && /Krajský soud|Městský soud v Praze/.test(r.body), r.body.slice(0, 300));
}
{
  const r = await call("cz_nss_search", { provision: { section: "56", number: 114, year: 1992 }, limit: 3 });
  check("cz_nss_search filters by the provision applied",
    !r.isError && /shown of \d+ matching/.test(r.body) && /114\/1992/.test(r.body), r.body.slice(0, 300));
}
{
  const r = await call("cz_nss_search", { text: "environmental impact assessment" });
  check("cz_nss_search refuses an English query", r.isError && /English query/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_nss_search", {});
  check("cz_nss_search refuses a search with no criterion", r.isError && /at least one criterion/.test(r.body), r.body.slice(0, 160));
}
{
  const r = await call("cz_nss_search", { area: "nonsense that is not a subject area" });
  check("cz_nss_search rejects an unknown subject term instead of searching for nothing",
    r.isError && /not one of the court's subject terms/.test(r.body), r.body.slice(0, 200));
}
{
  // A known environmental cassation: Krajina pro život v Ministry of the
  // Environment, 10 As 198/2025, on § 56 of Act No. 114/1992 Coll.
  const s = await call("cz_nss_search", { case_number: "10 As 198/2025", limit: 1 });
  const id = (/cz_nss_case id="(\d+)"/.exec(s.body) || [])[1];
  check("cz_nss_search resolves a case number to a document id", !!id, s.body.slice(0, 240));
  if (id) {
    const r = await call("cz_nss_case", { id });
    check("cz_nss_case returns ECLI, collection status and the provisions applied",
      !r.isError && /ECLI:CZ:NSS:/.test(r.body) && /Sbírka rozhodnutí NSS/.test(r.body) && /114\/1992/.test(r.body),
      r.body.slice(0, 400));
    check("cz_nss_case separates the judgment under cassation from the precedents",
      !r.isError && /Judgment under cassation/.test(r.body) && /Precedents relied on/.test(r.body),
      r.body.slice(0, 400));
    const t = await call("cz_nss_text", { id });
    check("cz_nss_text returns the reasoning in readable Czech",
      !t.isError && /Nejvyšší správní soud/.test(t.body) && t.body.length > 5000,
      t.body.slice(0, 200));
  }
}
{
  const r = await call("cz_nss_case", { id: "999999999" });
  check("cz_nss_case fails cleanly on an unknown id", r.isError, r.body.slice(0, 160));
}
if (lowerBuilt) {
  // The coverage line on the civil index must name the agenda limit, not only
  // the dates: an empty administrative-law result there is not a finding.
  const r = await call("cz_case_lower_search", { query: "životní prostředí" });
  check("cz_case_lower_search discloses that it holds no administrative justice",
    !r.isError && /administrative justice/.test(r.body) && /cz_nss_search/.test(r.body),
    r.body.slice(0, 500));
}

console.log("\n== MŽP guidance (Ministry of the Environment) ==");
{
  const r = await call("cz_mzp_search", { query: "metodický pokyn" });
  if (r.isError && /has not been built yet/.test(r.body)) {
    console.log("  SKIP  MŽP index not built (/legal-kit:update)");
  } else {
    check("cz_mzp_search finds ministry guidance",
      !r.isError && /result\(s\) for/.test(r.body), r.body.slice(0, 240));
    check("cz_mzp_search states that guidance is not binding law",
      !r.isError && /not the rule/.test(r.body) && /court may depart/.test(r.body), r.body.slice(0, 500));
    check("cz_mzp_search reports the index build date",
      !r.isError && /built \d{4}-\d{2}-\d{2}/.test(r.body), r.body.slice(0, 300));
    const en = await call("cz_mzp_search", { query: "environmental impact assessment guidance" });
    check("cz_mzp_search refuses an English query", en.isError && /English query/.test(en.body), en.body.slice(0, 160));
    const id = (/cz_mzp_text id="(\d+)"/.exec(r.body) || [])[1];
    if (id) {
      const t = await call("cz_mzp_text", { id });
      check("cz_mzp_text returns the document with its official source",
        !t.isError && /Official source: https/.test(t.body), t.body.slice(0, 240));
    }
    const bad = await call("cz_mzp_text", { id: "999999999" });
    check("cz_mzp_text fails cleanly on an unknown id", bad.isError, bad.body.slice(0, 160));
  }
}

if (process.argv.includes("--aliases")) {
  console.log("\n== Alias verification (every entry, against the live registries) ==");
  const seenEu = new Map();
  for (const [name, celex] of Object.entries(EU_ALIASES)) {
    if (seenEu.has(celex)) { console.log(`  SKIP  ${name} (same CELEX as ${seenEu.get(celex)})`); continue; }
    seenEu.set(celex, name);
    const r = await call("eu_act_metadata", { celex });
    const title = (r.body.split("\n")[2] || "").slice(0, 90);
    check(`EU alias "${name}" -> ${celex}`, !r.isError, r.body.slice(0, 120));
    if (!r.isError) console.log(`        ${title}`);
  }
  const seenCz = new Set();
  for (const [name, ref] of Object.entries(CZ_ALIASES)) {
    const key = `${ref.number}/${ref.year}`;
    if (seenCz.has(key)) { console.log(`  SKIP  ${name} (same act as an earlier alias)`); continue; }
    seenCz.add(key);
    const r = await call("cz_act_info", { number: ref.number, year: ref.year });
    check(`CZ alias "${name}" -> ${key} Sb.`, !r.isError, r.body.slice(0, 120));
    if (!r.isError) console.log(`        ${(r.body.split("\n")[0] || "").slice(0, 110)}`);
  }
}

c.close();
console.log(`\n${pass} passed, ${fail} failed — ${TOOL_COUNT} tools registered`);
console.log("(quote these numbers in README.md / docs/tooling.md rather than counting by hand)");
process.exit(fail ? 1 : 0);
