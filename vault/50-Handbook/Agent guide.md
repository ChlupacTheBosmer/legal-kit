---
title: Agent guide
type: handbook
status: verified
tags: []
created: 2026-08-24
updated: 2026-09-13
---

# Agent guide — read this before doing anything

## In one line

Never state what the law says from memory. Look it up, quote it, date it.

## Start of session

1. Read `CLAUDE.md` in the project root. It is the binding set of rules; this
   page is the practical companion.
2. Check [[Maintenance log]]. If anything is due, do it before substantive work.
3. If the task is a legal question about Czech sources, invoke the
   **`cz-legal-research`** skill. It is the search procedure and it prevents the
   project's worst failure mode.

## The tools

All 29 live in the `lex` MCP server. Run `node mcp-servers/lex/selftest.js` if
you suspect something is broken — it makes live calls and prints the tool count.

### Always start here

| Tool | Use for |
| --- | --- |
| `legal_cite` | **The mandatory last step before any citation is written down.** Give it `§ 58 121/2000`, `Art. 28 GDPR`, `23 Cdo 3492/2021` or `I. ÚS 1234/21`. It returns the citation in both languages, the official link, and *the wording the provision actually has*. Add `as_of="YYYY-MM-DD"` whenever the facts are historical — it will fetch the version in force then. |

### Legislation

| Tool | Use for |
| --- | --- |
| `cz_act_text` | Full text of a Czech act or one § (`section: "§ 30"`). `version:` takes an ISO date. |
| `cz_act_versions` | Every consolidated version and what amended it. Run this before quoting anything time-sensitive. |
| `cz_act_info` | Title, abbreviations, subject areas, permalink — to confirm you have the right act. |
| `cz_act_relations` | What amends/repeals it, and `type: "ODKAZUJE_DO_EU"` for the EU law it implements. |
| `cz_act_toc` | Top-level structure only. It does **not** list §-headings, despite what you might expect. |
| `eu_celex_lookup` | Short name → CELEX (GDPR, AI Act, DSA…), with force status. |
| `eu_act_text` | Official EU text; `article:` extracts one article. |
| `eu_act_versions` | Consolidated versions — an amended regulation must be quoted from the right one. |
| `eu_act_metadata` | In force? Since when? ELI? |
| `eu_act_search` | Find a CELEX you do not know, by words in the title. |

### Case law — query in Czech

| Tool | Use for |
| --- | --- |
| `cz_case_search` | Supreme Court. Full text, headnote, index keyword, case number, ECLI, date, category A–E. |
| `cz_us_search` | Constitutional Court, full text. Returns form (*nález*/*usnesení*) and outcome — both matter for weight. |
| `cz_us_keywords` | The court's own ~500-term subject index. **Use it to find the right Czech word before searching.** |
| `cz_case_lower_search` | District and regional courts, from the local index. Check the coverage line it prints. |
| `cz_case_lower_scan` | Only for dates newer than the index, or to see one day's output. |
| `cz_case_text` | Full text. `court="ns"` by document id, `court="us"` by case number, `court="lower"` by UUID. |
| `eu_case_search` | **Court of Justice of the European Union and General Court, by subject.** Sourced from CELLAR; curia.europa.eu has no API. |
| `eu_case_documents` | What documents exist for a CJEU case, including the **Opinion of the Advocate General**, which is often the fuller reasoning. `legal_cite "C-311/18"` resolves a case number straight to the judgment. The CELEX year is the year the case was *lodged*, not decided. |
| `cz_nss_search` | **Supreme Administrative Court and the regional courts in their administrative agenda.** The court's own engine. Search by its subject index, by the provision applied, by court or senate, by date, or by full text (it lemmatises Czech, so pass the base form). |
| `cz_nss_areas` | The court's own subject vocabulary (Oblast úpravy), its courts and senates, and its case registers. **Use it to find the right Czech term before searching**, as `cz_us_keywords` is used for the Constitutional Court. |
| `cz_nss_case` | The record for one decision: ECLI, whether it is in the **Sbírka rozhodnutí NSS**, the provisions applied, the precedents and how they are treated, the administrative decision challenged, the judgment under cassation. |
| `cz_nss_text` | Full text of an NSS or regional administrative decision. |

### Everything else

| Tool | Use for |
| --- | --- |
| `cz_guidance_search` / `cz_guidance_text` | ÚOOÚ guidance. **For any GDPR question, search this before answering.** |
| `cz_mzp_search` / `cz_mzp_text` | Ministry of the Environment guidance and the Věstník MŽP, PDFs included. **For any environmental question, search this before answering.** A metodický pokyn is the ministry's reading, not law; the Věstník is where resort instruments acquire validity. |
| `cz_company_search` / `cz_company` | Counterparty identity, and who may sign for a company. |

## The rules that matter most

**1. Query Czech sources in Czech.** The tools refuse obvious English, but that
is a backstop. Name the legal concept, take the term from `cz_us_keywords` where
one exists, and run three to five short variants — not one translation.

**2. Never turn an empty result into a negative finding.** "These Czech queries
against these sources found nothing" is supported. "There is no case law on this"
is not. Say which is which.

**3. Read before citing.** A hit count is not a finding. Search matches words,
not meaning; on niche topics it returns decisions about something else. Pull the
text and check the passage actually says what you are citing it for.

**4. Report coverage limits.** `cz_case_lower_search` is limited on two axes:
the indexed date range **and the agenda** — it holds the civil and criminal
dockets and no administrative justice at all, so an environmental, tax or
building question needs `cz_nss_search` instead. `cz_guidance_search` and
`cz_mzp_search` are only as fresh as the last index build. All of them print
their limits. Pass them to the user rather than swallowing them.

**5. Time-version everything.** Czech acts change several times a year. If the
facts are historical, use `as_of`.

**6. Administrative law is a different court system.** Czech environmental law is
administrative law almost throughout, and the ordinary courts do not decide it.
If the question is about a permit, a stanovisko, an inspection, a penalty or
standing to challenge any of them, the case law is in `cz_nss_search`, not in
`cz_case_search` (Supreme Court, civil and criminal) or `cz_case_lower_search`.

## Answer format

Substantive answers are written as a short legal report — see
[[Report format]]. The essential part is that **the source text is quoted**, so
the user can audit the reasoning rather than trust it.

## Jurisdiction

Czech law within the EU framework. Never US law. The installed `claude-for-legal`
plugins are US-drafted — their output must be corrected against
`docs/jurisdiction-overlay.md` before delivery. Watch for: fair use, assignment
of copyright, work made for hire, at-will employment, discovery, punitive
damages. None exist in Czech law.

## Language

English for analysis, notes and conversation. Czech for Czech deliverables
(drafted in Czech, not translated), for quoted provisions, and for terms of art
with the Czech in brackets on first use. If you draft in Czech, summarise it in
English so the user can check it.

## Writing to the vault

Notes go in `10-Topics` (concepts), `20-Instruments` (one act), `30-Memos` (one
answered question), `40-Playbooks` (repeatable procedures). Templates in
`90-Templates`. Check for an existing note before creating a near-duplicate.
