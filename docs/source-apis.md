# Source API notes

Reference for maintaining `mcp-servers/lex`. Everything below was verified against
live responses on 2026-08-23.

## e-Sbírka (Czech Republic)

Public web client: `https://e-sbirka.gov.cz` (Angular SPA; `www.e-sbirka.cz` 308s
to the `.gov.cz` host). Backend base paths are declared in
`https://e-sbirka.gov.cz/assets/configs/env.js`:

| Config key | Base URL | Role |
| --- | --- | --- |
| `dasexApiBasePath` | `https://e-sbirka.gov.cz/sbr-externi` | Collection of Laws — documents, contents, versions, exports |
| `bopApiBasePath` | `https://e-sbirka.gov.cz/sbr-obecne` | general portal data |
| `lesexApiBasePath` | `https://e-sbirka.gov.cz/leg-externi` | e-Legislativa — draft legislation in progress |
| file services | `https://e-sbirka.gov.cz/souborove-sluzby` | generated-file requests and downloads |
| `openDataBasePath` | `https://opendata.eselpoint.gov.cz/esel-esb/{eli}` | linked-data (RDF/Turtle) view of an ELI |

### Addressing

Documents are addressed by `staleUrl`, which must begin with `/` and is passed
URL-encoded as a single path segment:

```
/sb/2000/121                  -> the act, resolves to its version history
/sb/2000/121/2025-07-01       -> one consolidated version
/eli/cz/sb/2000/121/…         -> same thing, ELI-prefixed; both accepted
```

`sb` = Sbírka zákonů, `ms` = Sbírka mezinárodních smluv.

### Endpoints used

```
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/historie          version history
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/id                numeric document id
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/obsah             table of contents
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/dalsi-informace   act subtype, approval date, CzechVoc concepts
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/souvislosti       relations to other acts and to EU law
GET  /sbr-externi/dokumenty-sbirky/{staleUrl}/odkazy-ke-stazeni official PDF references
GET  /sbr-externi/stahni/informativni-zneni/{docId}/{FORMAT}    request an export; FORMAT is UPPERCASE
GET  /souborove-sluzby/verejne-pozadavky-dokumenty/pozadavky/{id}  poll the export
GET  /souborove-sluzby/soubory/{fileId}                         download the result
```

Export formats: `PDF`, `DOCX`, `XML`, `JSON`, `ZIP` (the ZIP bundles all four).
Lowercase format names are rejected. The export is asynchronous: the first call
returns `{pozadavekId, id?, stavPozadavku}`; if `stavPozadavku` is not `OK`, poll
until it is, then download by the returned `id`.

### Document JSON shape

```jsonc
{
  "metadata": { "predpisCislo": "121/2000 Sb.", "castkaCislo": "36/2000", "rocnik": 2000 },
  "fragmenty": [
    { "fragmentId": 4402713, "hloubka": 2, "typ": "Prefix_Title", "xhtml": "o právu autorském…" },
    { "fragmentId": 4402719, "hloubka": 2, "typ": "Cast",         "xhtml": "ČÁST PRVNÍ" },
    { "fragmentId": 4405xxx, "hloubka": 5, "typ": "Paragraf",     "xhtml": "<var>§ 30</var>" }
  ]
}
```

A flat list ordered as printed, with `hloubka` giving nesting depth. A provision
and everything under it is the run from its fragment up to the next fragment whose
`hloubka` is less than or equal to its own.

Fragment types seen: `Virtual_*` (structure only, no text), `Prefix_Number`,
`Prefix_Type`, `Prefix_Title`, `Prefix_Date`, `Prefix`, `Cast`, `Hlava`, `Dil`,
`Oddil`, `Pododdil`, `Paragraf`, `Odstavec_Dc`, `Pismeno_Lb`, `Bod_Dd`,
`Nadpis_nad`, `Nadpis_pod`, `Nadpis`, `Poznamka`, `PPC`, `Block_Citace`,
`Block_Priloha`, `Hlavicka_priloha`, `Postfix`, `Pokracovani_Text`.

