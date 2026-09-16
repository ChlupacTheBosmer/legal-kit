---
name: status
description: Local legal-kit status: profile, index sizes and ages, any background build, the refresh schedule. No network, safe during a long build. Use on "how is the build going", "legal-kit status".
---

# /legal-kit:status

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs
```

Cheap and offline: it reads what is on disk. Safe during a background build,
which is the main reason it exists separately from `/legal-kit:doctor`.

Use `/legal-kit:doctor` when the question is "is anything broken". Use this when
the question is "how far has the MŽP build got".
