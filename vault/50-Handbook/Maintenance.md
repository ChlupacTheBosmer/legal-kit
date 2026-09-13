---
title: Maintenance
type: handbook
status: verified
tags: []
created: 2026-08-24
updated: 2026-09-13
---

# Maintenance

Parts of this project are **local copies** of things that change. A copy that is
never refreshed quietly goes stale, and stale legal material is worse than none.

The schedule below is the whole of it. [[Maintenance log]] records what was last
done and when the next one is due — **an agent picking this project up should
check that log before substantive work and perform anything overdue.**

## The tasks

### 1. Health check — every session where tools are used

```bash
node mcp-servers/lex/selftest.js
```

About 83 live checks against every upstream source; takes a couple of minutes.
Everything should pass. A failure usually means a source changed its HTML or its
API — read the failing test's message before assuming the source is down.

Cheap enough to run whenever something behaves oddly.

### 2. ÚOOÚ guidance index — monthly

```bash
node tools/uoou-index.mjs stats     # how stale is it
node tools/uoou-index.mjs build     # refresh (about 3 seconds)
```

The Czech data-protection authority publishes a few items a month. The search
tool warns when the index is over a month old, but the warning only appears if
someone searches. Rebuilding is nearly free — just do it monthly.

### 3. Lower-court index — quarterly, or when you need older cases

```bash
node tools/justice-index.mjs stats
node tools/justice-index.mjs build --from 2025-01-01
```

Only fetches days it does not already have, so re-running is cheap. To reach
further back, lower the `--from` date — roughly four API calls and 280 decisions
per publication day, so a full extra year is a few minutes.

### 3b. MŽP guidance index — quarterly

```bash
node tools/mzp-index.mjs stats     # how stale is it
node tools/mzp-index.mjs build     # refresh; resumable, run it in the background
```

Mirrors the Věstník MŽP and the ministry's methodological documents, the text of
the PDFs included. The ministry's `robots.txt` asks for ten seconds between
requests and the builder honours it, so a full build takes a few hours. It
records every URL it has visited, so an interrupted run continues rather than
restarting, and a re-run only fetches what is new or previously failed.

The Věstník is published at least four times a year and a new methodical
instruction can change how a provision is applied, so quarterly is the floor.
`cz_mzp_search` warns when the index is over three months old.

PDF text extraction needs `pdftotext` (`brew install poppler`). Without it the
files are indexed by title and URL only; the index records which applied, and
the search tool says so on every result.

### 3c. NSS vocabularies — automatic, but check after a site change

`cz_nss_search` is a live search against vyhledavac.nssoud.cz, so its **case law
needs no refreshing**. Only the court's controlled vocabularies are cached, for
thirty days, in `.data/nss-vocab.json`:

```bash
node -e 'import("./mcp-servers/lex/lib/nss.js").then(n=>n.vocabulary({refresh:true}).then(v=>console.log(v.areas.length,"areas,",v.courts.length,"courts")))'
```

The implementation discovers each form control from the court's own
`TechnickyNazev` markers rather than from its position, so renumbering the form
does not break it. If the court removes or renames a criterion the tool fails
with the name of the missing one, which is the signal to update `lib/nss.js`.

### 4. Verify the alias tables — every six months

```bash
node mcp-servers/lex/selftest.js --aliases
```

Checks that every short name (GDPR, AI Act, *autorský zákon*…) still resolves to
a real, current instrument. This is how we caught that the 2014 Cybersecurity Act
had been repealed and replaced by 264/2025 Sb.

### 5. Re-check the correction notes — every six months

Re-read `docs/jurisdiction-overlay.md` and spot-check three or four of its
provisions with `legal_cite`. It is the document most likely to drift, because it
makes substantive legal claims rather than just pointing at sources. A review
already found two real errors in it.

### 6. Prune the HTTP cache — when it bothers you

```bash
du -sh .cache/lex        # if this is over a few hundred MB
```

`.cache/lex/` is disposable — deleting it only costs re-fetching. The **indexes
are not there**; they live in `.data/`, which must not be deleted.

## What not to do

- **Do not delete `.data/`.** Rebuilding the lower-court index costs thousands of
  API calls against a public service.
- **Do not rebuild indexes during a research session** — it saturates the
  connection and unrelated tools start timing out.