Older acts (e.g. 99/1963 Sb.) carry the title in `Prefix_Type` rather than
`Prefix_Title`.

### Relation types (`/souvislosti`)

`MENI` amends · `JE_MENEN` is amended by · `RUSI` repeals · `JE_RUSEN` is repealed
by · `ODKAZUJE` references · `JE_ODKAZOVAN` is referenced by · `JE_PROVADEN` is
implemented by · `UPLNA_ZNENI_REPUBLIKUJE` republished as consolidated text ·
`PRECHODNA_USTANOVENI_ZAVADI` introduces transitional provisions ·
`ODKAZUJE_DO_EU` references EU law · `JE_ODKAZOVAN_Z_EU` referenced from EU law.

### Not wired up

`POST /sbr-externi/jednoducha-vyhledavani/pravni-akt-esbirka` and the autocomplete
variant both require `kontextVyhledavani`, a server-side enum
(`cz.mvcr.esel.esbir.restapi.dasex.dto.KontextVyhledavaniBean`) whose accepted
values are not present in the published web client and are not documented. No
Swagger document is exposed (`/v2/api-docs`, `/v3/api-docs`, `/swagger.json` all
404), despite the API being annotated with Swagger.

A registered REST API also exists — registration goes to the Ministry of the
Interior via data box — which may expose search. Not needed for the current tools.

## CELLAR / EUR-Lex (European Union)

### Content negotiation

```
GET https://publications.europa.eu/resource/celex/{CELEX}
    Accept: application/xhtml+xml | text/html | application/rdf+xml | text/turtle
    Accept-Language: eng | ces | deu | …      (ISO 639-3, lowercase in the header)
```

Returns the official Official Journal text. `application/rdf+xml` on a major act
can exceed 60 MB — use SPARQL for metadata instead.

CELEX sector/type digits: `3` = as adopted (`32016R0679`), `0` = consolidated
(`02016R0679-20160504`, suffix = consolidation date). A consolidated CELEX without
a date suffix does not resolve.

### SPARQL

```
GET https://publications.europa.eu/webapi/rdf/sparql
    ?query=…&format=application/sparql-results%2Bjson
```

Virtuoso, so `bif:contains(?title, "'digital' AND 'services'")` uses the full-text
index — sub-second, versus ~17 s for an equivalent `CONTAINS()` filter.

Two things that cost time to discover:

1. **Language IRIs are uppercase**: `…/authority/language/ENG`, not `/eng`.
   A lowercase code silently returns zero rows.
2. **Ontology property names use hyphens** where you would expect underscores:
   `cdm:resource_legal_in-force`, `cdm:resource_legal_date_entry-into-force`,
   `cdm:resource_legal_date_end-of-validity`. Underscore variants bind nothing.
3. **Resolve the work URI first.** Selecting a work by CELEX literal and joining to
   its expressions in one query returns nothing — the planner mishandles it. Query
   `?work cdm:resource_legal_id_celex "…"^^xsd:string` first, then query the bound
   URI. `lib/eurlex.js` does this in two steps for that reason.

`resource_legal_date_end-of-validity` is `9999-12-31` for acts with no end date.

Useful properties on a work: `resource_legal_id_celex`, `work_date_document`,
`resource_legal_date_entry-into-force`, `resource_legal_date_end-of-validity`,
`resource_legal_in-force`, `resource_legal_eli`,
`resource_legal_based_on_resource_legal`, `resource_legal_amended_by_resource_legal`,
`resource_legal_repealed_by_resource_legal`. Titles live on expressions:
`?exp cdm:expression_belongs_to_work ?work ; cdm:expression_uses_language <…/ENG> ; cdm:expression_title ?title`.

---

## Nejvyšší soud — rozhodnuti.nsoud.cz

A Lotus/HCL Domino application. No documented API; the endpoints below were
derived from its own search form.

### Search

The form at `/` POSTs to `/judikatura/judikatura_ns.nsf/searchRozhodnuti2?createdocument`,
which creates a search document and 302s to a Domino `SearchView` URL. That URL
can be built directly, skipping the POST:

