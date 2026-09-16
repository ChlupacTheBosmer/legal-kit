# `lex` — MCP server for primary legal sources

Fetches legal text from the two official registries, so that a citation can be
verified rather than recalled.

| Source | What it is | Auth |
| --- | --- | --- |
| **e-Sbírka** (`e-sbirka.gov.cz`) | The Electronic Collection of Laws and International Treaties of the Czech Republic, operated by the Ministry of the Interior. Since 1 Jan 2024 it is the legally authoritative publication channel under Act No. 222/2016 Coll. | none |
| **CELLAR / EUR-Lex** (`publications.europa.eu`) | The Publications Office of the EU's repository behind EUR-Lex — the official text of EU law in all 24 languages. | none |
| **rozhodnuti.nsoud.cz** | The Supreme Court's own decision database (~164k decisions). | none |
| **nalus.usoud.cz** | NALUS, the Constitutional Court's decision database. | none |
| **rozhodnuti.justice.cz** | The Ministry of Justice's open-data API for district and regional court decisions (~600k since 2020). | none |
| **ARES** (`ares.gov.cz`) | The Ministry of Finance's register of economic entities, including the Commercial Register. | none |
| **ÚOOÚ** (`uoou.gov.cz`) | The Czech data protection authority's published guidance, mirrored locally into a full-text index. | none |
| **CJEU via CELLAR** | Judgments, Advocate General Opinions and orders of the Court of Justice and the General Court. | none |

Both are used through their public, unauthenticated interfaces. No API key, no
registration, no scraping of commercial sites.

## Install

```bash
cd mcp-servers/lex
npm install
node selftest.js            # 61 live end-to-end checks; prints the tool count
node selftest.js --aliases  # additionally verifies every alias resolves (~75 checks)
```

The server is registered for this project in `../../.mcp.json`, so Claude Code
picks it up automatically.

## Tools

### Czech law

| Tool | Purpose |
| --- | --- |
| `cz_act_versions` | Every consolidated version of an act, when each took effect, which amendment produced it, and which is in force now. |
| `cz_act_text` | Official consolidated text, whole act or a single provision (`section: "§ 30"`). Accepts `version: "2010-01-01"` to read the text as it stood on a date. |
| `cz_act_toc` | Table of contents — cheap way to find the right provision first. |
| `cz_act_info` | Title, abbreviations, act type, approval date, subject areas, permalinks. |
| `cz_act_relations` | What amends / repeals / implements / references the act, including `ODKAZUJE_DO_EU` — the EU instruments it points to. |

Acts are addressed by number and year (`121/2000 Sb.` → `number: 121, year: 2000`).
`collection: "ms"` selects the Collection of International Treaties.

### Citation

| Tool | Purpose |
| --- | --- |
| `legal_cite` | **The mandatory last step before any citation is written down.** Resolves a loose reference (Czech §, EU article, NS or ÚS case) into a citation in English and Czech, the official URL, a paste-ready markdown link, and the wording the provision actually has. |

### Czech case law

| Tool | Purpose |
| --- | --- |
| `cz_us_search` | Full-text search of Constitutional Court decisions, with ECLI, subject, provisions relied on, form and outcome. |
| `cz_us_keywords` | The Constitutional Court's own ~500-term subject index — the vocabulary to phrase a Czech query with. |
| `cz_case_lower_search` | Subject search over the local index of district and regional decisions. |
| `cz_case_search` | Search the Supreme Court by decision text, headnote, index keyword, case number, ECLI, date range, decision type or publication category (A–E). Returns document ids. |
| `cz_case_text` | Full text of a decision — `court="ns"` by document id, `court="us"` by Constitutional Court case number (`I. ÚS 1234/21`, `Pl. ÚS 19/14`), `court="lower"` by UUID. |
| `cz_case_lower_scan` | Walk a date window of district/regional court decisions and filter on keyword, cited provision or court. |

### Regulator guidance (ÚOOÚ)

| Tool | Purpose |
| --- | --- |
| `cz_guidance_search` | Full-text search over everything ÚOOÚ has published since 2017 — opinions, FAQs, enforcement announcements, standing pages. Czech inflection and diacritics handled. |
| `cz_guidance_text` | The full document behind a search hit. |

Backed by a local SQLite FTS5 index built with `node tools/uoou-index.mjs build`
(one API call, ~2 s, ~420 documents). `node tools/uoou-index.mjs stats` reports
its age. Guidance is the regulator's interpretation, not binding law — both tools
say so in their output.

