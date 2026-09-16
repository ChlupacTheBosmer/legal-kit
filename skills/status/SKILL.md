---
name: status
description: >
  Quick local check of the legal-kit workspace: profile, index sizes and ages,
  any background build in progress, and whether the weekly refresh is installed.
  No network calls, so it is safe to run while a long index build is working.
  Use when the user asks what state things are in, or how a build is going.
---

# /legal-kit:status

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs
```

Cheap and offline: it reads what is on disk. Safe during a background build,
which is the main reason it exists separately from `/legal-kit:doctor`.

Use `/legal-kit:doctor` when the question is "is anything broken". Use this when
the question is "how far has the MŽP build got".