```
GET /Judikatura/judikatura_ns.nsf/$$WebSearch1
    ?SearchView                      <- bare flag; `SearchView=` is rejected
    &Query=<urlencoded Domino query>
    &SearchMax=500&SearchOrder=4&Start=1&Count=20&pohled=1
```

Field mapping, recovered by POSTing one form field at a time and reading the
redirect `Location`:

| Form field | Domino query term |
| --- | --- |
| `text_rozhodnuti` | `[ARozhodnutiRT]=(...)` full text of the decision |
| `pravni_veta` | `[pravni_veta]=(...)` headnote |
| `text_anotace` | `[Anotace]=(...)` |
| `hesla` | `[heslo]="..."` index keyword |
| `ECLI` | `[ecli]="..."` |
| `spzn1..4` | `[spzn1]=` senate, `[spzn2]=` register, `[spzn3]=` number, `[spzn4]=` year |
| `dateod` / `datedo` | `[datum_rozhodnuti]>=..DD.MM.YYYY` / `<=..DD.MM.YYYY` |
| `typ_Rozhodnuti` | `[TypRozhodnuti]=...` |
| `kategorie1` | `[kategorie_rozhodnuti1]=...` (A–E) |

Terms are joined with ` AND `. Values are not quoted, so strip `(`, `)`, `"`, `[`, `]`.

Results are HTML. Each result row carries the document UNID three times; the
reliable anchor is `href=".../WebSearch/{32-hex-UNID}?openDocument"`, with the
case number as the link text, the court in `td-short-wrap` and the category in
`td-short category`. The total is in `Výsledky N - M z TOTAL zobrazovaných dokumentů`.

**`Count` must be at least 5.** With `Count` of 1–4 Domino answers HTTP 500 with
`HCL Notes Exception - Field is too large (32K) or View's column & selection
formulas are too large` — a misleading message for what is really an
out-of-range page size. `Count=5` and above always work.

This cost a long debugging session and produced a wrong diagnosis along the way.
Probes that alternated between `Count=3` and `Count=20` looked exactly like an
intermittently failing server, and plain `curl` "confirmed" it because the curl
commands happened to use `Count=5`. `SearchMax` and `Start` are irrelevant —
both were suspected and both were cleared by controlled tests. The client now
asks for `max(limit, 5)` and trims locally.

**`Start` is 1-based**, with 0 treated as 1. The next page is `start + limit`.

### Documents

```
GET /Judikatura/judikatura_ns.nsf/WebPrint/{UNID}?openDocument   full text + header
GET /Judikatura/judikatura_ns.nsf/WebSearch/{UNID}?openDocument  the same, framed
GET /Judikatura/att.nsf/at/{ATT_UNID}/$file/{name}.pdf?openElement
```

`WebPrint` opens with a labelled header block — Soud, Datum rozhodnutí, Spisová
značka, ECLI, Typ rozhodnutí, Heslo, Dotčené předpisy, Kategorie rozhodnutí —
before the decision text. Note `Datum rozhodnutí` is rendered `MM/DD/YYYY`.

There is also a plain view enumeration, useful for sanity checks:
`GET /judikatura/judikatura_ns.nsf/WebSearch?ReadViewEntries&OutputFormat=JSON&start=&count=`
returns `@toplevelentries` (164,535 at the time of writing) with UNID and case
number per row. `OutputFormat=JSON` is ignored on `$$WebSearch1`.

## Ústavní soud — nalus.usoud.cz

Decision text is a plain GET (the search itself *is* scriptable — see the NALUS
section at the end of this file):

```
GET /Search/GetText.aspx?sz={panel}-{number}-{yy}
```

`panel` is `1`–`4` for the senates or `Pl` for the plenary (case-insensitive),
`yy` the two-digit year. `I. ÚS 1234/21` → `1-1234-21`; `Pl. ÚS 19/14` → `Pl-19-14`.

