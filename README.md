# Czech and EU legal research workspace

A workspace for [Claude Code](https://claude.com/claude-code) that answers Czech
and European Union legal questions **from the official registries**, and builds a
durable knowledge base out of the answers.

The point is narrow and worth stating plainly. A general-purpose assistant will
tell you what § 30 of the Copyright Act says from memory, and it will sometimes
be wrong in ways you cannot see. This one looks the provision up, quotes the
words, tells you which consolidated version it read and on what date, and links
you to the government's own page so you can check it. Everything else here exists
to protect that property.

Twenty-nine tools over nine official sources. All free, all unauthenticated, no
account needed for any of them.

**Contents**

- [What it covers](#what-it-covers) · [What it will not do](#what-it-will-not-do)
- [Getting started](#getting-started) · [The commands](#the-commands)
- [What is in the repository](#what-is-in-the-repository)
- [How it thinks](#how-it-thinks-the-rules-that-make-it-useful)
- [The indexes](#the-indexes-and-why-one-takes-hours)
- [Making it yours](#making-it-yours)
- [Optional integrations: Zotero, Google Docs](#optional-integrations)
- [Keeping your work private](#keeping-your-work-private)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing) · [Licence](#licence-and-attribution)

---

## What it covers

| Source | What you get | Tools |
| --- | --- | --- |
| **e-Sbírka** (Sbírka zákonů) | Any Czech act, in force today or on any past date, with the consolidated version resolved for you | `cz_act_text`, `cz_act_versions`, `cz_act_info`, `cz_act_toc`, `cz_act_relations` |
| **EUR-Lex / CELLAR** | Any EU regulation or directive, in 24 languages, with the right consolidated text | `eu_act_text`, `eu_act_versions`, `eu_act_metadata`, `eu_act_search`, `eu_celex_lookup` |
| **Nejvyšší správní soud** and the regional administrative courts | The whole of administrative law: environmental, tax, building, asylum, procurement. By the court's own subject index, by the provision applied, or by full text | `cz_nss_search`, `cz_nss_areas`, `cz_nss_case`, `cz_nss_text` |
| **Nejvyšší soud** | All published Supreme Court decisions, with the official collection category | `cz_case_search`, `cz_case_text` |
| **Ústavní soud** (NALUS) | All Constitutional Court decisions, with the form and outcome that decide their weight | `cz_us_search`, `cz_us_keywords` |
| **Court of Justice of the EU** | Judgments and Advocate General Opinions, from CELLAR | `eu_case_search`, `eu_case_documents` |
| **Ministry of Justice open data** | District and regional court decisions, civil and criminal | `cz_case_lower_search`, `cz_case_lower_scan` |
| **ÚOOÚ** | Everything the data protection authority has published since 2017 | `cz_guidance_search`, `cz_guidance_text` |
| **MŽP** | The Věstník 1995 to date and the Ministry of the Environment's methodological guidance, PDF text included | `cz_mzp_search`, `cz_mzp_text` |
| **ARES** | Who a counterparty is, and who may sign for them | `cz_company_search`, `cz_company` |

Plus **`legal_cite`**, the one you will use most: give it a loose reference
(`§ 58 121/2000`, `Art. 28 GDPR`, `C-311/18`, `I. ÚS 1234/21`) and it returns a
checked citation in both languages, the official link, a ready-to-paste markdown
link, and the wording the provision actually has. Add `as_of` for a historical
date and it fetches the version in force then.

## What it will not do

It is **research, not legal advice**, and it says so in every answer. It states
what the sources say, how confident that reading is, and when a qualified
advocate needs to be brought in.

It is **Czech and EU law only**. If you need United States law this is the wrong
tool, and it will say so rather than improvise.

It will not tell you **there is no case law** on something. It will tell you that
particular Czech queries against particular sources found nothing, and show you
the queries, because those are different claims and only the second is
supportable.

It does not **paraphrase a provision it has not read**. If a citation appears
without its text, that is a bug, and one the rules in `CLAUDE.md` exist to
prevent.

---

## Install

```
/plugin marketplace add ChlupacTheBosmer/legal-kit
/plugin install legal-kit@legal-kit
```

Restart Claude Code. The server installs its two dependencies on first start, so
the first session takes a few seconds longer than the rest.

Then, once per machine:

```
/legal-kit:setup
```

Three minutes for the quick path, twenty for the full one. It asks who you are,
what standing you hold, what you actually practise and what you only touch, then
runs a question block for each of your areas and builds the indexes you want.

Then, inside each matter or research project:

```
/legal-kit:setup-project
```

Five minutes. What this workspace is for, whose it is, which of your areas are
live here, what it produces, how confidential it is.

**Requirements:** Node 22 or newer, because the local indexes use the built-in
`node:sqlite`. Optionally `pdftotext` to index ministry PDFs by their text rather
than their title, and `python3` for the Google Docs helper.

### Commands

| | |
| --- | --- |
| `/legal-kit:setup` | Global cold start: who you are, your areas, your indexes |
| `/legal-kit:setup-project` | Per project: what this workspace is for |
| `/legal-kit:doctor` | Runtime, configuration, whether the registries answer, index staleness |
| `/legal-kit:status` | Cheap local check, safe while a long build runs |
| `/legal-kit:update` | Refresh whatever has gone stale |

Plus the research skill `cz-legal-research`, which is the Czech search procedure,
and nine Czech-language workflow skills for contract review, NDA triage,
compliance checks, counterparty KYC, negotiation preparation and risk assessment.

## Where things live

Nothing writable goes inside the plugin, because plugin installs are versioned
and an upgrade is a new directory.

| | |
| --- | --- |
| The plugin | `~/.claude/plugins/cache/legal-kit/legal-kit/<version>/` |
| Your profile | `~/.claude/plugins/config/legal-kit/profile.md` |
| Indexes and cache | `~/.legal-kit/` |
| Project configuration | `.legal-kit/project.md` and `CLAUDE.md` in the project |
| Your notes and work product | in the project, and gitignored by setup |

The indexes are global on purpose. ÚOOÚ guidance, the Věstník and the
lower-court index are jurisdiction-wide facts, not project facts: build the
4,400-document ministry mirror once and every matter you ever open uses it.

## What is in the plugin

```
.claude-plugin/     marketplace.json and plugin.json
.mcp.json           registers the lex server
scripts/launch.sh   starts it, installing dependencies on first run
hooks/              loads the sourcing rules in a configured legal project
rules/core.md       those rules: sourcing discipline, citation format, answer format

mcp/lex/            the MCP server: 29 tools over nine registries
  lib/              one module per source
  selftest.js       live end-to-end test of all of it

skills/
  setup/            the global cold-start interview
    areas/          a question block per practice area
  setup-project/    the per-project interview
  cz-legal-research/    the Czech search procedure
  cz-*/             nine Czech-language workflow skills
  doctor/ status/ update/

tools/              index builders, Google Docs and Zotero helpers
templates/          vault scaffolding that setup-project copies into a project
docs/               how each registry actually works, and the US-to-Czech overlay
```

### The vault

`vault/` is an [Obsidian](https://obsidian.md) vault, though it is ordinary
markdown and needs no particular editor. Open `vault/` as the vault root, not the
repository root.

| Folder | One note is |
| --- | --- |
| `10-Topics/` | one legal concept, for example *Legitimate interest* |
| `20-Instruments/` | one act, for example *Autorský zákon (121/2000 Sb.)* |
| `30-Memos/` | one question that was actually asked, dated |
| `40-Playbooks/` | one repeatable procedure |
| `50-Handbook/` | how the project works, for you and for the assistant |

Start with `vault/50-Handbook/Start here.md`. `What to trust.md` is the one to
read before relying on anything.

---

## How it thinks: the rules that make it useful

These are in `CLAUDE.md` and the assistant follows them in every answer. They are
worth knowing, because they are what separates this from asking a chatbot.

**Every cited provision carries its text.** The source named in full on first
mention, the operative words quoted, a link, and the version date. Never a bare
"Article 6(1)(f)". If it is not worth quoting, it is not worth citing.

**Verify before asserting.** Never state what a provision says from memory or
from a secondary source's paraphrase. If a law firm's blog says Article X says
something, read Article X. When the secondary source turns out to be wrong, that
is a finding worth recording.

**Time-version everything.** Czech acts change several times a year. The tools
resolve which consolidated version applies and say which one was read.

**Separate text, established reading and open question.** What the provision
says, what case law or regulator guidance says it means, and where the reading is
genuinely uncertain. Marked distinctly rather than blended.

**Query Czech sources in Czech.** The single most dangerous failure this setup can
produce is an English query returning nothing and that nothing being read as "no
such case law". Every Czech source rejects an obviously English query, the
`cz-legal-research` skill is the procedure, and an empty result is always
reported as "these queries against these sources found nothing".

**Czech law within the EU framework. Never US law.**

**Say when you don't know.** An honest "the sources do not settle this, and here
is what would" beats a confident guess.

---

## The indexes, and why one takes hours

Most sources are queried live. Three have no usable search API, so they are
mirrored into local SQLite full-text indexes:

| Index | Build time | Refresh | Why mirrored |
| --- | --- | --- | --- |
| **ÚOOÚ guidance** | seconds | monthly | The site has a JSON feed but no real search |
| **Lower courts** | minutes per year of coverage | quarterly | The open-data API is keyed by publication date only, with no subject query |
| **MŽP guidance and Věstník** | **hours** | quarterly | Drupal pages and PDFs, and the ministry's `robots.txt` asks for ten seconds between requests |

The MŽP build honours that ten-second delay, which is the entire reason it is
slow. It is resumable, records every URL it has visited, stays on the ministry's
own domain rather than following links out to third parties, and orders its work
so that an interrupted run still leaves you the guidance pages rather than
nothing. Start it and walk away:

```bash
/legal-kit:update     # or let /legal-kit:setup start it in the background
/legal-kit:status     # check on it, safely, while it runs
```

A full MŽP build produces roughly 4,400 documents, of which about 300 are Věstník
issues spanning 1995 to the present. Some attachments are `.docx`, `.xlsx` or
`.zip`, which carry no extractable text; those are indexed by title and URL, and
the search tool tells you how many.

The **Supreme Administrative Court is searched live**, so its case law is never
stale and needs no index at all. Only the court's subject vocabulary is cached,
for thirty days.

A stale mirror of a regulator is worse than none, because it looks current. That
is what the weekly refresh `/legal-kit:setup` offers is for.

---

## Making it yours

**Your profile** is where you live. `/legal-kit:setup` writes it from your answers: your
name, your role, whether you are legally qualified, whether you are on the roll of
advocates, what you practise, what you work in but do not specialise in, your
language, your integrations. It lives outside the plugin, so upgrading never touches it.

That file changes how the assistant writes:

| If you say | It will |
| --- | --- |
| Not on the ČAK roll | Claim no privilege over anything here, and name the trigger for bringing in an advocate |
| On the roll | Flag conflicts, client duties and deadlines more aggressively |
| Not legally qualified | Keep every citation, and explain the doctrinal step as well as the conclusion |
| Environmental is outside my specialism | Set out the doctrinal background rather than assume it |

Edit it by hand any time, or re-run `/legal-kit:setup` to rewrite it.

**`rules/core.md`** holds the rules that apply to everyone, and the hook loads them
in any configured legal project. Read them before disagreeing: most of it was
written in response to a specific way of getting things wrong.

**Adding a practice area?** Two things are worth doing. Add your tags to the
controlled list in `vault/README.md`, and extend `EN_MARKERS` in
the plugin's `mcp/lex/lib/czsearch.js` with the English vocabulary of that area. That
second one matters: the guard that stops an English query reaching a Czech corpus
works from a word list, so it is only as good as the subjects that list covers.

---

## Optional integrations

**Neither is required.** The legal research tools use only free, unauthenticated
government registries and work fully without any account anywhere.

### Zotero

For **commentary**: articles, textbooks, regulator PDFs. Legislation and case law
are not kept as bibliography entries; they are cited as links to the official
registry via `legal_cite`, because a link the reader can check beats a
bibliography line.

```bash
export ZOTERO_API_KEY=...        # zotero.org/settings/keys
export ZOTERO_LIBRARY_ID=...     # your numeric user id, or a group id
export ZOTERO_LIBRARY_TYPE=user  # or 'group'

node tools/zotero.mjs collections   # lists your collections, to check it works
```

It also reads a `zotero` MCP entry in `~/.claude.json` if you have one, so the
key can live in a single place.

```bash
node tools/zotero.mjs collections
node tools/zotero.mjs search "<query>" [--limit N]
node tools/zotero.mjs add --collection KEY --type journalArticle --title "..." \
     [--creators "Surname, Given; ..."] [--date 2024] [--doi ...] [--tags "a,b"]
node tools/zotero.mjs upload --collection KEY <file.pdf> ...
```

### Google Docs and Drive

For the **drafting and revision loop**: push a draft into a real document, read
back the comments colleagues leave with the text each one is anchored to, make a
surgical edit, reply to the comment and resolve it in the same call.

```bash
python3 -m pip install -r tools/requirements.txt
# then get an OAuth client secret from Google (see the doc), and:
python3 tools/google-auth.py <client_secret.json>
```

The full procedure, including the Google Cloud console steps, is in
[docs/google-docs-workflow.md](docs/google-docs-workflow.md). The token requests
`drive.file`, **not** full Drive access, so the tool can only touch documents it
created or that you explicitly opened with it. It is written to
`~/.claude_google_token.json` with mode 600, outside the repository, and you can
revoke it at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

```bash
python3 tools/gdoc.py list [--query Q]
python3 tools/gdoc.py read <DOC_ID>        # text + comments + tracked changes
python3 tools/gdoc.py create --title T --from-md FILE
python3 tools/gdoc.py edit <DOC_ID> --old '"..."' --new '"..."' \
        [--resolve-comment ID] [--reply TEXT]
python3 tools/gdoc.py link <DOC_ID> --text '"..."' --url URL
```

`edit` refuses when the target text is not unique, rather than silently changing
several places. Citations written into a document go through `legal_cite` first
and are inserted as live links to e-Sbírka or EUR-Lex, so a reader can check
them.

`/legal-kit:doctor` reports both integrations, and reports the Google libraries and the
Google token separately: having the token but not the Python packages is a
common and confusing state.

### claude-for-legal plugins

Optional, and **wrong law** out of the box. They are excellent workflow structure
drafted for United States in-house practice. Their output must be run through
[docs/jurisdiction-overlay.md](docs/jurisdiction-overlay.md) before delivery, and
the assistant is instructed to say what it corrected.

Watch for **fair use**, **assignment of copyright**, **work made for hire**,
**at-will employment**, **discovery** and **punitive damages**. None of them exist
in Czech law. The overlay says what to use instead.

---

## Keeping your work private

The plugin ships no personal content and writes none into itself. Your profile
lives in `~/.claude/plugins/config/legal-kit/`, indexes in `~/.legal-kit/`, and
your notes and work product stay in whatever project you made them in.

`/legal-kit:setup-project` adds the right `.gitignore` entries for a project that
is a git repository, covering `.legal-kit/`, your own notes, and any work-product
folders it scaffolds. It asks before touching an existing `.gitignore`.

## Maintenance

| Task | When |
| --- | --- |
| `/legal-kit:doctor` | when something behaves oddly, or after connecting an integration |
| `/legal-kit:update` | weekly, or let the scheduled job do it |
| ÚOOÚ index | monthly, seconds |
| MŽP index, lower-court index | quarterly |

`/legal-kit:update` refreshes only what has actually gone stale, so it is cheap
to run often and safe to schedule. `/legal-kit:setup` offers to install a weekly
job that does it for you.

A stale mirror of a regulator is worse than none, because it looks current.

## Troubleshooting

**the selftest fails on one source.** Usually that registry changed its HTML or was
having a slow morning. Read the failing check's message before assuming anything
here is broken; `docs/source-apis.md` documents how each source actually behaves.

**A Czech search returns nothing.** Check you searched the right court system.
Czech environmental, tax and building disputes are administrative law and live in
`cz_nss_search`; `cz_case_lower_search` holds the ordinary courts' civil and
criminal dockets and no administrative justice at all. Then check the query: some
engines match exact surface forms, so a four-word query can collapse a large
result set to zero. The `cz-legal-research` skill has the procedure.

**"The index has not been built yet."** That is a configuration state, not a
fault. `/legal-kit:update` builds what is missing. the selftest skips the blocks that
need an index you do not have, so a fresh clone is green.

**The MŽP build seems stuck.** It is not: it waits ten seconds between requests
because the ministry asks it to, and some attachments are 20 MB. `/legal-kit:status` is
safe to run while it works.

**Node complains about `node:sqlite`.** You are on Node older than 22, or a
minimal build without SQLite. `/legal-kit:doctor` says which.

---

## Contributing

Pull requests welcome. Two things make one easy to accept:

1. **`docs/source-apis.md` is updated.** It documents how each registry actually
   behaves, including the traps, and it is the reason adding a source takes an
   afternoon rather than a week.
2. **`selftest.js` covers it, with a check the bug would have failed.** There is
   a real example in the history: a check named "cz_act_relations surfaces EU
   links" passed for months while the tool printed a heading and silently dropped
   every row beneath it, because the assertion tested the heading.

the selftest hits the live registries and takes a couple of minutes. CI
deliberately does not: firing nine government sites on every push would be a poor
way to treat free public infrastructure. CI checks that everything parses, that
the server starts and registers its tools, and that nothing personal is tracked.

---

## Licence and attribution

Code and documentation here are **MIT** licensed. See `LICENSE`.

Third-party components keep their own licences and notices, and you must keep them
too if you redistribute. `NOTICE.md` has the detail:

- `plugins/pravo-skills-cz/` is derived from **pravo-skills by DirectCase** (MIT)
- `.claude/skills/task-observer/` is **One Skill to Rule Them All by Eoghan Henn**
  (CC BY 4.0)

**The legal material is not covered by any of this.** Czech legislation and court
decisions are excluded from copyright by § 3(a) of Act No. 121/2000 Coll., and EU
law is published under the Commission's reuse decision. But the indexes you build
are local copies of live government sites: do not redistribute them, rebuild them.
That is what `/legal-kit:update` is for.

## Disclaimer

Research, not legal advice. No lawyer-client relationship arises from using it.
The sources are official and the citations are checked against them, but the
reading of a provision is still a reading. Where it matters, take it to a
qualified advocate, and the assistant will tell you when that point is reached.
