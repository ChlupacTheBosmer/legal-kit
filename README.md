# Czech and EU legal research workspace

A workspace for [Claude Code](https://claude.com/claude-code) that answers Czech
and European Union legal questions **from the official registries**, and builds a
durable knowledge base out of the answers.

The point is narrow and worth stating plainly: a general-purpose assistant will
tell you what § 30 of the Copyright Act says from memory, and it will sometimes
be wrong in ways you cannot see. This one looks the provision up, quotes the
words, tells you which consolidated version it read and on what date, and links
you to the government's own page so you can check it. Everything else here exists
to protect that property.

Twenty-nine tools over nine official sources. All free, all unauthenticated, no
account needed for any of them.

---

## What it covers

| Source | What you get |
| --- | --- |
| **e-Sbírka** (Sbírka zákonů) | Any Czech act, in force today or on any past date, with the consolidated version resolved for you |
| **EUR-Lex / CELLAR** | Any EU regulation or directive, in 24 languages, with the right consolidated text |
| **Nejvyšší správní soud** and the regional administrative courts | The whole of administrative law: environmental, tax, building, asylum, procurement. Searchable by the court's own subject index, by the provision applied, or by full text |
| **Nejvyšší soud** | All published Supreme Court decisions, with the official collection category |
| **Ústavní soud** (NALUS) | All Constitutional Court decisions, with the form and outcome that decide their weight |
| **Court of Justice of the EU** | Judgments and Advocate General Opinions, from CELLAR |
| **Ministry of Justice open data** | District and regional court decisions, civil and criminal |
| **ÚOOÚ** | Everything the data protection authority has published since 2017 |
| **MŽP** | The Věstník and the Ministry of the Environment's methodological guidance, PDFs included |
| **ARES** | Who a counterparty is, and who may sign for them |

Plus `legal_cite`, which is the one you will use most: give it a loose reference
and it returns a checked citation, the official link, and the wording the
provision actually has.

## What it will not do

It is research, not legal advice, and it says so in every answer. It states what
the sources say, how confident that reading is, and when a qualified advocate
needs to be brought in.

It is Czech and EU law only. If you need United States law this is the wrong
tool, and it will refuse rather than improvise.

It will not tell you there is no case law on something. It will tell you that
particular Czech queries against particular sources found nothing, and show you
the queries, because those are different claims and only the second one is
supportable.

---

## Getting started

Requirements: **Node 22 or newer** (the local indexes use the built-in
`node:sqlite`), and Claude Code. Optionally `pdftotext` for indexing ministry
PDFs, and `python3` for the Google Docs helper.

```bash
git clone https://github.com/YOUR-NAME/lex-cz.git
cd lex-cz
make setup
```

`make setup` checks the machine and tells you exactly what is missing if
anything is, installs two npm dependencies, asks who you are and what you
practise, writes your `PROFILE.md`, and offers to build the local indexes. It is
safe to re-run and every step is skippable.

Then:

```bash
claude          # the legal tools are registered automatically
```

Ask it something. A good first question is one you already know the answer to.

### The commands

```
make setup       first run: check, install, configure, build
make doctor      is everything working, reachable and current?
make status      quick local status, safe during a long background build
make update      refresh whatever has gone stale
make test        end-to-end test of every tool against the live registries
make schedule    install a weekly refresh (launchd on macOS, cron on Linux)
make help        all of them
```

`make doctor` is the one to run when something feels wrong. It reports what is
installed, what is reachable, what is configured and what is stale, and attaches
the fix to each failure rather than leaving it implied.

---

## The indexes, and why some take hours

Most sources are queried live. Three have no usable API, so they are mirrored
into local SQLite full-text indexes:

| Index | Build time | Refresh | Why it is mirrored |
| --- | --- | --- | --- |
| ÚOOÚ guidance | seconds | monthly | The site has a JSON feed but no search worth the name |
| Lower courts | minutes per year of coverage | quarterly | The open-data API is keyed by publication date only, with no subject query |
| MŽP guidance and Věstník | **hours** | quarterly | Drupal pages and PDFs, and the ministry's `robots.txt` asks for ten seconds between requests |

The MŽP build honours that ten-second delay, which is why it is slow. It is
resumable, records every URL it has visited, and orders its work so that an
interrupted run still leaves you the guidance pages rather than nothing. Start it
and walk away:

```bash
make index-mzp     # or let `make setup` start it in the background
make status        # check on it
```

The Supreme Administrative Court is **searched live**, so its case law is never
stale and needs no index at all. Only the court's subject vocabulary is cached,
for thirty days.

A stale mirror of a regulator is worse than none, because it looks current. That
is what `make schedule` is for.

---

## Making it yours

**`PROFILE.md`** is where you live. `make setup` writes it from your answers:
your name, your role, whether you are legally qualified, whether you are on the
roll of advocates, what you practise, what you work in but do not specialise in,
your language, your integrations. It is **not tracked by git**, so it stays on
your machine, and a `git pull` will never touch it.

That file changes how the assistant writes. Say you are not on the ČAK roll and
it claims no privilege over anything here and tells you when an advocate is
needed. Say environmental law is outside your specialism and it sets out the
doctrinal background instead of assuming it.

**`CLAUDE.md`** holds the rules that apply to everyone: sourcing discipline,
citation format, the jurisdiction rule, the answer format, the writing style.
Edit it if you disagree, but read it first; most of it was written in response to
a specific way of getting things wrong.

**`vault/`** is an [Obsidian](https://obsidian.md) vault, though it is just
markdown and needs no particular editor. The handbook, the note templates and one
worked playbook ship with the template. Everything you write in it is gitignored.

**Integrations**, all optional and none required:

| Integration | For | Configure |
| --- | --- | --- |
| Zotero | Commentary, articles, textbooks | A `zotero` MCP entry with `ZOTERO_API_KEY` in `~/.claude.json` |
| Google Docs and Drive | Drafting, with comments and tracked changes | `docs/google-docs-workflow.md` |
| `claude-for-legal` plugins | Workflow structure | Install from the marketplace; see the jurisdiction warning below |

### Before you push

```bash
make check-private
```

It reads what git would actually publish, not what is on disk, and flags personal
profiles, work product, your own notes, emails, company identifiers and anything
that looks like a credential. Run it before your first push and you will not have
to think about it again.

---

## The jurisdiction warning

The `claude-for-legal` plugins are excellent structure and **wrong law** here.
They are drafted for United States in-house practice. Their output has to be run
through `docs/jurisdiction-overlay.md` before delivery, and the assistant is
instructed to say what it corrected.

Watch in particular for **fair use**, **assignment of copyright**, **work made
for hire**, **at-will employment**, **discovery** and **punitive damages**. None
of them exist in Czech law. The overlay says what to use instead.

---

## Where things are

```
CLAUDE.md              The rules. Read this first.
PROFILE.md             You. Written by `make setup`, never committed.
Makefile               Every command.

mcp-servers/lex/       The MCP server: 29 tools over nine registries.
  lib/                 One module per source.
  selftest.js          Live end-to-end test of all of it.
tools/                 Index builders, Google Docs helper, Zotero helper.
setup/                 setup, doctor, status, update, schedule, check-private.

vault/                 The knowledge base (Obsidian).
  50-Handbook/         How the project works. Start here.
  90-Templates/        Note templates.
  40-Playbooks/        One worked example ships with the template.

docs/
  tooling.md           What each tool does, and its limits.
  source-apis.md       How each registry actually works. Read before changing a source.
  jurisdiction-overlay.md  US-to-Czech corrections for the plugins.

plugins/pravo-skills-cz/  Nine Czech-language workflows (MIT, DirectCase).
privacy/ contracts/ ai-governance/   Scaffolding for work product. Gitignored.
```

---

## Contributing back

If you add a source, extend a vocabulary, or find that a registry has changed
shape, a pull request is welcome. Two things make one easy to accept:

1. **`docs/source-apis.md` is updated.** It documents how each registry actually
   behaves, including the traps. It is the reason a new source takes an afternoon
   rather than a week.
2. **`selftest.js` covers it.** The test must be one the bug would have failed.
   There is a real example in the history: a check named "cz_act_relations
   surfaces EU links" passed for months while the tool printed a heading and
   silently dropped every row beneath it, because the assertion tested the
   heading.

Running `make test` hits the live registries. It takes a couple of minutes, and a
failure usually means a source changed its HTML rather than that anything here is
broken.

---

## Licence and attribution

The code and documentation in this repository are MIT licensed. See `LICENSE`.

Third-party components keep their own licences and notices, and you must keep
them too if you redistribute. See `NOTICE.md` for the full list:

- `plugins/pravo-skills-cz/` is derived from **pravo-skills by DirectCase** (MIT)
- `.claude/skills/task-observer/` is **One Skill to Rule Them All by Eoghan
  Henn** (CC BY 4.0)

**The legal material is not covered by any of this.** Czech legislation and
court decisions are excluded from copyright by § 3(a) of Act No. 121/2000 Coll.,
and EU law is published under the Commission's reuse decision, but the indexes
you build are local copies of live government sites. Do not redistribute them;
rebuild them, which is what `make setup` is for.

## Disclaimer

Research, not legal advice. No lawyer-client relationship arises from using it.
The sources are official and the citations are checked against them, but the
reading of a provision is still a reading. Where it matters, take it to a
qualified advocate, and the assistant will tell you when that point is reached.
