# Privacy and data protection work product

Work product under Regulation (EU) 2016/679 (General Data Protection
Regulation) and Act No. 110/2019 Coll., on personal data processing. The
organisation this is kept for is named in `PROFILE.md`.

**This folder is gitignored below the README.** It holds work product, which is
yours and frequently a client's. Nothing you put here is pushed. Kept out of `vault/`, which holds durable knowledge-base notes rather
than work product. Where an output establishes a durable rule, write a note in
`vault/` and link to the work product here.

| Folder | Holds | Naming |
| --- | --- | --- |
| `pia/` | Privacy impact assessments and data protection impact assessments | `PIA_ProjectName_YYYY-MM-DD.md` |
| `dpa/` | Data processing agreement reviews and drafts | `DPA_Counterparty_YYYY-MM-DD.md` |
| `dsar/` | Data subject access request handling records | `DSAR_Ref_YYYY-MM-DD.md` |
| `triage/` | Use-case triage results | `TRIAGE_Subject_YYYY-MM-DD.md` |
| `reference/` | Regulator documents, with provenance in its own README | as downloaded |

The `policy-monitor` skill crawls this folder to detect drift between the written
privacy policy and what the company actually does. It has nothing to compare
against until a privacy policy exists.

## Practice profile

The governing configuration is
`~/.claude/plugins/config/claude-for-legal/privacy-legal/CLAUDE.md`, written by
`/privacy-legal:cold-start-interview` if you run it. Read it before producing
anything in this folder. It carries the jurisdiction correction, the citation and
abbreviation rules, the data processing agreement playbook, the impact assessment
house style and the escalation table.

## Compliance position as at 2026-08-24

Nothing is in place. In remediation order, by exposure rather than effort:

1. **No privacy notice.** Articles 13 and 14 of the General Data Protection
   Regulation sit inside Articles 12 to 22, which Article 83(5)(b) places in the
   higher fine tier (up to EUR 20 000 000 or 4 % of total worldwide annual
   turnover, whichever is higher).
2. **No data processing agreement, in either direction.** Article 28(3) requires
   one and Article 28(9) requires it in writing. Lower tier under Article 83(4)(a),
   up to EUR 10 000 000 or 2 %.
3. **No record of processing activities.** Article 30. The under-250-person
   derogation in Article 30(5) is defeated by any one of three disjunctive
   carve-outs.
4. **Data protection officer not published and not notified.** Article 37(7)
   requires both.
5. **Data protection officer conflict of interest unresolved.** The officer is
   also a co-founder. Article 38(6) requires the controller to ensure that other
   tasks do not create a conflict, and Article 38(3) requires the officer to report
   to the highest management level, which here is the officer.

Provision wording for all of the above is quoted in the practice profile.

## The finding to read first

ÚOOÚ's Article 35(4) list, held in `reference/`, grades processing on ten
characteristics. Two critical values describe this company's core business
directly: **8.1 automated expert systems including artificial intelligence**, and
**10.1 an entirely new solution**. The authority's own threshold is that two
critical values make an impact assessment mandatory. Working assumption: for the
company's own artificial intelligence products a mandatory assessment under
Article 35 is required, and the burden is on showing it is not.
