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

## Getting started

**Requirements**

| | | |
| --- | --- | --- |
| **Node 22 or newer** | required | The local indexes use the built-in `node:sqlite` |
| **Claude Code** | required | [claude.com/claude-code](https://claude.com/claude-code) |
| `pdftotext` (poppler) | optional | Indexes ministry PDFs by their text rather than their title |
| `python3` | optional | Only for the Google Docs helper |
| `git` | optional | Only to pull updates |

```bash
git clone https://github.com/ChlupacTheBosmer/legal-kit.git
cd legal-kit
make setup
```

`make setup` does five things, each skippable, and is safe to re-run:

1. **Checks the machine.** If something is missing it names it, says what it is
   for, and gives the command that installs it.
2. **Installs** the MCP server's two npm dependencies.
3. **Asks who you are** and writes `PROFILE.md`.
4. **Builds the local indexes**, with an honest time estimate for each.
5. **Offers a weekly refresh** via launchd or cron.

Then:

```bash
claude          # the legal tools are registered automatically
```

A good first question is one you already know the answer to.

### The commands

```
make setup       first run: check, install, configure, build
make doctor      is everything working, reachable and current?
make status      quick local status, safe during a long background build
make test        end-to-end test of every tool against the live registries
make update      refresh whatever has gone stale
make schedule    install a weekly refresh
make help        all of them
```

`make doctor` is the one to run when something feels wrong. It reports what is
installed, what is reachable, what is configured and what is stale, and attaches
the fix to each failure rather than leaving it implied.

---

## What is in the repository

```
CLAUDE.md              The rules. Read this first.
PROFILE.md             You. Written by `make setup`, never committed.
PROFILE.example.md     What PROFILE.md looks like, as documentation.
Makefile               Every command.
NOTICE.md              Third-party licences, and what may be redistributed.

mcp-servers/lex/       The MCP server: 29 tools over nine registries.
  server.js            Tool definitions and how each result is presented.
  lib/                 One module per source. esbirka, eurlex, nss, mzp,
                       caselaw, nalus, justice, cjeu, uoou, ares, cite,
                       aliases, czsearch (Czech stemming and the
                       English-query guard), http (cache), format.
  selftest.js          Live end-to-end test of all of it.

tools/
  uoou-index.mjs       Build the data protection authority's guidance index
  mzp-index.mjs        Build the environment ministry's guidance index
  justice-index.mjs    Build the lower-court index
  gdoc.py              Google Docs: read, comment, edit, create  (optional)
  google-auth.py       One-time Google authorisation              (optional)
  zotero.mjs           Zotero: search, add, upload                (optional)
  requirements.txt     Python dependencies, for the Google helper only

setup/
  setup.mjs            The wizard
  doctor.mjs           Health, reachability, staleness
  status.mjs           Cheap local status
  update.mjs           Refresh what has gone stale
  schedule.mjs         launchd / cron install and removal
  check-private.mjs    What git would publish, before it does

vault/                 The knowledge base (an Obsidian vault, but plain markdown)
  50-Handbook/         How the project works. Start here.
  90-Templates/        Note templates: topic, instrument, memo, playbook
  40-Playbooks/        One worked example ships with the template
  10-Topics/ 20-Instruments/ 30-Memos/ 00-Inbox/   yours, gitignored

docs/
  tooling.md               What each tool does, and its limits
  source-apis.md           How each registry actually works, including the traps
  jurisdiction-overlay.md  US-to-Czech corrections for the plugins
  google-docs-workflow.md  The Google Docs loop, and how to authorise it
  directcase-gap-analysis.md   Analysis of the Czech workflow plugin

.claude/skills/
  cz-legal-research/   The Czech search procedure. The most valuable single file.
  task-observer/       Notices patterns worth turning into skills (CC BY 4.0)

plugins/pravo-skills-cz/     Nine Czech-language workflows (MIT, DirectCase)
privacy/ contracts/ ai-governance/    Scaffolding for work product, gitignored
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
make index-mzp     # or let `make setup` start it in the background
make status        # check on it, safely, while it runs
```

A full MŽP build produces roughly 4,400 documents, of which about 300 are Věstník
issues spanning 1995 to the present. Some attachments are `.docx`, `.xlsx` or
`.zip`, which carry no extractable text; those are indexed by title and URL, and
the search tool tells you how many.

The **Supreme Administrative Court is searched live**, so its case law is never
stale and needs no index at all. Only the court's subject vocabulary is cached,
for thirty days.

A stale mirror of a regulator is worse than none, because it looks current. That
is what `make schedule` is for.

---

## Making it yours

**`PROFILE.md`** is where you live. `make setup` writes it from your answers: your
name, your role, whether you are legally qualified, whether you are on the roll of
advocates, what you practise, what you work in but do not specialise in, your
language, your integrations. It is **not tracked by git**, so it stays on your
machine and `git pull` never touches it.

That file changes how the assistant writes:

| If you say | It will |
| --- | --- |
| Not on the ČAK roll | Claim no privilege over anything here, and name the trigger for bringing in an advocate |
| On the roll | Flag conflicts, client duties and deadlines more aggressively |
| Not legally qualified | Keep every citation, and explain the doctrinal step as well as the conclusion |
| Environmental is outside my specialism | Set out the doctrinal background rather than assume it |

Edit it by hand any time, or re-run `make setup` to rewrite it.

**`CLAUDE.md`** holds the rules that apply to everyone. Edit it if you disagree,
but read it first: most of it was written in response to a specific way of getting
things wrong.

**Adding a practice area?** Two things are worth doing. Add your tags to the
controlled list in `vault/README.md`, and extend `EN_MARKERS` in
`mcp-servers/lex/lib/czsearch.js` with the English vocabulary of that area. That
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

make zotero                      # lists your collections, to check it works
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

`make doctor` reports both integrations, and reports the Google libraries and the
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

This repository is meant to be forked and shared, and its whole point is that you
keep real legal work in it. Those pull against each other, so the separation is
explicit rather than left to everyone's care with `.gitignore`.

**Never tracked:** `PROFILE.md`, your maintenance log, everything you write in
`vault/10-Topics`, `20-Instruments`, `30-Memos`, `00-Inbox` and your own
playbooks, all of `privacy/`, `contracts/` and `ai-governance/` below their
READMEs, `sources/` (for third-party material you may not redistribute), the
built indexes, and the HTTP cache.

```bash
make check-private
```

It reads what git would **actually** publish rather than what is on disk, and
flags personal profiles, work product, your own notes, email addresses, company
names and identifiers, and anything shaped like a credential. Run it before your
first push and you will not have to think about it again.

---

## Maintenance

`vault/50-Handbook/Maintenance.md` is the schedule;
`vault/50-Handbook/Maintenance log.md` records what you last did, and is
gitignored so it never conflicts on a pull.

| Task | When |
| --- | --- |
| `make doctor` | every session where you use the tools |
| `make update` | weekly, or let `make schedule` do it |
| ÚOOÚ index | monthly (seconds) |
| MŽP index, lower-court index | quarterly |
| `make test-aliases` | every six months, to check every act and CELEX alias still resolves |
| Re-check the jurisdiction overlay | every six months |

`make update` refreshes only what has actually gone stale, so it is cheap to run
often and safe to schedule.

---

## Troubleshooting

**`make test` fails on one source.** Usually that registry changed its HTML or was
having a slow morning. Read the failing check's message before assuming anything
here is broken; `docs/source-apis.md` documents how each source actually behaves.

**A Czech search returns nothing.** Check you searched the right court system.
Czech environmental, tax and building disputes are administrative law and live in
`cz_nss_search`; `cz_case_lower_search` holds the ordinary courts' civil and
criminal dockets and no administrative justice at all. Then check the query: some
engines match exact surface forms, so a four-word query can collapse a large
result set to zero. The `cz-legal-research` skill has the procedure.

**"The index has not been built yet."** That is a configuration state, not a
fault. `make update` builds what is missing. `make test` skips the blocks that
need an index you do not have, so a fresh clone is green.

**The MŽP build seems stuck.** It is not: it waits ten seconds between requests
because the ministry asks it to, and some attachments are 20 MB. `make status` is
safe to run while it works.

**Node complains about `node:sqlite`.** You are on Node older than 22, or a
minimal build without SQLite. `make doctor` says which.

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

`make test` hits the live registries and takes a couple of minutes. CI
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
That is what `make update` is for.

## Disclaimer

Research, not legal advice. No lawyer-client relationship arises from using it.
The sources are official and the citations are checked against them, but the
reading of a provision is still a reading. Where it matters, take it to a
qualified advocate, and the assistant will tell you when that point is reached.
