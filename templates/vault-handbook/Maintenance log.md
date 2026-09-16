---
title: Maintenance log
type: handbook
status: verified
tags: []
created: 2026-09-13
updated: 2026-09-13
---

# Maintenance log

**Agents: read this first.** If anything below is past its due date, perform it
before substantive work, then update the row and add one line to the history.
The tasks themselves are described in [[Maintenance]].

This file is **not tracked by git**: it records what *you* last refreshed, so it
would conflict on every pull. `make setup` creates it and `make update` keeps it
current.

## Next due

| Task | Last done | Next due | Overdue? |
| --- | --- | --- | --- |
| Health check (`make doctor`) | never | every session using tools | check each session |
| ÚOOÚ index rebuild | never | on first `make update` | build it |
| MŽP guidance index rebuild | never | on first `make update` | build it |
| Lower-court index refresh | never | on first `make update` | build it |
| Alias verification (`make test-aliases`) | never | every six months | — |
| Re-check jurisdiction overlay | never | every six months | — |
| Cache prune | never | when `.cache/` exceeds a few hundred MB | — |

## How to update this page

`make update` rewrites the rows it refreshes. If you run a task by hand, change
its **Last done** to today, push **Next due** out by the interval in
[[Maintenance]], and add one line to the history below. Keep it to one line.

## History

- **2026-09-13**: workspace created from the template.
