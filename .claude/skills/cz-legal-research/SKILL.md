---
name: cz-legal-research
description: Search Czech legal sources — case law (Supreme, Constitutional, Supreme Administrative, regional and district courts), ÚOOÚ and MŽP regulator guidance, legislation — when the question is asked in English but the sources are Czech. Use whenever a question needs Czech case law, regulator guidance, or "what do the Czech courts say about X".
---

# Searching Czech sources from an English question

The thinking here happens in English. Every Czech source indexes Czech words. An
English query returns nothing, and **nothing looks exactly like "there is no such
case law"** — which is the most dangerous wrong answer this project can produce.

This skill is the procedure that stops that.

## 1. Never search a Czech source with an English string

`cz_guidance_search`, `cz_mzp_search`, `cz_case_lower_search`, `cz_us_search`,
`cz_case_search` and `cz_nss_search` all search Czech text. The tools reject
obviously English queries, but the guard is a backstop, not the method, on two
counts. A query can be Czech-shaped and still be the wrong Czech. And the guard
works from a list of English words, so it only catches the subjects that list
covers: it once passed "environmental impact assessment" straight through
because the list had been written for privacy and intellectual-property work.
If you add a practice area, extend `EN_MARKERS` in `lib/czsearch.js`.

## 2. Build the Czech query deliberately, not by translation

Translating the English phrase gives one guess. Do this instead:

1. **Name the legal concept**, not the everyday phrase. "Can my employer film
   me?" is a question about *kamerový systém na pracovišti* and *ochrana
   soukromí zaměstnance*, not about "filming".
2. **Take the term from a controlled vocabulary where one exists.**
   - `cz_us_keywords` — the Constitutional Court's own subject index, ~500 terms.
     Filter it (`cz_us_keywords filter="autor"`) and use the term it gives.
   - `cz_nss_areas` — the Supreme Administrative Court's subject index, 81
     terms. **This is the vocabulary for anything administrative**, environmental
     included: *Životní prostředí - ochrana přírody a krajiny*, *Životní
     prostředí - odpady*, *Životní prostředí - ostatní*, *Vodní právo*,
     *Stavební zákon*, *Právo na informace*. Passing the term is exact: the tool
     refuses an unrecognised one rather than searching for nothing.
   - Czech acts define their own terms: `cz_act_toc` on the governing act shows
     the statutory headings, which is the wording courts quote.
3. **Write three to five variants**, not one. Czech legal writing varies:
   - the statutory term (*zaměstnanecké dílo*)
   - the everyday term (*dílo vytvořené zaměstnancem*)
   - the neighbouring concept (*výkon majetkových práv*)
   - the provision itself (`provision: "121/2000"` where the tool supports it)
4. **Keep queries short, and establish a baseline before narrowing.** The
   indexes AND the terms together, so every extra word is a filter. Some sources
   match exact surface forms rather than stems: `cz_us_search` returns 1,686
   decisions for *životní prostředí* and **zero** for *životní prostředí
   posuzování vlivů*. Start with one or two content words in the base form,
   note the count, then narrow. Quote both counts in the answer, so that a zero
   is visibly the result of narrowing rather than an absence of authority.
5. **Know which engines lemmatise and which do not.** `cz_nss_search` goes to
   the court's own engine, which expands Czech inflection itself — pass
   *kácení dřevin* and it matches every declined form, so do not enumerate
   them. The local indexes (`cz_guidance_search`, `cz_mzp_search`,
   `cz_case_lower_search`) stem on the query side instead, which is looser.
   `cz_us_search` and `cz_case_search` do neither.

## 3. Search every source that could hold the answer

A GDPR question is not answered by case law alone, and a copyright question is
not answered by the statute alone.

| Source | Tool | What it is worth |
| --- | --- | --- |
| Statute | `cz_act_text`, `legal_cite` | the rule. Always the starting point |
| ÚOOÚ guidance | `cz_guidance_search` | for GDPR, usually what settles it in practice |
| Supreme Court | `cz_case_search` | binding interpretation in **civil and criminal** matters; category A is strongest |
| Constitutional Court | `cz_us_search` | constitutional limits; *nález* binds, *usnesení* rarely matters |
| **Supreme Administrative Court and the regional administrative senates** | `cz_nss_search` | **the whole of administrative law**, so environmental, tax, building, asylum, procurement |
| Lower courts (civil and criminal only) | `cz_case_lower_search` | how it actually plays out; persuasive at most |
| ÚOOÚ guidance | `cz_guidance_search` | for GDPR, usually what settles it in practice |
| MŽP guidance and Věstník | `cz_mzp_search` | for environmental questions, usually what settles it in practice; the Věstník also tells you whether a resort instrument is in force |
| EU law | `eu_act_text`, `eu_celex_lookup` | where the Czech rule is a transposition |

### Pick the right court system before you search

