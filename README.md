# legal-kit

A [Claude Code](https://claude.com/claude-code) plugin for Czech and European
Union legal research, read from the official registries.

The point is narrow and worth stating plainly. A general-purpose assistant will
tell you what § 30 of the Copyright Act says from memory, and it will sometimes
be wrong in ways you cannot see. This one looks the provision up, quotes the
words, tells you which consolidated version it read and on what date, and links
the government's own page so you can check it. Everything else here exists to
protect that property.

Twenty-nine tools. Every source is an official government or European Union
registry, free and unauthenticated: no account is needed for any of them.

```
/plugin marketplace add ChlupacTheBosmer/legal-kit
/plugin install legal-kit@legal-kit
```

Restart Claude Code, then:

```
/legal-kit:setup            once per machine: who you are, what you practise
/legal-kit:setup-project    in each matter: what this workspace is for
```

**Requirements:** Node 22 or newer, because the local indexes use the built-in
`node:sqlite`. The server installs its two npm dependencies on first start, so
the first session takes a few seconds longer.

---

## What it covers

| Source | What you get | Tools |
| --- | --- | --- |
| **e-Sbírka** | Any Czech act, in force today or on any past date, with the consolidated version resolved | `cz_act_text`, `cz_act_versions`, `cz_act_info`, `cz_act_toc`, `cz_act_relations` |
| **EUR-Lex / CELLAR** | Any EU regulation or directive, 24 languages, correct consolidated text | `eu_act_text`, `eu_act_versions`, `eu_act_metadata`, `eu_act_search`, `eu_celex_lookup` |
| **Nejvyšší správní soud** and the regional administrative courts | The whole of administrative law: environmental, tax, building, asylum, procurement | `cz_nss_search`, `cz_nss_areas`, `cz_nss_case`, `cz_nss_text` |
| **Nejvyšší soud** | Every published Supreme Court decision, with its collection category | `cz_case_search`, `cz_case_text` |
| **Ústavní soud** | Every Constitutional Court decision, with the form and outcome that decide its weight | `cz_us_search`, `cz_us_keywords` |
| **Court of Justice of the EU** | Judgments and Advocate General Opinions | `eu_case_search`, `eu_case_documents` |
| **Ministry of Justice open data** | District and regional decisions, civil and criminal | `cz_case_lower_search`, `cz_case_lower_scan` |
| **ÚOOÚ** | Everything the data protection authority has published since 2017 | `cz_guidance_search`, `cz_guidance_text` |
| **MŽP** | The Věstník back to 1995 and the ministry's methodological guidance, PDF text included | `cz_mzp_search`, `cz_mzp_text` |
| **ARES** | Who a counterparty is, and who may sign for them | `cz_company_search`, `cz_company` |

Plus **`legal_cite`**, the one you will use most. Give it a loose reference
(`§ 58 121/2000`, `Art. 28 GDPR`, `C-311/18`, `I. ÚS 1234/21`) and it returns a
checked citation in both languages, the official link, a ready-to-paste markdown
link, and the wording the provision actually has. Add `as_of` for a historical
date and it fetches the version in force then.

## What it will not do

**Research, not legal advice**, and it says so. It states what the sources say,
how confident that reading is, and when an advocate is needed.

**Czech and EU law only.** If you need United States law it will say so rather
than improvise.

**It will not tell you there is no case law.** It will tell you that particular
Czech queries against particular sources found nothing, and show you the queries.
Those are different claims and only the second is supportable.

**It will not paraphrase a provision it has not read.** A citation without its
text is a bug.

---

## Setup, and why there are two interviews

`/legal-kit:setup` configures **you**: your standing, your practice setting,
which areas are your specialism and which you only touch, your language, your
escalation, your integrations, and which indexes to build. Once per machine.
Three minutes for the quick path, twenty for the full one.

It matters more than a settings screen usually does. Whether you are on the roll
of advocates of the Czech Bar Association changes what may be claimed about
privilege. Whether an area is your specialism changes how much doctrinal
background every answer carries. A generic profile produces confident output
calibrated for nobody.

When you state a deadline or a provision during the interview, it calls
`legal_cite` and shows you the real text before writing it down. A wrong deadline
in the profile becomes a wrong deadline in every answer that reads it.

`/legal-kit:setup-project` configures **the matter**: what this workspace is for,
whose it is, which of your areas are live here, what it produces, how
confidential it is. Five minutes, once per project. It writes the project
`CLAUDE.md`, and can scaffold a knowledge base.

### Commands

| | |
| --- | --- |
| `/legal-kit:setup` | Global cold start. `--full`, `--redo`, `--areas`, `--check-integrations` |
| `/legal-kit:setup-project` | Per project. `--minimal`, `--redo` |
| `/legal-kit:doctor` | Runtime, configuration, whether the registries answer, index staleness |
| `/legal-kit:status` | Cheap local check, safe while a long build runs |
| `/legal-kit:update` | Refresh whatever has gone stale |

The research skill `cz-legal-research` is the Czech search procedure and the most
valuable single file here. Nine further skills carry Czech-language workflows for
contract review, NDA triage, compliance checks, counterparty KYC, negotiation
preparation and risk assessment.

---

## Where things live

Nothing writable goes inside the plugin: installs are versioned, so an upgrade is
a new directory and anything written inside would be orphaned.

| | |
| --- | --- |
| The plugin | `~/.claude/plugins/cache/legal-kit/legal-kit/<version>/` |
| Your profile | `~/.claude/plugins/config/legal-kit/profile.md` |
| Indexes and cache | `~/.legal-kit/` |
| Project configuration | `.legal-kit/project.md` and `CLAUDE.md`, in the project |
| Your notes and work product | in the project, gitignored by `setup-project` |

The indexes are global on purpose. ÚOOÚ guidance, the Věstník and the lower-court
index are jurisdiction-wide facts, not project facts: build the 4,400-document
ministry mirror once and every matter you ever open uses it.

## The indexes

Most sources are read live. Three have no usable search interface, so legal-kit
mirrors them locally.

| Index | Build | Refresh | Matters for |
| --- | --- | --- | --- |
| ÚOOÚ guidance | seconds | monthly | data protection |
| District and regional courts | minutes per year of coverage | quarterly | civil, commercial, criminal |
| MŽP guidance and Věstník | **hours** | quarterly | environmental, administrative |

The MŽP build is slow because the ministry's `robots.txt` asks for ten seconds
between requests and legal-kit honours it. It resumes if interrupted, stays on
the ministry's own domain rather than following links out to third parties, and
orders its work so a partial build still leaves the guidance pages.

The Supreme Administrative Court is **searched live**, so its case law is never
stale and needs no index. Only its subject vocabulary is cached, for thirty days.

A stale mirror of a regulator is worse than none, because it looks current.
`/legal-kit:setup` offers a weekly refresh; `/legal-kit:update` does it by hand
and touches only what has actually gone stale.

---

## How it thinks

`rules/core.md` holds the rules, and a `SessionStart` hook loads them in any
project that has been through `setup-project`. They are the product, not
documentation: without them the assistant answers from memory, which is the
failure this exists to prevent. The hook is silent everywhere else, so your
unrelated projects do not get a page of Czech citation rules.

**Every cited provision carries its text**, the instrument named in full on first
mention, a link, and a version date. If it is not worth quoting it is not worth
citing.

**Verify before asserting.** If a law firm's blog says Article X says something,
read Article X.

**Time-version everything.** Czech acts change several times a year.

**Separate text, established reading and open question.** What the provision
says, what case law or a regulator says it means, and where the reading is
genuinely uncertain.

**Query Czech sources in Czech.** An English query returns nothing and that
nothing looks exactly like "there is no such case law". Every Czech source
refuses an obviously English query, and an empty result is always reported as
"these queries against these sources found nothing".

**Czech law within the EU framework. Never US law.**

---

## Optional integrations

Neither is required for anything.

**Zotero**, for commentary: articles, textbooks, regulator PDFs. Legislation and
case law are cited as links to the registry through `legal_cite`, because a link
the reader can check beats a bibliography line.

```bash
export ZOTERO_API_KEY=...        # zotero.org/settings/keys
export ZOTERO_LIBRARY_ID=...     # your numeric user id, or a group id
export ZOTERO_LIBRARY_TYPE=user  # or 'group'
node tools/zotero.mjs collections
```

**Google Docs**, for the drafting loop: push a draft into a real document, read
back the comments colleagues leave with the text each is anchored to, edit the
commented span, reply and resolve in one call. Setup is three steps, one of them
a trip to the Google Cloud console:
[docs/google-docs-workflow.md](docs/google-docs-workflow.md). The token requests
`drive.file`, not full Drive, so the tool can only touch documents it created or
you explicitly opened.

`/legal-kit:doctor` reports both, and reports the Google token and the Google
Python libraries separately, because having one without the other is the
confusing state people land in.

**The `claude-for-legal` plugins** are excellent workflow structure and wrong law
here: they are drafted for United States in-house practice. Their output must be
run through [docs/jurisdiction-overlay.md](docs/jurisdiction-overlay.md) before
delivery, and the assistant says what it corrected. Watch for fair use,
assignment of copyright, work made for hire, at-will employment, discovery and
punitive damages. None exist in Czech law.

---

## Troubleshooting

**A Czech search returns nothing.** Check the court system first. Czech
environmental, tax and building disputes are administrative law and live in
`cz_nss_search`; `cz_case_lower_search` holds the ordinary courts' civil and
criminal dockets and no administrative justice at all. Then check the query:
some engines match exact surface forms, so a four-word query can collapse a large
result set to zero.

**"The index has not been built yet."** A configuration state, not a fault.
`/legal-kit:update` builds what is missing.

**The MŽP build seems stuck.** It waits ten seconds between requests because the
ministry asks it to, and some attachments are 20 MB. `/legal-kit:status` is safe
to run while it works.

**Node complains about `node:sqlite`.** You are on Node older than 22, or a
minimal build without SQLite. `/legal-kit:doctor` says which.

**A source is unreachable.** Usually theirs, not yours. The tools are independent
of each other, so the rest still work.

---

## Development

```
.claude-plugin/     marketplace.json and plugin.json
.mcp.json           registers the lex server
scripts/launch.sh   starts it, installing dependencies on first run
hooks/              loads the rules in a configured legal project
rules/core.md       those rules

mcp/lex/            the MCP server and its 29 tools
  lib/              one module per source
  selftest.js       live end-to-end test

skills/
  setup/            the global interview; areas/ holds a block per practice area
  setup-project/    the per-project interview
  cz-legal-research/    the Czech search procedure
  cz-*/             nine Czech-language workflow skills
  doctor/ status/ update/

tools/              index builders, Google Docs and Zotero helpers
templates/          vault scaffolding copied into a project by setup-project
docs/               how each registry behaves, and the US-to-Czech overlay
```

```bash
node mcp/lex/selftest.js          # live end-to-end test, a couple of minutes
node mcp/lex/selftest.js --aliases  # also verify every act and CELEX alias
```

Pull requests welcome. Two things make one easy to accept:

1. **[docs/source-apis.md](docs/source-apis.md) is updated.** It records how each
   registry actually behaves, including the traps, and is why adding a source
   takes an afternoon rather than a week.
2. **The selftest covers it, with a check the bug would have failed.** A real
   example from the history: a check named "cz_act_relations surfaces EU links"
   passed for months while the tool printed a heading and silently dropped every
   row beneath it, because the assertion tested the heading.

CI deliberately does not run the selftest. Firing every one of these government
sites on every push would be a poor way to treat free public infrastructure, and a red build
would usually mean a ministry was having a slow morning.

## Licence

MIT, see `LICENSE`. Third-party components keep their own terms and you must keep
them if you redistribute; `NOTICE.md` has the detail.

- The nine `cz-*` workflow skills derive from **pravo-skills by DirectCase** (MIT)
- `docs/` carries their licence and notice

**The legal material is not covered by any of this.** Czech legislation and court
decisions are excluded from copyright by § 3(a) of Act No. 121/2000 Coll., and EU
law is published under the Commission's reuse decision. The indexes you build are
local copies of live government sites: do not redistribute them, rebuild them.

## Disclaimer

Research, not legal advice. No lawyer-client relationship arises from using it.
The sources are official and the citations are checked against them, but the
reading of a provision is still a reading. Where it matters, take it to a
qualified advocate, and the assistant will tell you when that point is reached.