### EU case law

| Tool | Purpose |
| --- | --- |
| `eu_case_search` | Search Court of Justice and General Court case law by subject or party. Filter by court, document type, and date. |
| `eu_case_documents` | Every document CELLAR holds for one case number: judgment, Opinion of the Advocate General, order, the original request, the Official Journal notice. |

Sourced from CELLAR, not from curia.europa.eu, which has no API and is a
JavaServer Faces application that would be brittle to script. CELLAR carries the
official text of every CJEU document with a CELEX number, so nothing is lost.

### Czech companies

| Tool | Purpose |
| --- | --- |
| `cz_company_search` | Find an entity by name, IČO or seat. |
| `cz_company` | Full record including the registered acting rules and current statutory bodies — i.e. whether a signatory could bind the company. |

### EU law

| Tool | Purpose |
| --- | --- |
| `eu_celex_lookup` | Short name → CELEX, with title and force status confirmed live. Call with no argument to list known aliases. |
| `eu_act_metadata` | Title, adoption date, entry into force, end of validity, in-force flag, ELI. |
| `eu_act_text` | Official text in any EU language; `article: 17` extracts one article. |
| `eu_act_versions` | Consolidated versions of an amended act. |
| `eu_act_search` | Full-text search over CELLAR titles, returns CELEX numbers. |

## Behaviour that matters

- **Repealed acts don't fail silently.** Asking for the "current" version of a
  repealed Czech act returns the last version that was in force, headed with a
  `!! REPEALED` banner and a pointer to `cz_act_relations type=JE_RUSEN`.
- **Nothing is truncated invisibly.** Cut text is marked with an explicit count of
  what was dropped.
- **Every response carries the official URL and the retrieval date**, so a citation
  can be written from the tool output alone.
- **Consolidated vs. as-adopted.** EU CELEX numbers beginning `3` are the act as
  adopted; `0` are consolidated texts. `eu_act_versions` shows which exist —
  quoting an amended regulation from its `3…` CELEX is a common citation error.

## Caching

Responses are cached under `<repo>/.cache/lex/` for 12 h by default. Override with
`LEX_MCP_CACHE_TTL_MS` (ms) or `LEX_MCP_CACHE_DIR`. Delete the directory to force
a refresh. Cached data can go stale on the day a new consolidated version takes
effect — set the TTL to `0` when that matters.

## How the endpoints were established

Neither registry publishes a stable OpenAPI document, so the endpoints in
`lib/esbirka.js` were identified from the e-Sbírka web client and confirmed
against live responses; the CELLAR access patterns follow the Publications
Office's documented content-negotiation and SPARQL interfaces. Notes in
`../../docs/source-apis.md`.

`selftest.js` is the regression guard: if either registry changes shape, it fails
loudly instead of the tools returning quietly wrong text. Run it before trusting
output after a long gap.

## Known limits

- **The Supreme Court search rejects a page size below 5.** Domino answers
  HTTP 500 (`Field is too large (32K)`) for `Count` 1–4, which reads like an
  outage rather than a bad parameter. `cz_case_search` requests at least 5 rows
  and trims locally, so any `limit` works.
- **Lower-court decisions have no subject index.** The open-data API is keyed by
  publication date, so `cz_case_lower_scan` walks the days requested (max 31) and
  filters client-side. It reports how many decisions it scanned — treat the result
  as a sample of that window, not an exhaustive search.
- **No Nejvyšší správní soud search.** Its form is guarded by an anti-forgery
  token with per-render field numbering; any scripted version would break on their
  next deploy. Search by hand at `vyhledavac.nssoud.cz`.
- **ÚOOÚ guidance is a local mirror**, so it is only as current as the last
  index build. `cz_guidance_search` warns when the index is over a month old.
- **No Czech legislation full-text search.** e-Sbírka's search endpoint takes a server-side
  enum that is not exposed by the public client, so it isn't wired up. Acts are
  addressed by number/year, or found by name through `CZ_ALIASES` in
  `lib/aliases.js`. Use web search to find *which* act applies, then read it here.
- **Article extraction for EU acts is heading-based.** It matches a line that is
  exactly `Article 17` (or the language equivalent). It fails cleanly rather than
  returning the wrong article, and the full text is always available as a fallback.
- **e-Sbírka advises production use only after 15 Jan 2026** because fragment
  identifiers could change before then. That date has passed.
