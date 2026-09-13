# Notices and attributions

This repository is MIT licensed (see `LICENSE`). It bundles third-party work that
is **not** covered by that licence and carries its own terms. If you redistribute
this repository, in whole or in part, you must keep these notices and the licence
files they point at.

---

## `plugins/pravo-skills-cz/` — DirectCase, MIT

Derived from **`pravo-skills` v1.1.0 by DirectCase**, released under the MIT
Licence. The original nine Czech legal workflows are DirectCase's work and are
kept substantially as written.

- Licence: `plugins/pravo-skills-cz/LICENSE`, retained unchanged as the licence requires
- What was changed and why: `plugins/pravo-skills-cz/NOTICE.md`
- Original: <https://www.directcase.ai/cz/cs/news/claude-legal-plugin-cs>

The substantive legal content of these workflows has **not** been verified
provision by provision. Treat it as a structure to fill in, and check anything it
asserts against the primary source.

## `.claude/skills/task-observer/` — Eoghan Henn, CC BY 4.0

**"One Skill to Rule Them All"** by Eoghan Henn ([rebelytics.com](https://rebelytics.com)),
licensed under Creative Commons Attribution 4.0 International. Share and adapt
freely with credit to the author.

- Licence: `.claude/skills/task-observer/LICENSE.txt`
- Attribution: `.claude/skills/task-observer/ATTRIBUTION.md`
- Canonical source: <https://github.com/rebelytics/one-skill-to-rule-them-all>

## npm dependencies

The MCP server depends on two packages, installed by `make setup` and not
vendored here:

| Package | Licence |
| --- | --- |
| `@modelcontextprotocol/sdk` | MIT |
| `zod` | MIT |

## `claude-for-legal` plugins

Not bundled. If you install them from the marketplace they come under their own
terms. They are drafted for United States practice and their substantive defaults
are wrong for Czech and EU work; `docs/jurisdiction-overlay.md` is what corrects
them, and `docs/directcase-gap-analysis.md` records the analysis.

---

## The legal material itself

None of the above applies to the law. It is worth being precise about what may
and may not be redistributed, because this repository builds local copies of
government sites.

**Czech legislation and court decisions are outside copyright.** § 3(a) of Act
No. 121/2000 Coll., on copyright, excludes official works, which it defines to
include legal regulations, decisions, and official records. Quoting them in full
is exactly what this repository is for.

**EU law** is published by the Publications Office of the European Union and may
be reused under Commission Decision 2011/833/EU, with the source acknowledged.
The tools acknowledge it on every result.

**Do not redistribute the built indexes.** `.data/` holds local mirrors of live
government websites, including the Ministry of the Environment's PDFs and the
data protection authority's articles. Those are freely available at their source
and should be fetched from it. The indexes are gitignored for this reason as much
as for their size: rebuild them with `make update`, which is a few seconds for
some and a few hours for others.

**Do not redistribute material you were given.** `sources/` is gitignored because
it is meant for course materials, textbook extracts and case-law collections that
are somebody else's copyright. Keep them local.
