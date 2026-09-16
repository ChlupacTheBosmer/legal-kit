# Tooling: what is set up, what is left

Status as of 2026-08-24. *Verified* means tested against the live service.

---

## 1. In place

### `lex` MCP server — primary law, case law, company register *(verified)*

`mcp-servers/lex/`. Twenty-three tools, no API keys, all official sources.

**Czech legislation — e-Sbírka** (`e-sbirka.gov.cz`), the legally authoritative
Collection of Laws since 1 Jan 2024 under Act No. 222/2016 Coll.
`cz_act_text` · `cz_act_versions` · `cz_act_toc` · `cz_act_info` · `cz_act_relations`

**EU law — CELLAR/EUR-Lex** (`publications.europa.eu`), the Publications Office's
repository, official text in 24 languages.
`eu_act_text` · `eu_act_metadata` · `eu_act_versions` · `eu_act_search` · `eu_celex_lookup`

**Czech case law** — see §2 below.
`cz_case_search` · `cz_case_text` · `cz_case_lower_scan`

**Czech companies — ARES** (`ares.gov.cz`), Ministry of Finance register.
`cz_company_search` · `cz_company`

**Verified citation** — `legal_cite`. Resolves a loose reference ("§ 58 121/2000",
"Art. 17 GDPR", "23 Cdo 3492/2021", "I. ÚS 1234/21") into a citation in English
and Czech, the official URL, a ready-to-paste markdown link, and **the wording
the provision actually has**. Nothing goes into a document without passing
through it.

`cz_company` returns the Commercial Register record: the registered **acting
rules** ("Za společnost jednají vždy dva členové správní rady společně.") and the
current statutory bodies. That is the check that tells you whether the person who
signed a contract could actually bind the company.

`node mcp-servers/lex/selftest.js` runs 61 live checks; `--aliases` adds ~75 more.

### Czech case law *(verified — this was the priority)*

| Court | Coverage | How |
| --- | --- | --- |
| **Nejvyšší soud** | All published decisions (~164k) | Full search over decision text, headnote (*právní věta*), index keyword, case number, ECLI, date range, decision type and publication category — then full text with structured header (ECLI, date, keywords, provisions applied, category). |
| **Ústavní soud** | All decisions | Full text by case number (`I. ÚS 1234/21`, `Pl. ÚS 19/14`). |
| **District & regional courts** | ~600k since 2020 | Ministry of Justice open-data API: scan a date window, filter on keyword / cited provision / court, then fetch the anonymised text. |
| **Nejvyšší správní soud + regional administrative courts** | Everything the court's own engine holds | Search by the court's subject index (*Oblast úpravy*), by the provision applied down to § / odst. / písm., by court or senate, by date, or by full text (the engine lemmatises Czech). Then the full record — ECLI, *Sbírka rozhodnutí NSS* status, provisions applied, precedents and their treatment, the administrative decision challenged, the judgment under cassation — and the text. |

**Subject search now covers every level.** `cz_us_search` drives the
Constitutional Court's WebForms search (which needed the complete form replayed,
including the decision-form checkboxes — see `docs/source-apis.md`), and
`cz_case_lower_search` searches a local index of district and regional decisions
built from the Ministry of Justice open data: **41,108 decisions** from
2025-01-01 onward, extendable.

```bash
node tools/justice-index.mjs build --from 2024-01-01   # widen coverage; resumable
node tools/justice-index.mjs stats
```

`cz_us_keywords` exposes the Constitutional Court's own ~500-term subject index —
the vocabulary to phrase a Czech query with.

Two honest limitations, both documented in the tools themselves:

- **The Supreme Court search rejects a page size below 5** — Domino returns
  HTTP 500 with "Field is too large (32K)" for `Count` 1–4. This was originally
  misdiagnosed here as an unstable server; it is a parameter bug, now fixed by
  requesting at least 5 rows and trimming locally. Any `limit` works.
- **The lower-court index is partial on two axes, and both are printed with
  every result.** Dates: a decision published outside the indexed range is
  invisible, not absent. **Agenda: the Ministry of Justice feed carries the
  ordinary courts' civil and criminal dockets and no administrative justice at
  all** — 38,238 C and 2,520 Co against zero A or As. An administrative-law
  subject searched here returns nothing however it is phrased, which is why the
  coverage line now names the registers held and points at `cz_nss_search`.
- **NALUS free-text only.** The Constitutional Court's keyword, subject and
  provision fields are JavaScript picker widgets that cannot be posted into;
  `text` searches the whole decision instead, which covers the same ground.
