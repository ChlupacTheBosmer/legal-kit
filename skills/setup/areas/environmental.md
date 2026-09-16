# Area block: environmental law

Loaded by `/legal-kit:setup` when the user selects environmental law.
Three question groups. Two to three minutes.

**Run `areas/administrative.md` first if the user did not already select
administrative law.** Czech environmental law is administrative law almost
throughout, and the posture and deadline answers from that block are
prerequisites for this one. Say so rather than silently pulling it in:

> Environmental work here is administrative law, so I am going to ask the
> administrative questions first. Two minutes, then the environmental ones.

## What it drives

| Answer | Changes |
| --- | --- |
| Sub-areas | Which acts are resolved by alias, and which MŽP guidance is searched first |
| Whether the MŽP index is built | Whether the ministry's own position is available at all |
| Standing posture | Whether § 70 of the Nature Protection Act and its eight-day window are flagged |
| Permitting stage | Whether the answer is framed around the procedure or the challenge |

---

## Q1: Which parts

> Which of these do you actually work on?
>
> 1. Nature and landscape protection, Natura 2000, species, trees
> 2. Environmental impact assessment (EIA and SEA), and the single environmental opinion (jednotné environmentální stanovisko)
> 3. Water
> 4. Waste and the circular economy
> 5. Air
> 6. Integrated permitting (IPPC)
> 7. Environmental damage and contaminated land
> 8. Climate, emissions trading, energy transition
> 9. Chemicals and major accident prevention
> 10. Access to environmental information

**Record** the selection. It decides which acts are worth pre-resolving and which
MŽP material is searched first. The acts behind each, all reachable by alias:

| Sub-area | Act |
| --- | --- |
| Nature | Act No. 114/1992 Coll., o ochraně přírody a krajiny (`zopk`) |
| EIA and SEA | Act No. 100/2001 Coll., o posuzování vlivů na životní prostředí |
| Single environmental opinion | Act No. 148/2023 Coll. (`jes`) |
| Water | Act No. 254/2001 Coll., vodní zákon |
| Waste | Act No. 541/2020 Coll., o odpadech |
| Air | Act No. 201/2012 Coll., o ochraně ovzduší |
| IPPC | Act No. 76/2002 Coll., o integrované prevenci |
| Environmental damage | Act No. 167/2008 Coll., o předcházení ekologické újmě |
| Chemicals, major accidents | Act No. 350/2011 Coll.; Act No. 224/2015 Coll. |
| Environmental information | Act No. 123/1998 Coll. |

---

## Q2: Standing, and the window that closes

Ask only if the posture from the administrative block is challenger, both, or
advisory.

> Associations challenging environmental decisions run into a deadline that is
> shorter than anything else in administrative law, and it is the one I see
> missed. Let me show you the wording rather than paraphrase it.

Call `legal_cite "§ 70 114/1992"` and quote paragraph 3, then:

> § 70(3) of Act No. 114/1992 Coll. gives an association the right to be a party,
> but only if it announces its participation in writing **within eight days** of
> being notified that proceedings have started. Eight days, not two months.
>
> Two things about the current text that catch people who learned it before 2023:
> participation under § 70(2) is **excluded** for proceedings following an
> environmental impact assessment under § 3(g) of Act No. 100/2001 Coll., which
> has its own regime; and § 70(3) now reaches proceedings decided on the basis of
> a **jednotné environmentální stanovisko** substituting for a tree-felling permit
> under § 8(1) or a species exemption under § 56(1).

Then ask:

> - Do you act for associations under § 70, or advise authorities on whether an
>   association has standing?
> - Should I flag the eight-day window at the top of any answer where proceedings
>   have started?

**Record** as `**Standing posture:**` and `**Flag § 70(3) window:**`.

**If the user describes the pre-2023 position as current,** show them the version
date from `legal_cite` and note that case law decided under the broader provision
must be read against the version in force at the time, using `legal_cite` with
`as_of`.

---

## Q3: The ministry's guidance

> For an environmental question the Ministry of the Environment's own position
> often settles how a provision is applied in practice, the way the data
> protection authority's guidance settles a GDPR question. legal-kit mirrors the
> **Věstník MŽP** back to 1995 and the ministry's methodological documents,
> including the text inside the PDFs.
>
> Two things to keep apart, and I will keep them apart in every answer:
>
> - A **metodický pokyn** is the ministry's interpretation. It binds subordinate
>   authorities administratively. It is not law and a court may depart from it.
> - The **Věstník** is different in kind. The ministry publishes resort
>   instruments in it and states that publication there is a condition of their
>   validity, so it is also how you check whether an instrument is in force at all.

If the MŽP index is not built, say plainly:

> Building it takes a few hours, because the ministry's robots.txt asks for ten
> seconds between requests and legal-kit honours that. It runs in the background
> and resumes if interrupted. Without it, `cz_mzp_search` has nothing to search.
> Start it now?

Then:

> Do you rely on a particular metodický pokyn regularly? Name it and I will
> record it so it is checked for supersession rather than assumed current.

**Record** the named instruments and whether the index was built.

---

## Full path only

> Two more.
>
> - Does your work reach the **European Union layer** often: the environmental
>   impact assessment, habitats, birds, water framework or industrial emissions
>   directives? I can pull the Czech act's transposition list with
>   `cz_act_relations` and the Court of Justice line with `eu_case_search`.
> - Do you hit the **Aarhus Convention** on access to justice? The Convention's
>   Compliance Committee findings are outside these tools, and I would rather tell
>   you that up front than discover it mid-answer.

---

## Written to the profile

```markdown
### Environmental

**Sub-areas:** [list]
**Standing posture:** [acts for associations | advises authorities | neither]
**Flag § 70(3) eight-day window:** [yes | on request]
**Relied-on ministry instruments:** [list, or none]
**MŽP index:** [built YYYY-MM-DD | building | not built]
**EU layer relevant:** [yes | rarely]
**Aarhus relevant:** [yes, and outside the tools | no]

**Deadlines beyond the administrative defaults:**

| Act | Provision | Period | Runs from | Checked |
| --- | --- | --- | --- | --- |
| Act No. 114/1992 Coll. | § 70(3) | 8 days | notification that proceedings started | [verified YYYY-MM-DD] |
```

## Reminder for every later skill reading this

The 2023 reorganisation around the jednotné environmentální stanovisko changed
which authority issues what. Guidance and case law written before it describe a
procedure that no longer exists. Always check the date of a decision or a
metodický pokyn against the version of the act it was applying, and use
`legal_cite` with `as_of` for historical facts.
