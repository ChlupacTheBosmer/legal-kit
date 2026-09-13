---
title: Researching Czech environmental law
type: playbook
jurisdiction: [CZ, EU]
status: verified
tags: [env/general, procedure]
created: 2026-09-13
updated: 2026-09-13
sources_checked: 2026-09-13
---

# Researching Czech environmental law

## In one line

Czech environmental law is administrative law, so the case law is in
`cz_nss_search` and not in the tools that serve the ordinary courts, and the
ministry's guidance in `cz_mzp_search` often decides the question before the
statute does.

## Step 0: pick the court system before you search anything

This is the step that goes wrong, and it goes wrong silently.

Czech justice splits in two. The ordinary courts (okresní, krajské, vrchní,
Nejvyšší soud) decide civil and criminal matters. The administrative courts
(krajské soudy in their administrative senates, then Nejvyšší správní soud on
cassation) review the acts of public authorities. **Almost every environmental
question is in the second system**: a permit, a závazné stanovisko, an EIA
opinion, an inspection, a penalty, or standing to challenge any of them.

| If the question is | Search | Do not rely on |
| --- | --- | --- |
| Review of a permit, stanovisko, penalty, inspection, or standing to challenge one | `cz_nss_search` | `cz_case_lower_search`, which holds no administrative justice at all |
| Criminal liability for environmental harm (§§ 293 to 296 of Act No. 40/2009 Coll., trestní zákoník) | `cz_case_search` (the Tdo docket) | — |
| Private-law damages, nuisance between neighbours, ecological damage claims between private parties | `cz_case_search`, `cz_case_lower_search` | — |
| Constitutionality, property rights against conservation restrictions | `cz_us_search` | — |
| The EU layer: EIA, habitats, waste, water, access to justice | `eu_case_search` | — |

`cz_case_lower_search` prints the registers it actually holds. They are C, Co
and Cmo, which are civil. A perfectly phrased Czech query about waste permits
returns zero rows there, and that zero is an artefact of the source, not a
finding about Czech law.

## Step 1: the statute, time-versioned

Czech environmental acts are amended several times a year, and 2023 to 2025 was
a period of unusually heavy change (the new stavební zákon, the jednotné
environmentální stanovisko, the recast waste regime). Run `cz_act_versions`
before quoting anything, and `legal_cite` with `as_of` whenever the facts are
historical.

The acts that come up most:

| Act | Short name | Covers |
| --- | --- | --- |
| Act No. 17/1992 Coll., o životním prostředí | — | the framework definitions and principles |
| Act No. 114/1992 Coll., o ochraně přírody a krajiny | ZOPK | nature and landscape protection, Natura 2000, tree felling, species protection |
| Act No. 100/2001 Coll., o posuzování vlivů na životní prostředí | EIA | environmental impact assessment and strategic environmental assessment |
| Act No. 148/2023 Coll., o jednotném environmentálním stanovisku | JES | the single environmental opinion that replaced a stack of separate ones |
| Act No. 254/2001 Coll., o vodách | vodní zákon | water |
| Act No. 541/2020 Coll., o odpadech | — | waste |
| Act No. 201/2012 Coll., o ochraně ovzduší | — | air |
| Act No. 76/2002 Coll., o integrované prevenci | IPPC | integrated permitting |
| Act No. 167/2008 Coll., o předcházení ekologické újmě | — | environmental liability, transposing Directive 2004/35/EC |
| Act No. 123/1998 Coll., o právu na informace o životním prostředí | — | access to environmental information, the first Aarhus pillar |
| Act No. 150/2002 Coll., soudní řád správní | SŘS | the procedure for all of the above |

All are reachable by alias: `legal_cite "§ 70 zopk"`, `cz_act_text` with
`zakon o odpadech`, and so on.

## Step 2: what the act transposes

Most of this body is transposed EU law, and the Czech provision is often only
intelligible against the directive behind it.

```
cz_act_relations number=100 year=2001 type="ODKAZUJE_DO_EU"
```

returns the EU instruments the act points to, each with its CELEX and EUR-Lex
link. For Act No. 100/2001 Coll. that is Directive 85/337/EEC and its amendment
97/11/EC, Directive 2001/42/ES on plans and programmes, and three energy
instruments.

## Step 3: the case law, by the provision rather than by words

`cz_nss_search` will filter on the provision a decision actually applied, which
is far more precise than matching words in the text:

```
cz_nss_search provision={section:"70", number:114, year:1992}
cz_nss_search area="Životní prostředí - ochrana přírody a krajiny" text="biotop"
cz_nss_search court="krajské soudy" area="Vodní právo"
```

Take the subject term from `cz_nss_areas`, which is the court's own vocabulary.
The environmental terms are *Životní prostředí - ochrana přírody a krajiny*,
*Životní prostředí - odpady*, *Životní prostředí - ostatní*, plus *Vodní právo*,
*Stavební zákon*, *Právo na informace* and *Zemědělství, myslivost a rybářství*.

The court's full-text engine lemmatises Czech, so pass the base form
(*kácení dřevin*) and it matches every inflected form. Do not enumerate them.

## Step 4: weigh what you found

`cz_nss_case` on any candidate returns the things that decide its weight:

- **Published in the Sbírka rozhodnutí NSS?** This is the counterpart of the
  Supreme Court's category A and the strongest weight an NSS decision carries.
- **Which formation?** A decision of the *rozšířený senát* settles a conflict
  between three-judge chambers and outranks them.
- **Is there a formulated *právní věta*?** A decision with one is stating a rule
  rather than applying settled law to facts.