- **NSS is now covered** (`cz_nss_search`, `cz_nss_areas`, `cz_nss_case`,
  `cz_nss_text`), and with it the regional courts in their administrative
  agenda. This was previously left out on the ground that the form's per-render
  field numbering would break any scripted version. That is true of an
  implementation keyed on the numbering, so this one is not: it discovers each
  control from the `TechnickyNazev` marker the form carries beside it, reads the
  result table by column heading rather than cell index, and fails with a named
  criterion if the court ever stops exposing one. Live search rather than a
  local mirror, because the court's own engine already offers the subject
  vocabulary, provision-level filtering and Czech lemmatisation that a mirror
  would have to reimplement worse.

### Querying Czech sources from English

The failure this setup is most exposed to is searching a Czech corpus in English
and reading the empty result as "no such case law". Three layers now guard it:

1. **A tool-level guardrail.** The Czech-source search tools detect an English
   query and refuse it with an explanation, rather than returning nothing.
2. **Query-side Czech handling.** Shared stemming, stopword removal and a
   guarded OR fallback (`lib/czsearch.js`) so inflection does not lose matches
   and a single common term does not drag in noise.
3. **A skill.** `.claude/skills/cz-legal-research/` encodes the procedure:
   name the concept, take terms from a controlled vocabulary, run several short
   Czech variants, search every relevant source, and report the queries and
   coverage rather than just the findings. `CLAUDE.md` carries the short form.

### `claude-for-legal` plugins *(installed, jurisdiction-corrected)*

Five enabled at project scope: `ip-legal`, `privacy-legal`, `ai-governance-legal`,
`regulatory-legal`, `commercial-legal`. Install more with
`claude plugin install <name>@claude-for-legal --scope project`.

The plugins are US-drafted. Two things now correct for that:

- **`docs/jurisdiction-overlay.md`** — a mapping from each plugin's US assumptions
  to Czech/EU law, with every Czech provision verified against e-Sbírka. It covers
  the concepts that have no Czech equivalent at all (fair use, assignment of
  copyright, work made for hire, at-will employment, discovery, punitive damages)
  and the per-plugin substitutions.
- **`~/.claude/plugins/config/claude-for-legal/company-profile.md`** — the shared
  profile every plugin reads, pre-seeded with the Czech/EU jurisdiction facts,
  the applicable regulators (ÚOOÚ, ÚPV, ČOI, ÚOHS — not SEC/FTC), and a pointer
  to the overlay. Business specifics are left as `[PLACEHOLDER]` so the
  cold-start interview still runs.

`CLAUDE.md` requires plugin output to be swept through the overlay before delivery.

### Commercial legal SaaS — removed *(verified)*

The plugins registered twelve MCP servers for US legal SaaS. All are now blocked
via `deniedMcpServers` in `.claude/settings.json`:

> Ironclad, DocuSign, iManage, TopCounsel, Definely, Solve Intelligence,
> CourtListener, Descrybe, Slack

`claude mcp list` now shows only `lex`, `zotero`, `google-workspace`, `arxiv` and
the four claude.ai connectors. Blocking by name survives plugin updates; editing
the plugins' own `.mcp.json` would not.

### Zotero *(done)*

The API key had write access. A **`law`** collection now exists in your personal
library (`chlupac`, user 7135490) with twelve subcollections:

> Copyright & Software · Trademarks & Designs · Patents & Trade Secrets ·
> Data Protection (GDPR) · AI Regulation · Platform & Digital Services ·
> Contracts & Commercial · Czech Case Law · EU Case Law · Regulator Guidance ·
> Course Materials · Scholarship & Commentary

The five PDFs from `IP/` are filed under **Course Materials**, so
`zotero_search_items` and `zotero_item_fulltext` can reach them.

**One config change to note:** the MCP server pointed at the group library
`gacr_congitive_spaces`, which is `PublicOpen`. It now points at your personal
library instead (`ZOTERO_LIBRARY_TYPE=user`, `ZOTERO_LIBRARY_ID=7135490`) so
legal material stays private. The trade-off you accepted: the group library is no
longer visible to `zotero_search_items`. Reverting is a two-line edit in
`~/.claude.json`.

Add more PDFs with `node tools/zotero.mjs upload --collection <KEY> <file.pdf> ...`.

### Google Docs *(working now — no OAuth step needed)*

A refresh token with Drive and Docs scopes already exists at
`~/.claude_google_token.json`, shared with the scientific-writer project. Tested:
it refreshes and authenticates as whichever Google account created the token.

**`tools/gdoc.py`** is the drafting and revision tool, modelled on that project's
`revise_doc.py` / `apply_edit.py`, with three things added:

- comment anchors resolved to **character offsets**, with an explicit
  `unique` / `ambiguous` / `not found` status;
- **tracked changes** (Google Docs suggestions), which the MCP server does not expose;
- an `edit` that refuses when the target text is not unique.

**Citations in Docs — the problem that repo never solved.** There, in-text
citations had to be linked to Zotero by hand, because field codes cannot be
written through the API. For legal work it dissolves: Drive converts
`text/markdown` natively and markdown links become **live hyperlinks**, so a
citation points straight at e-Sbírka, EUR-Lex or NALUS. Verified end to end.
`legal_cite` produces the link; `gdoc.py create` puts it in the document.

