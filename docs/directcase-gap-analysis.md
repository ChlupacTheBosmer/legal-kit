# DirectCase: what it offers, what we already have, what is worth building

Assessment as of 2026-08-24.

## Scope of this analysis, and its limit

DirectCase sells a paid MCP server. I have not probed it, queried it with your
free account, or tried to extract its data or behaviour — using a free tier to
reconstruct a paid service is not something I'll do, and it isn't necessary.
Everything below comes from two public sources: their own marketing pages, and
the **MIT-licensed** skill pack they publish, which names their tools openly.

That turns out to be enough, because the interesting question is not "how does
their index work" but "what categories of source does a Czech lawyer need, and
can we read those directly from the authorities that publish them". Mostly we
can — and reading the registry directly is *better* than reading someone's index
of it, because the text is authoritative and the version is knowable.

## Their published capability

From their skill pack and news pages:

| Their tool | What it covers |
| --- | --- |
| `search_caselaw_parallel` | NS, ÚS, NSS, high and regional courts |
| `search_law_parallel` | Czech acts and secondary legislation, as in force on a date |
| `search_regulatory_parallel` | Opinions of ČNB, ÚOOÚ, ÚOHS, ČTÚ, SÚKL, NÚKIB |
| `search_keyword` | Keyword search across the whole corpus |
| `search_similar` | Documents similar to a given one |
| `get_document`, `get_law_detail` | Full text |
| — | Commercial and public registers; ECtHR and CJEU decisions |

Claimed corpus: ~1.4 million verified Czech and EU sources.

## Against what `lex` already does

| Capability | DirectCase | `lex` | Verdict |
| --- | --- | --- | --- |
| Czech legislation, text in force on a date | indexed copy | **e-Sbírka direct** — the legally authoritative publication since 1 Jan 2024, with the full consolidated version history | **We are better.** Theirs is a copy; ours is the source of truth, and gives every historical version by effective date. |
| EU legislation | indexed copy | **EUR-Lex/CELLAR direct**, 24 languages, consolidated versions, in-force status | **We are better**, same reason. |
| Supreme Court case law | search | full search + text | **Parity.** |
| Constitutional Court | search | text by case number only | **Gap: no search.** |
| District / regional courts | search | date-window scan + filter | **Gap: no subject index.** |
| NSS, high courts | search | none | **Gap.** |
| Regulator guidance | search across ČNB, ÚOOÚ, ÚOHS, ČTÚ, SÚKL, NÚKIB | **ÚOOÚ mirrored locally with full-text search** | **Closed for ÚOOÚ** (the one that matters for GDPR). Other regulators remain a gap. |
| Commercial register | search | **ARES direct**, incl. acting rules and statutory bodies | **Parity or better.** |
| CJEU | search | via CELEX | **Parity.** |
| ECtHR | search | none | **Gap.** |
| Similarity search | `search_similar` | none | Nice to have. |
| Verified citation with the actual wording | — | **`legal_cite`** | **We are better** — nothing equivalent is advertised. |

## What is actually worth building, in order

### 1. Regulator guidance — ÚOOÚ done, others outstanding

**ÚOOÚ is built.** It turned out easier than expected: the site has an
undocumented but public JSON feed at `/api/articles` that returns every article
with its full body, so the corpus arrives in a single request rather than
needing a crawler. ~420 documents from 2017 to now, indexed locally with SQLite
FTS5 and Czech-aware matching. See `cz_guidance_search` / `cz_guidance_text`.

ČNB, ÚOHS, ČTÚ, SÚKL and NÚKIB remain uncovered. Each would need its own
fetcher, and none is likely to have a feed as convenient. Build one only when a
matter actually needs it — for IP / AI / GDPR work ÚOOÚ carries most of the
weight.

### 2. ECtHR — cheap and immediate

HUDOC has a working public JSON query API (verified: 95,733 English judgments,
returning ECLI, application number, article, document id). This is the easiest
remaining win — a few hours for search plus full text, no authentication.

### 3. Constitutional Court search

Today `lex` can fetch any ÚS decision by case number but cannot find one by
subject. NALUS is ASP.NET WebForms behind `__VIEWSTATE`, which is scriptable but
brittle. A steadier route is to index ÚS decisions locally the way proposed for
the regulators.

### 4. NSS and the high courts

Same problem as NALUS, plus per-render field numbering. Lowest priority: for the
IP / data-protection / AI work here, NS and ÚS carry most of the doctrine.

### 5. Similarity search

Once anything is indexed locally, `search_similar` is a small addition —
embeddings over the stored text. Worth doing only after (1).

## What is not worth doing

Re-indexing Czech legislation or EU law to match their corpus. We read the
authoritative registries directly, which is strictly better, and duplicating 1.4M
documents would buy nothing except a stale copy.

## If you ever do want their MCP

It is a normal paid connector: add `https://mcp.directcase.ai` as a custom
connector, sign in, consent. Their skills are built for it and the wiring in
`plugins/pravo-skills-cz/` could be pointed back at it by reverting the changes
listed in that plugin's `NOTICE.md`. On the current evidence the only things it
would add over `lex` are the four gaps above — and two of those we can close
ourselves.