A miss still returns HTTP 200 with a near-empty page, so treat a body under
~1,200 characters of extracted text as "not found" rather than trusting the status.

## District and regional courts — rozhodnuti.justice.cz

The Ministry of Justice's published open-data API.

```
GET /api/opendata                       years available, with counts
GET /api/opendata/{year}/{month}/{day}?pageNumber=&pageSize=
GET /api/finaldoc/{uuid}                anonymised full text, JSON
```

Day payloads are `{items, numberOfItems, pageSize, pageNumber, totalPages, totalElements}`.
Each item carries `jednaciCislo`, `soud`, `autor`, `ecli`, `predmetRizeni`,
`datumVydani`, `datumZverejneni`, `klicovaSlova[]`, `zminenaUstanoveni[]` (the
provisions the decision cites) and `odkaz` → the `finaldoc` URL.

**The index is by publication date only.** There is no keyword or subject query,
so any topical search means walking days and filtering client-side. A day with
nothing published errors rather than returning an empty list.

`finaldoc` returns sectioned blocks (`header`, and further sections per document)
of `{texts:[{text, anonStyle}], styleLo...}` — concatenate `texts[].text` per block.

## ARES — ares.gov.cz

Ministry of Finance register of economic entities. Public, unauthenticated.

```
POST /ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat
     {"obchodniJmeno": "...", "ico": ["..."], "sidlo": {"nazevObce": "..."}, "start": 0, "pocet": 10}
GET  /ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/{ico}      merged identity
GET  /ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/{ico}   Commercial Register
```

The `-vr` record is `{icoId, zaznamy[]}`; take the entry with `primarniZaznam`.
Its fields are **historical arrays** — every value has `datumZapisu` and, once
superseded, `datumVymazu`. Filter out anything with a `datumVymazu` or you will
report struck-out directors as current. Exceptions: `datumZapisu` and
`stavSubjektu` on the record itself are plain strings, not arrays.

Where the useful values live:

| Value | Path |
| --- | --- |
| Name | `obchodniJmeno[].hodnota` |
| File number | `spisovaZnacka[]` → `{soud, oddil, vlozka}`; `soud` is a code (`MSPH` = Městský soud v Praze) |
| Registered capital | `zakladniKapital[]` where `typJmeni == "ZAKLADNI_JMENI"` → `vklad.hodnota` |
| **How the company must be represented** | `statutarniOrgany[].zpusobJednani[].hodnota` |
| Officers | `statutarniOrgany[].clenoveOrganu[]` → `fyzickaOsoba.{jmeno,prijmeni}`, `clenstvi.funkce.nazev`, `clenstvi.clenstvi.vznikClenstvi` |

Money is formatted `"2604000;00"` — a **semicolon** decimal separator.

`/api-docs/...` paths 404; there is no published OpenAPI document at the version
strings the developer page suggests.

## Nejvyšší správní soud — vyhledavac.nssoud.cz

ASP.NET Core MVC, **now automated** (`lib/nss.js`). It covers NSS *and* the
regional courts sitting in their administrative agenda, which no other source
here reaches.

A query is a form replay: `GET /` for the form and its session cookie, carry
every control forward, set the ones you want, `POST /` back with `btSubmit`.
The form needs `__RequestVerificationToken` and its matching cookie, so the GET
must not be served from cache.

**Do not key anything on the control names.** They are index paths generated per
render (`vyhledavaciSekce[2].vyhledavaciPodminka[1].vyhledavaciPodminkaHodnota[4].…`)
and adding one criterion renumbers the rest. Every value control has a
`TechnickyNazev` hidden input beside it holding a stable identifier; discover the
index path from that at query time. The identifiers in use:

