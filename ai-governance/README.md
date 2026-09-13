---
title: AI governance outputs
type: handbook
status: verified
tags: []
created: 2026-08-27
updated: 2026-08-27
---

# AI governance outputs

Working directory for `ai-governance-legal` plugin output: impact assessments,
use case triage results, vendor artificial intelligence reviews, and regulatory
gap analyses.

**The practice profile that governs all of it** is
`~/.claude/plugins/config/claude-for-legal/ai-governance-legal/CLAUDE.md`. Read it
before producing anything here. The system inventory is
`~/.claude/plugins/config/claude-for-legal/ai-governance-legal/ai-systems.yaml` and
is currently empty.

## Naming

`YYYY-MM-DD-<kind>-<subject>.md`, where kind is `aia`, `triage`, `vendor` or `gap`.

## Header on every document

```
INTERNAL AND CONFIDENTIAL - IN-HOUSE LEGAL ANALYSIS
Not covered by advocate confidentiality (§ 21 of Act No. 85/1996 Coll.)
```

Never a privilege stamp, and never a non-lawyer "research notes" framing. The
reasons are in the shared company profile.

## What is open as at 2026-08-27

Two obligations under Regulation (EU) 2024/1689 (Artificial Intelligence Act) are
running and unmet, and one large gap blocks classification:

1. **Article 4, artificial intelligence literacy** - applies since 2025-02-02,
   nothing in place.
2. **Article 50(2), machine-readable marking of synthetic output** - applies since
   2026-08-02, nothing in place.
3. **The system inventory is empty**, so no system can be classified against
   Article 6 and Annex III and neither of the above can be scoped per system.

Full text of each provision, with links and version dates, is in the practice
profile. Do not restate them from memory.

## Related

- `../privacy/` - data protection material. The impact assessment here extends the
  privacy impact assessment template rather than duplicating it.
- `../docs/jurisdiction-overlay.md` - the correction layer for the United States
  drafted plugin templates.
- `../vault/50-Handbook/Agent guide.md` - tool selection and search discipline.
