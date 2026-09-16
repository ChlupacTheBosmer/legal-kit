---
name: doctor
description: Check legal-kit: runtime, profile, integrations, companion plugins, whether the registries answer, and index staleness. Each failure carries its fix. Use when something behaves oddly, after connecting an integration, or on "is legal-kit working", "doctor".
argument-hint: "[--quick to skip the network check]"
---

# /legal-kit:doctor

Run it and read the result to the user:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs
```

`--quick` skips the reachability check, which is the slow part.

## Reading the output

Four sections: runtime, your configuration, the official sources, the local
indexes. Each failure prints the command that fixes it.

**Do not paraphrase a failure into reassurance.** If `node:sqlite` is missing,
say the indexes cannot be built and why, rather than "minor issue".

**A source that is unreachable is usually theirs, not yours.** These are
government registries and they have slow mornings. Say which one, and that the
rest still work: the tools are independent of each other.

**An index that is "not built" is a configuration state, not a fault.** Say what
it costs: without the ÚOOÚ index there is no regulator guidance for GDPR
questions; without MŽP there is none for environmental ones; without the
lower-court index, first-instance civil and criminal decisions are invisible.
Offer `/legal-kit:update`.

**An index that is stale looks current and is not.** That is the dangerous state,
and it deserves a stronger nudge than a missing one.

## After a failure the user fixes

Re-run it. Do not assume a fix worked because the command exited zero.

## If the tools are missing entirely

legal-kit registers its full tool set only in a project that has been through
`/legal-kit:setup-project`, because twenty-nine tool definitions cost about
eight thousand tokens of context in every session that loads them and most
sessions are not legal work. Outside such a project only `legal_cite` is
registered.

So "the tools are gone" usually means the working directory has no
`.legal-kit/project.md` above it. Either run `/legal-kit:setup-project` here, or
set `LEGAL_KIT_SCOPE=always` and restart to load them everywhere.