| `TechnickyNazev` | Criterion |
| --- | --- |
| `soudsenat` | court / senate (tree) |
| `oznacenivecivcelku` | case number |
| `oznacenivecidelenerejstrikovaznacka` | register (A, As, Afs, Azs …) (tree) |
| `datumvydanirozhodnuti` | date of decision (`HodnotaDatumACasOd` / `…Do`, `DD.MM.YYYY`) |
| `aktualizovano` | date released |
| `oblastupravy` | **subject area — the court's controlled vocabulary** (tree) |
| `aplikovanepravnipredpisysb§`, `…odst`, `…pism`, `…cl` | provision applied |
| `aplikovanepravnipredpisysbpredpis` | zákona / nařízení / vyhlášky (tree) |
| `aplikovanepravnipredpisysbcislo`, `…rok` | act number and year |
| `textDokumentu` | full text; **the engine lemmatises Czech**, so pass the base form |

**Tree-valued controls bind through a companion field, not the visible one.**
The visible input holds the labels and is ignored; the server reads
`<control name>Selected`, a comma-separated list of numeric ids. The ids come
from the `ciselnikTreeData` sibling control, a JS object literal (unquoted keys,
so not JSON) of `{id,title,subs}`. **Selecting a parent does not cascade**:
submitting the id of `krajské soudy` alone matches nothing, so a parent must be
submitted as itself plus every descendant id.

Failure modes worth knowing:

- A rejected criterion re-renders the form with **HTTP 200 and no result count**
  rather than an error. Absence of `Počet nalezených záznamů: N` is the signal.
- `GET /DokumentDetail/Index/{id}` for an unknown id returns **200 and a
  well-formed empty page**, not a 404. Detect absence from the content.
- Results: 40 rows per page, each carrying its document id in
  `ZobrazeneVysledky[i].ID`, and the official citation string in the copy
  button's `title` (`Citace: rozsudek Nejvyššího správního soudu ze dne …`).
  Read the columns by their `<th>` heading, not by cell index: which columns
  appear depends on the result-view selected.
- Paging is `POST /Home/MyResTRowsCont` with `vyhledavaciPodminky`,
  `zobrazeniVysledkuId`, `pageNum`, `resultOrder` (from the page's own
  `currParams` / `currSort` variables).

Documents:

| Path | Serves |
| --- | --- |
| `/DokumentDetail/Index/{id}` | the record: ECLI, rapporteur, **Sb NSS published (the weight indicator)**, subject area, provisions applied, prejudikatura with its treatment, parties and roles, the administrative decision challenged, the regional judgment under cassation. All as HTML tables, best read by header row. |
| `/DokumentOriginal/Text/{id}` | plain text — **UTF-16LE**, with the charset only in the Content-Type header. Sniff the BOM or the NUL-interleaving; do not trust a cached header. |
| `/DokumentOriginal/Html/{id}` | the same document as UTF-8 HTML |

## MŽP — mzp.gov.cz

The Ministry of the Environment. Drupal 10 behind the gov.cz design system. No
JSON:API (`/jsonapi` 404s), but everything needed is public:

