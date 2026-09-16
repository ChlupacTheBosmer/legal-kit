---
name: doctor
description: >
  Check that legal-kit is working: Node and dependencies, your profile, the
  optional integrations, whether the nine official registries are reachable, and
  whether the local indexes have gone stale. Each failure carries its own fix.
  Use when something behaves oddly, after connecting an integration, or when the
  user says "is legal-kit working", "check my setup", or "doctor".
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
