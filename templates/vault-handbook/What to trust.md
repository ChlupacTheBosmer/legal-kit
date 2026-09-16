---
title: What to trust
type: handbook
status: verified
tags: []
created: 2026-08-24
updated: 2026-08-24
---

# What to trust, and what to take with a pinch of salt

The sources are not equally reliable, and neither are the different kinds of
answer. This page tells you which is which.

## Trust almost completely

**The text of a Czech act.** It comes from e-Sbírka, which since 1 January 2024
*is* the legally binding publication. If the project quotes a section, that is
what the section says. It also tells you which version — Czech acts change often,
and "in force from 2025-07-01" is part of the citation, not decoration.

**The text of an EU regulation or directive.** From EUR-Lex, the EU's own
publisher. The tool now works out whether the act has been amended and quotes the
consolidated (up-to-date) version, telling you which one it used.

**Company details from ARES.** Name, IČO, registered seat, and — the useful part
— *how the company must be represented when signing*. If it says two board
members must sign together, that is the register speaking.

## Trust, but read the decision yourself

**Court decisions.** The project finds them reliably. Whether a decision actually
*supports* the point is a separate question, and the search cannot judge that.

Weight them like this:

- **Supreme Court, category A** — published in the official collection. The
  strongest thing short of legislation. B, C, D, E descend from there; E is
  routine.
- **Constitutional Court *nález*** — a decision on the merits. Binds.
- **Constitutional Court *usnesení*** — usually a rejection on procedural
  grounds. It tells you almost nothing about the substance. Do not let one be
  cited to you as authority for a legal proposition.
- **Nejvyšší správní soud, published in the Sbírka rozhodnutí NSS** — the
  administrative-law counterpart of Supreme Court category A, and the strongest
  weight an NSS decision carries. `cz_nss_case` reports it per decision. A
  decision of the *rozšířený senát* (extended chamber) settles a conflict
  between three-judge chambers and outranks them.
- **Regional courts in their administrative agenda** — first-instance judgments
  on the review of administrative decisions. `cz_nss_case` names the cassation
  outcome, so check whether NSS set the judgment aside before relying on it.
- **District and regional courts (civil and criminal)** — one judge's view, often
  reversed on appeal. Useful as a signal about what happens in practice. Never
  authority.

## Take with a pinch of salt

**Search results on a niche topic.** The court databases search words, not
meaning. On a specialised subject the words may appear in decisions about
something else entirely. I tested this: a search for text-and-data-mining terms
returned six Constitutional Court decisions, and the top one was about police
powers — the words appeared incidentally. **A hit count is not a finding.**
Anything cited to you should have been read.

**Regulator guidance (ÚOOÚ).** This is the data-protection authority's *opinion*.
It is very useful — for GDPR it often settles a question in practice, because
it tells you how the regulator will approach it. But it is **not binding law**
and a court can disagree with it. Always look at the date; guidance goes stale.

**Regulator guidance (MŽP).** A *metodický pokyn* of the Ministry of the
Environment is the ministry's opinion. It binds subordinate authorities
administratively, which makes it a very good predictor of what an authority will
do, but it is **not law** and a court may depart from it. The **Věstník MŽP** is
a different thing and should not be lumped in with it: the ministry publishes
resort instruments there and publication is a condition of their validity, so the
Věstník is how you check whether an instrument is in force at all.

**An empty result from a search that was pointed at the wrong court system.**
Czech environmental, tax and building disputes are administrative law, decided by
the administrative courts. `cz_case_lower_search` holds no administrative justice
whatsoever, so a well-formed Czech query about permits returns zero rows there
and the zero means nothing. `cz_nss_search` is the tool for that whole body.

**Anything about the future.** New rules with no case law yet — much of the AI
Act, the newer copyright exceptions — can be quoted but not predicted.

## Do not trust without checking

**Anything the AI says without quoting a source.** If there is no quoted text and
no link, treat it as memory, which is exactly what this project exists to avoid.

**The Czech legal workflows plugin** (`pravo-skills-cz`). Nine Czech workflows for
contract review, NDA triage and so on. The *structure* is good. The legal content
inside was written by a third party and **has not been checked provision by
provision**. Treat its output as a form to fill in, and check anything it asserts.

**The US-to-Czech correction notes** (`docs/jurisdiction-overlay.md`). Useful, and
every provision in it was read from the registry — but a review still found two
substantive errors in it, which are now fixed and flagged at the top of that file.
That is the honest state of it: carefully made, and still capable of being wrong.
Check the pinpoint citation before relying on a row.

## Known gaps

- **Supreme Administrative Court** — not covered at all. Tax, and most disputes
  with public authorities, end up there. Must be searched by hand.
- **Lower courts before 2025** — not indexed unless we extend it.
- **Other regulators** — the central bank, competition authority, telecoms and
  medicines regulators publish guidance that is not covered.
- **Commentary and textbooks** — not covered. The project reads primary sources;
  it does not read what academics say about them.

## The failure to watch for

The most dangerous wrong answer is **"there is no case law on this"** when what
actually happened is that the search used the wrong Czech words. The project
guards against it — Czech sources refuse English queries, and answers are
supposed to list the Czech search terms used. If an answer says nothing was
found, look at the terms it searched. If they look wrong, say so.