- `GET /cz/sitemap.xml` — 1,624 content URLs. Note `/sitemap.xml` at the root
  redirects to the `/cz/` one. Sections that matter: `/cz/agenda/…` (the
  ministry's standing position per area), `/cz/ministerstvo/metodicke-dokumenty`,
  `/cz/ministerstvo/legislativa`, and `/cz/pro-media-a-verejnost/katalog-sluzeb`
  (826 procedural descriptions, opt-in).
- The **Věstník MŽP** is a Drupal view with an exposed year filter that works as
  a plain query parameter:
  `GET /cz/pro-media-a-verejnost/vestnik?field_journal_year_value_fsf=2025`.
  Years offered: 2026 back to 2017, then 2003–1998 and 1995. Issues are PDFs
  under `/system/files/YYYY-MM/`. **Věstníky before 2017 live in a separate
  legacy database** the page links to and are not covered.
- Methodological instructions are PDF attachments on content pages.

`robots.txt` sets `Crawl-delay: 10` for the wildcard agent and disallows
`/search/`. The indexer reads the delay from robots.txt rather than hardcoding
it, which makes a full build a few hours; it is resumable, recording every URL
visited. PDF text comes from `pdftotext`, and the index records whether it was
available so search results can say when files matched on title alone.

## ÚOOÚ — uoou.gov.cz

The Czech data protection authority. No documented API, but the site (a Laravel
CMS with Vue components) exposes a public JSON feed that the news listing itself
consumes:

```
GET /api/articles           every article, with full body — one request
GET /api/articles/{id}      a single article
```

The collection response is `{"data": [...]}` with no pagination — roughly 460
items and about 2.3 MB at the time of writing. Per item:

| Field | Meaning |
| --- | --- |
| `id`, `title`, `url` | identity and slug |
| `perex` | abstract shown in listings |
| `text` | **full HTML body** |
| `publish_at`, `updated_at` | ISO timestamps |
| `full_url` | canonical absolute URL |
| `flag_id` | section: 1 news/opinions, 6 publications, 7 press releases, 8 English news, 10 photo galleries |

Two things to handle when indexing:

- **Flag 7 duplicates flag 1.** The same item is published as a news article and
  as a press release, sometimes a day apart, so a same-title-same-date key misses
  them. Deduplicate on normalised title within a ~7-day window; a genuine
  re-issue years later (it happens) is a different document and should be kept.
- **Titles contain non-breaking spaces.** Normalise with NFC and collapse
  whitespace before using the title as a key, or near-identical pairs survive.

Article URLs resolve at both `/{slug}` and `/novinky/vse/{slug}`. Article pages
carry `article:published_time` in a meta tag and breadcrumbs of
`Úvod › Novinky › Článek` — everything substantive is an "article", including
the formal opinions.

A handful of standing explanatory pages are **not** in the feed and have to be
fetched directly: `/pravni-ramec/*` and `/cinnost/*`. Their body sits inside
`id="mainblock"`. There is no `/api/pages`.

`/cs/sitemap` exists but is partial — 388 slugs against the feed's 460 — and its
anchors are relative with no leading slash. Use the feed, not the sitemap.

### Searching Czech text locally

The mirror uses SQLite FTS5 (`node:sqlite`, no native dependency) with
`tokenize='unicode61 remove_diacritics 2'`. Two things were necessary to make
Czech queries work:

- **Stem before prefix-matching.** Czech inflection changes the stem ending, so
  `"pokuta"*` does not match "pokuty". Clipping the last 2–3 characters before
  the prefix wildcard fixes recall; precision comes back from requiring several
  terms to match.
- **Drop function words.** Left in, `"za"*` and `"pro"*` match most of the corpus
  and dominate the ranking.

AND across terms first; only if that returns nothing, fall back to OR and keep
documents covering at least half the query terms.

## NALUS (Ústavní soud) — driving the WebForms search

`nalus.usoud.cz` has no API. The search is classic ASP.NET WebForms and can be
driven, but only if the form is replayed *complete*.

```
GET  /Search/Search.aspx          -> ASP.NET_SessionId cookie, __VIEWSTATE,
                                     __EVENTVALIDATION and ~45 form fields
POST /Search/Search.aspx          -> all of them back, criteria overridden,
                                     plus ctl00$MainContent$but_search=Vyhledat
GET  /Search/Results.aspx?page=N  -> results; 0-based paging, session-held
```

What made the difference, after several failed attempts:

- **Send every field, not just `__VIEWSTATE` and a search term.** A minimal post
  returns "Nebyly nalezeny žádné záznamy", which reads as zero results rather
  than a malformed request. The decisive fields are the decision-form checkboxes
  (`nalezy`, `usneseni`, `stanoviska_plena`) — they select which kinds of
  decision are searched at all, and omitting them searches nothing.
- **Keep the session cookie.** Results live in session state, which is why
  `Results.aspx` can be paged with a plain GET afterwards.
- **Include the clicked button by name.** `__EVENTTARGET` alone did not fire it.

Only some criteria actually execute: `text` (full decision text), `ecli`,
`citace` (case number) and the four date ranges. The other tempting fields —
`klicove_slovo`, `predmet_rizeni`, `vztah_k_predpisum`, `pravni_veta`,
`oduvodneni`, `abstrakt`, `soudce_zpravodaj` — are `readonly` inputs driven by
JavaScript picker popups, and posting text into them silently returns nothing.
`text` covers the same ground, since it searches the whole decision.

### Result rows

Each result renders as **two** `<tr class='resultData0|1'>` elements — one holds
the identity and data cells, the other the action icons with the `GetText` link,
and which is which is not stable. Parse them in pairs. Per result:
case number, ECLI, rapporteur, party and subject of proceedings, three dates,
the provisions relied on, form (Nález/Usnesení) with significance, and outcome.
The permalink is `GetText.aspx?sz={panel}-{number}-{yy}`.

### The subject vocabulary

`/dialogs/PopupCiselnikTree.aspx?type=klicove_slovo` returns the court's own
subject index — about 500 controlled Czech terms — as a TreeView. **It requires
the session cookie**; without one it returns a 61 KB stub instead of the 389 KB
tree, and the difference is easy to miss because both are HTTP 200. The picker
cannot be driven from outside the browser, but the vocabulary itself is the
useful part: it is the wording the court uses, which is what a full-text query
should contain.

## Lower courts — building a subject index

`rozhodnuti.justice.cz/api/opendata/{y}/{m}/{d}` is keyed by publication date
with no subject query, so subject search needs a local mirror. Volume is about
**280 decisions per publication day across four API calls**; 2025-01-01 to
2026-08-24 came to 41,108 decisions from 1,541 calls in under three minutes.

Only metadata is stored — ECLI, case number, court, subject of proceedings,
index keywords, provisions cited. Full text stays remote and is fetched on
demand. Days already fetched are recorded so the build is resumable and the
range can be widened later without refetching.

Watch for junk dates in the feed: the indexed range contains a decision dated
2055-08-26, which is a typo at source rather than a parsing error.

## e-Sbírka concept schemes — not yet usable

`POST /sbr-externi/koncepty/schema-konceptu/{VECNYREJ|POJMREJ}/vyhledavani`
returns Czech legal thesauri — 324 subject concepts and **14,584 defined legal
terms**, which would be an excellent controlled vocabulary for query building.
The `dotaz` field is ignored: every query returns the same top-level tree, so
the search parameter name is something else. The tree could instead be walked
via `/czechvoc-rejstriky/{schema}/{parentKey}`. Worth returning to.

## CJEU — why CELLAR and not curia.europa.eu

`curia.europa.eu` publishes the Court's own case database, but it has no API. The
search is a JavaServer Faces application behind view state, in the same class of
fragility as NALUS, and scraping it would buy nothing: every judgment, Advocate
General Opinion and order is in CELLAR with a CELEX number and full text in all
official languages. The tools therefore query CELLAR and link out to curia for
the reader.

### CELEX for case law

Sector 6, then the year, then a two-letter document type, then the case number
padded to four digits:

```
6 2018 CJ 0311      Case C-311/18, judgment of the Court of Justice
6 2018 CC 0311      the Advocate General's Opinion in the same case
6 2018 TJ 0604      Case T-604/18, judgment of the General Court
6 1964 CJ 0006      Case C-6/64
```

**The year is the year the case was lodged, not the year it was decided.** Case
C-311/18 was decided in 2020 and its CELEX still begins 62018. Getting this wrong
produces a confident lookup of the wrong case or a spurious "not found".

Document types seen: `CJ` and `TJ` judgments, `CC` Opinion of the Advocate
General, `CO` and `TO` orders, `CV` Opinion of the Court, `CN` the notice of a
request for a preliminary ruling, `CA` and `TA` the Official Journal summary.
Two-digit years are resolved against the current year: at or below the current
last two digits means 20xx, above it means 19xx.

### Deduplication

A single case yields several CELEX records, and a search returns all of them.
Besides the document types above, CELLAR publishes suffixed variants such as
`_RES` (restatement) and `_INF` (information). Strip any `_[A-Z]+` suffix, group
by year plus case number, and keep the most substantive type, otherwise a search
for one case returns four rows that look like four cases.
