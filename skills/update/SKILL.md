---
name: update
description: Refresh the legal-kit indexes that have gone stale, or build missing ones (ÚOOÚ, MŽP, lower courts). Use on "update legal-kit", "refresh the indexes", "rebuild the index", or when doctor reports staleness.
argument-hint: "[--force] [--check] [uoou|mzp|justice]"
---

# /legal-kit:update

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/update.mjs
```

| Flag | Does |
| --- | --- |
| *(none)* | Refresh what is stale or missing, nothing else |
| `--check` | Report staleness, change nothing, exit non-zero if anything is stale |
| `--force` | Rebuild everything regardless of age |

Each index carries its own refresh interval, taken from how fast the source
actually moves: ÚOOÚ monthly, MŽP and the lower courts quarterly. An index inside
its interval is left alone, so this is cheap to run often.

## Before starting a long one

The MŽP build takes hours, because the ministry's `robots.txt` asks for ten
seconds between requests and legal-kit honours it. Say so before starting, not
after. It resumes if interrupted and it orders its work so that a partial build
still leaves the guidance pages rather than nothing.

Offer to run it in the background and to check on it with `/legal-kit:status`.

## What this does not refresh

The Supreme Administrative Court, the Supreme Court, the Constitutional Court,
the Court of Justice, e-Sbírka, EUR-Lex and the business register are all read
live. They are never stale and there is nothing to refresh. Only the court's
subject vocabulary is cached, for thirty days, and it refreshes itself.

## Keeping it current without thinking about it

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/schedule.mjs install
```

A weekly job that refreshes whatever has gone stale, and does nothing in the
weeks when nothing has. `schedule.mjs remove` takes it away.