- **What happened below, and on cassation?** The record names the administrative
  decision challenged and the regional judgment under review, with the cassation
  outcome. A regional judgment that NSS set aside is not authority.

## Step 5: the ministry's position

`cz_mzp_search` covers the Věstník MŽP and the ministry's methodological
documents, PDF text included. For a practical question it is often decisive.

Keep two things apart:

- A **metodický pokyn** is the ministry's interpretation. It binds subordinate
  authorities administratively. It is not law, and a court may depart from it.
  Cite it as the ministry's position, with its date, and pair it with the
  provision it construes.
- The **Věstník** also carries resort instruments, and the ministry states that
  publication in it is a condition of their validity. So it is where you check
  whether an instrument is in force, and the issue and year form part of the
  citation.

## Watch out for

**The eight-day window in § 70(3) ZOPK.** An association's right to be a party
to proceedings is lost if it does not announce its participation in writing
within eight days of being notified that proceedings have started. § 70 of Act
No. 114/1992 Coll., o ochraně přírody a krajiny, in force from 2025-10-01:

> (3) Občanské sdružení je oprávněno za podmínek a v případech podle odstavce 2
> účastnit se řízení podle tohoto zákona nebo řízení podle jiného právního
> předpisu, pokud se v něm rozhoduje na základě jednotného environmetálního
> stanoviska vydávaného namísto povolení kácení dřevin podle § 8 odst. 1 nebo
> výjimky ze zákazů u památných stromů a zvláště chráněných druhů rostlin a
> živočichů podle § 56 odst. 1, **pokud oznámí svou účast písemně do osmi dnů
> ode dne, kdy mu bylo příslušným správním orgánem zahájení řízení oznámeno**;
> v tomto případě má postavení účastníka řízení.

(Source: [§ 70 of Act No. 114/1992 Coll.](https://www.e-sbirka.cz/eli/cz/sb/1992/114/2025-10-01),
read 2026-09-13. The spelling *environmetálního* is the official text's, not a
transcription error.)

Two further points on the same provision, both live:

- The standing right in § 70(2) is **excluded for proceedings following an
  environmental impact assessment** under § 3(g) of Act No. 100/2001 Coll., which
  has its own participation regime. Check which regime applies before advising on
  a deadline.
- § 70(3) has been narrowed to proceedings decided on the basis of a **jednotné
  environmentální stanovisko** substituting for a tree-felling permit under § 8(1)
  or a species-protection exemption under § 56(1). The pre-2023 case law on
  participation was decided under a broader provision, so read it against the
  version in force at the time (`legal_cite` with `as_of`).

**The two-month limit in § 72 SŘS, which cannot be waived.** § 72 of Act No.
150/2002 Coll., soudní řád správní, in force from 2026-01-01:

> (1) Žalobu lze podat **do dvou měsíců** poté, kdy rozhodnutí bylo žalobci
> oznámeno doručením písemného vyhotovení nebo jiným zákonem stanoveným
> způsobem, nestanoví-li zvláštní zákon lhůtu jinou. Pokud se žalobci rozhodnutí
> neoznamuje, běží tato lhůta ode dne, kdy se žalobce prokazatelně s rozhodnutím
> seznámil; nejpozději lze však žalobu podat do jednoho roku od právní moci
> napadeného rozhodnutí.
> […]
> (4) **Zmeškání lhůty pro podání žaloby nelze prominout.**

(Source: [§ 72 of Act No. 150/2002 Coll.](https://www.e-sbirka.cz/eli/cz/sb/2002/150/2026-01-01),
read 2026-09-13.)

Two months from notification, and § 72(4) makes the consequence absolute: a
missed deadline cannot be excused, on any ground. Where the claimant was never
notified, time runs from when they demonstrably learned of the decision, subject
to a one-year long-stop from the decision becoming final. This is the single
most expensive thing to get wrong in an environmental challenge, because the
decision under attack is frequently one the claimant was not a party to. Check
`nestanoví-li zvláštní zákon lhůtu jinou`: the sectoral acts do sometimes set a
different period.

**The version trap.** The jednotné environmentální stanovisko reorganised which
authority issues what, from 2024. Case law and guidance written before that
describes a procedure that no longer exists. Always check the date of a decision
or a metodický pokyn against the version of the act it was applying.

## Open questions

- How far the narrowed § 70(3) leaves associations able to participate in
  proceedings that are neither EIA-follow-on nor JES-based. This turns on
  post-2023 NSS case law that should be checked directly rather than assumed.
- Whether Czech practice on access to justice satisfies the Aarhus Convention in
  its current form. The Aarhus Convention Compliance Committee's findings are
  not reachable from this repository's tools and would have to be read at the
  UNECE site.

## Sources

- Act No. 114/1992 Coll., o ochraně přírody a krajiny, § 70, version in force
  from 2025-10-01: https://www.e-sbirka.cz/eli/cz/sb/1992/114/2025-10-01 (read 2026-09-13)
- Act No. 100/2001 Coll., o posuzování vlivů na životní prostředí, version in
  force from 2025-08-01: https://www.e-sbirka.cz/eli/cz/sb/2001/100/2025-08-01 (read 2026-09-13)
- Ministerstvo životního prostředí, Věstník MŽP:
  https://www.mzp.gov.cz/cz/pro-media-a-verejnost/vestnik (read 2026-09-13)
- Nejvyšší správní soud, search: https://vyhledavac.nssoud.cz (read 2026-09-13)

## Related

- [[Agent guide]]
- [[Maintenance]]
- [[Standing of environmental associations]]
- [[Jednotné environmentální stanovisko]]
