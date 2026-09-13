# Legal knowledge vault

Obsidian vault. Open this folder (`vault/`) as the vault root, not the repository root.

**New here? Open `50-Handbook/Start here.md`.**

## Folders

| Folder | Holds | One note is… |
| --- | --- | --- |
| `00-Inbox/` | Raw captures not yet worked up | anything, temporarily |
| `10-Topics/` | Concept notes — the core of the vault | one legal concept, e.g. *Text and data mining exception*, *Legitimate interest* |
| `20-Instruments/` | Notes on a specific act or regulation | one instrument, e.g. *GDPR*, *Autorský zákon (121/2000 Sb.)* |
| `30-Memos/` | Answers to concrete questions that were actually asked | one question, dated |
| `40-Playbooks/` | Repeatable procedures and checklists | one recurring task, e.g. *Vendor DPA review* |
| `50-Handbook/` | How the project works — for you and for agents | one aspect of using the project |
| `90-Templates/` | Note templates | — |
| `_attachments/` | PDFs, images referenced from notes | — |

A note belongs in `10-Topics/` if you would reach for it when thinking about a
problem, and in `20-Instruments/` if you would reach for it when you already know
which act applies. When in doubt: `10-Topics/`.

## Frontmatter

Every note starts with:

```yaml
---
title: Short descriptive title
type: topic | instrument | memo | playbook
jurisdiction: [EU, CZ]        # or one of them
status: draft | verified      # verified = every citation checked against primary source
tags: [ip/copyright, gdpr]
created: 2026-08-23
updated: 2026-08-23
sources_checked: 2026-08-23   # date the citations were last verified against the registry
---
```

## Tags

Use tags from this list. Add to the list rather than inventing one-off variants.

`ip/copyright` · `ip/trademark` · `ip/patent` · `ip/design` · `ip/trade-secret` ·
`ip/licensing` · `ip/open-source` · `data/gdpr` · `data/eprivacy` ·
`data/transfers` · `ai/ai-act` · `ai/governance` · `ai/training-data` ·
`platform/dsa` · `platform/dma` · `cyber/nis2` · `contracts` · `consumer` ·
`competition` · `employment` · `corporate` · `tax` · `procedure` ·
`env/general` · `env/nature` · `env/water` · `env/waste` · `env/air` ·
`env/eia` · `env/permitting` · `env/climate` · `env/liability` ·
`env/access-to-justice` · `admin/procedure` · `admin/judicial-review`

## Conventions

- **English.** Keep Czech terms in parentheses on first use where the Czech word is
  the term of art: *right of communication to the public (sdělování díla veřejnosti)*.
- **Link liberally.** `[[Wikilinks]]` to related notes. A link to a note that
  doesn't exist yet is a to-do, not a mistake.
- **Cite inline**, with a version and a link. A claim without a citation is a draft
  claim, and the note stays `status: draft` until it has one.
- **Date the reading.** Law changes; `sources_checked` tells a future reader how
  stale the note might be.
- **One idea per note.** If a note grows two distinct subjects, split it.