Czech law splits into two court systems and searching the wrong one returns a
confident nothing. **If the dispute is with a public authority about a decision,
a permit, a stanovisko, an inspection, a penalty, or standing to challenge any of
them, it is administrative and it is in `cz_nss_search`.** Czech environmental
law is administrative almost throughout. `cz_case_lower_search` holds the
Ministry of Justice feed, which carries the ordinary courts' civil and criminal
dockets and **no administrative justice at all**; a perfectly phrased Czech query
about waste permits returns zero rows there, and that zero means nothing.

## 4. Report what you searched, not just what you found

Every answer that relies on a search states:

- the **Czech queries actually run** — so a wrong term is visible and correctable;
- which **sources were searched**, and which were not;
- **coverage limits**: `cz_case_lower_search` is limited both by indexed date
  range and by agenda (no administrative justice); `cz_guidance_search` and
  `cz_mzp_search` are only as fresh as the last index build, and `cz_mzp_search`
  also reports how many documents have no extractable text. The tools print all
  of this. Pass it on rather than swallowing it.

An empty result is reported as *"these Czech queries against these sources found
nothing"* — never as *"there is no case law on this"*. Those are different
claims, and only the first one is supported.

## 5. Weight the results honestly

- **Supreme Court, category A** — published in the official collection, strongest.
  B–E descend.
- **Constitutional Court *nález*** — decides the merits and binds. A *usnesení*
  is usually a rejection on admissibility and says little about the substance.
- **Lower courts** — one judge's view, frequently reversed. Useful as a signal
  about practice, never as authority.
- **NSS** — binding interpretation for administrative law. Publication in the
  **Sbírka rozhodnutí NSS** is the weight indicator, the counterpart of the
  Supreme Court's category A; `cz_nss_case` reports it per decision, along with
  whether the decision has a formulated *právní věta*. A decision of the
  **rozšířený senát** (extended chamber) settles a conflict between three-judge
  chambers and outranks them.
- **Regional courts in `cz_nss_search`** — first-instance administrative
  judgments. Check `cz_nss_case`: it names the cassation outcome, so you can see
  whether NSS upheld or set the judgment aside before relying on it.
- **ÚOOÚ guidance** — the regulator's interpretation. Persuasive, not binding;
  a court can depart from it. Always date it.
- **MŽP metodický pokyn** — the ministry's interpretation. It binds subordinate
  authorities administratively and is not law; a court may depart from it. The
  **Věstník** is different in kind: publication there is a condition of validity
  for the resort instruments it carries, so cite the issue and year.

## 6. Then verify the citation

Anything that reaches a document or an answer goes through `legal_cite`, which
returns the wording the provision actually has. A case number found in a search
is not a verified citation until its text has been read.

## Worked example — administrative and environmental

> *"Can a conservation NGO challenge a permit to fell trees, and on what basis?"*

1. **Court system first.** A permit issued by a public authority, challenged by
   a third party: administrative. So `cz_nss_search`, not `cz_case_lower_search`.
2. **Vocabulary:** `cz_nss_areas filter="životní"` → *Životní prostředí - ochrana
   přírody a krajiny*. The concept is *účastenství spolku* / *žalobní
   legitimace*, and the statutory hook is § 70 of Act No. 114/1992 Coll.
3. **Statute first:** `legal_cite "§ 70 114/1992"` — read the wording before
   assuming what it grants.
4. **Case law by the provision applied**, which is more precise than words:
   `cz_nss_search provision={section:"70", number:114, year:1992}` → 160
   decisions. Narrow with `area` or a date range.
5. **Then by text**, in the base form: `cz_nss_search text="kácení dřevin"`,
   `text="závazné stanovisko"`, `text="žalobní legitimace spolku"`.
6. **Weight:** `cz_nss_case` on each candidate. Is it in the Sbírka rozhodnutí
   NSS? Is it a *rozšířený senát* decision? What did it do with the regional
   judgment below?
7. **Regulator practice:** `cz_mzp_search query="kácení dřevin náhradní výsadba"`
   for the ministry's methodological position, cited as its position and dated.
8. **EU layer:** the Habitats and Birds Directives and the Aarhus Convention run
   underneath § 70; `cz_act_relations number=114 year=1992 type="ODKAZUJE_DO_EU"`
   lists what the act transposes, and `eu_case_search` gives the CJEU line on
   access to justice in environmental matters.
9. **Report** the Czech queries run, the counts, and the coverage limits.

## Worked example — copyright

> *"Does an employer own the copyright in software written by an employee?"*

1. Concept: **zaměstnanecké dílo**, statutory basis § 58 autorského zákona.
2. Vocabulary check: `cz_us_keywords filter="autor"` → *autorské dílo*, *autorské právo*.
3. Statute first: `legal_cite "§ 58 121/2000"` — read what it actually says.
4. Case law, several variants:
   - `cz_case_search keyword="Autorské právo"` (the court's index term)
   - `cz_case_search text="zaměstnanecké dílo"`
   - `cz_case_search text="výkon majetkových práv autorských"`
5. Constitutional angle only if a fundamental right is engaged.
6. Report: the statute, the cases found, the queries used, and that Czech law
   has no work-made-for-hire — the employer *exercises* the economic rights, it
   does not become the author.
