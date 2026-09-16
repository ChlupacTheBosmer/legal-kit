# Profile template

The scaffold `/legal-kit:setup` fills and writes to
`~/.claude/plugins/config/legal-kit/profile.md`.

Rules for filling it:

- `[PLACEHOLDER]` means the user was asked and chose to skip. Never a question
  that scrolled past.
- `[PENDING]` means the interview was paused before reaching it.
- `[DEFAULT]` means the quick path assumed it without asking.
- `[SKIPPED: <area>]` means an area block was offered and declined.
- Every legal fact carries `[verified YYYY-MM-DD]` if it was checked with
  `legal_cite` during the interview, or `[user-stated, unverified]` if not.

Do not invent sections. If a question was not asked, mark it, do not omit it:
a later skill has to be able to tell "not applicable" from "never asked".

---

```markdown
<!-- Written by /legal-kit:setup on YYYY-MM-DD. Re-run it, or edit this by hand. -->
<!-- This file is yours and stays on this machine. -->

# legal-kit profile

## Who you are

- **Name:** [name]
- **Standing:** [advocate on the ČAK roll | qualified, not on the roll | concipient or trainee | law student | not legally qualified | other]
- **Practice setting:** [solo advocacy | larger practice | in-house | public body | court or prosecution | academia, clinic or NGO | described below]
- **Description, if the boxes did not fit:** [free text]

### What follows from the standing answer

[Fill exactly one of these.]

**On the roll:** Privilege and the duty of confidentiality under § 21 of Act No.
85/1996 Coll., on the legal profession, attach to this user. Outputs may be
framed as advice. Flag conflicts, client duties and deadlines prominently.

**Not on the roll:** Claim no privilege over anything produced here. § 21 of Act
No. 85/1996 Coll. attaches the duty of confidentiality to the advocate, and Czech
law has no attorney work product doctrine, because it has no United States style
discovery. Frame outputs as research, and name the point at which an advocate is
needed, with the trigger and the specialism required.

**Not legally qualified, or a student:** As above, and additionally: keep every
citation and every quoted provision, and set out the doctrinal step as well as
the conclusion. Never drop sources in order to simplify.

## Jurisdiction

- **Primary:** Czech Republic within the European Union framework
- **Also encountered:** [list, or none]
- **Outside the sources, say so rather than guess:** [European Court of Human Rights | Aarhus Compliance Committee | other | none]
- **Never:** United States law

## What you practise

- **Specialism:** [areas]
- **Occasional, not specialist:** [areas]

Set out doctrinal background in the occasional areas. Assume it in the specialism.

[One subsection per area, written by that area's block in `areas/`.]

## How you work

- **Escalation:**

| Trigger | Goes to |
| --- | --- |
| [what] | [who] |

- **Supervision:** [who must see a draft, and before what]
- **Conflicts:** [flag against list at <path> | reminder only, no list | not applicable]

## Language

- **Analysis, notes and conversation:** [Czech | English]
- **Czech deliverables:** drafted in Czech in full, never translated from an English draft
- **Quoted provisions:** always in their own language; a translation is never presented as the text

## House style

Defaults apply unless listed here. Record departures only.

- [departure, or "none: defaults apply"]

## Integrations

| Integration | State | Checked |
| --- | --- | --- |
| Zotero | [✓ tested | ⚪ configured, unverified | ✗ absent] | [date] |
| Google Docs and Drive | [✓ | ⚪ | ✗] | [date] |
| claude-for-legal plugins | [✓ | ✗] | [date] |

## Indexes

| Index | State | Built | Refresh |
| --- | --- | --- | --- |
| ÚOOÚ guidance | [built | not built] | [date] | monthly |
| MŽP guidance and Věstník | [built | building | not built] | [date] | quarterly |
| District and regional courts | [built from YYYY-MM-DD | not built] | [date] | quarterly |

Weekly refresh installed: [yes | no]

## Seed documents read

- [what was read, and what was extracted from it, or "none offered"]

## Open gaps

Things deliberately left for later. Each was offered and declined.

- [gap]
```