The `google-workspace` MCP server remains mis-named-env-fixed in `~/.claude.json`
and is worth authorising later for Gmail, Calendar and Sheets. It is not needed
for drafting.

### ÚOOÚ guidance *(built — this was the priority gap)*

Everything the Czech data protection authority has published since 2017 —
opinions, FAQs, enforcement announcements, standing explanatory pages — mirrored
into a local SQLite FTS5 index and searchable in Czech.

`cz_guidance_search` · `cz_guidance_text`

It turned out easier than forecast. The site has an undocumented but public JSON
feed at `/api/articles` returning every article with its full body, so the whole
corpus arrives in one request instead of needing a crawler. ~420 documents after
deduplication, 2017-05-05 → 2026-08-11, built in about two seconds.

```bash
node tools/uoou-index.mjs build    # fetch and rebuild
node tools/uoou-index.mjs stats    # size, date range, how stale
```

Czech search needed two adjustments to be usable: query terms are stemmed before
prefix matching (otherwise "pokuta" misses "pokuty"), and Czech function words
are dropped (otherwise "za" matches most of the corpus). Details in
`docs/source-apis.md`.

**Guidance is the regulator's interpretation, not binding law.** Both tools say
so in their output, and `CLAUDE.md` requires it to be cited that way and paired
with the underlying provision via `legal_cite`.

The index is a mirror, so it is only as fresh as the last build; the search tool
warns when it is over a month old. ÚOOÚ publishes a few items a month.

### `pravo-skills-cz` — Czech legal workflows *(installed)*

DirectCase publishes an **MIT-licensed** Czech adaptation of the legal plugin.
It is now in `plugins/pravo-skills-cz/`, installed and enabled, with its legal
sources **rewired from their paid MCP to `lex`**. Nine Czech-language commands:
`revize-smlouvy`, `triage-nda`, `kontrola-podpis`, `kontrola-dodavatele`,
`kontrola-souladu`, `priprava-jednani`, `posouzeni-rizika`, `pravni-odpoved`,
`prehled-pravni`.

Changes are recorded in `plugins/pravo-skills-cz/NOTICE.md`; the licence is
retained. `mcp.directcase.ai` is not contacted, and the plugin's `.mcp.json`
(which declared DocuSign, Slack and M365) is emptied.

Their substantive Czech content has **not** been verified provision by provision.
It is a structure to fill — anything cited out of it goes through `legal_cite`.

See **`docs/directcase-gap-analysis.md`** for what their paid MCP offers against
what `lex` does, and which gaps are worth closing ourselves.

---

## 2. Left to do

1. **Run the cold-start interviews.** They now start from a Czech/EU profile
   rather than a blank US one:
   ```
   /privacy-legal:cold-start-interview
   /ip-legal:cold-start-interview
   /ai-governance-legal:cold-start-interview
   ```
   These are the US-drafted plugins. `pravo-skills-cz` needs no interview — copy
   `plugins/pravo-skills-cz/legal.local.example.md` to `legal.local.md` in the
   project root and fill in your standard positions instead.
2. **Authorise the claude.ai connectors** (Notion, Gmail, Calendar, Drive) in
   claude.ai connector settings, if you want mail and calendar. Not needed for
   drafting — `tools/gdoc.py` already works.
3. **Other regulators** — ČNB, ÚOHS, ČTÚ, SÚKL, NÚKIB are still uncovered. None
   is likely to have a feed as convenient as ÚOOÚ's; build one when a matter
   needs it. ECtHR remains available and cheap but, on reflection, is rarely
   decisive for this work.

## 3. Considered and deferred

- **A local case-law index.** Mirroring the justice.cz open data into SQLite with
  full-text search would turn the date-indexed firehose into a real subject
  search. It is a genuine project — hundreds of thousands of documents, ongoing
  sync — and worth doing only once a matter needs lower-court case law
  systematically. The apex courts, which matter more for doctrine, are already
  searchable.
- **EUIPO / EPO APIs.** Free but require developer registration. Trade mark
  clearance (`/ip-legal:clearance`) is the trigger to set them up.
- **e-Sbírka registered REST API.** Application to the Ministry of the Interior by
  data box; might expose the full-text search the public endpoints don't. Not
  needed for anything currently blocked.

## 4. Not used: zakonyprolidi.cz

Its `robots.txt` sets `ai-train=no, use=reference` and states these are *"express
reservations of rights under Article 4 of Directive 2019/790"* — a formal TDM
opt-out — and `/api/` is a paid licence returning 403 anonymously. It is also no
longer the best source: e-Sbírka is authoritative, free, and exposes the full
consolidated version history. `use=reference` permits linking, so it remains fine
for orientation — find the provision there, quote it from `lex`.
