# Jurisdiction overlay: reading the claude-for-legal plugins in a Czech/EU context

The `claude-for-legal` plugins are written for US in-house practice. Their
*workflow* is sound — intake, triage, playbook matching, escalation, drafting
gates. Their *substantive defaults* are US law and will be wrong here.

This document is the correction layer. `CLAUDE.md` requires that any plugin
output touching substantive law is run through it before delivery.

Every Czech provision below was read from e-Sbírka via the `lex` server on
2026-08-24 and is quoted at the version then in force. Re-verify before relying
on it — that is the point of having `lex`.

> **Corrected 2026-08-24 after review.** Two errors were found in the first
> version of this file: the commissioned-work row wrongly said a contractor is
> never covered (§ 58(7) says the opposite for software), and the exception
> range was given as §§ 30–39, omitting §§ 39a–39d and so the TDM exceptions.
> Both are fixed below. Treat this as a reminder that a document asserting
> "read from the registry" can still be wrong — check the pinpoint cite with
> `legal_cite` before relying on any row here.

---

## The rule

When a plugin skill produces a legal statement:

1. **Identify the US assumption.** Named statute, agency, deadline, doctrine, or
   a silent one (at-will employment, fair use, discovery, punitive damages).
2. **Replace it** using the mapping below, or say the concept has no Czech
   equivalent.
3. **Verify the replacement** with `cz_act_text` / `eu_act_text`. Never carry a
   provision number across from the plugin's template.
4. **Say what changed.** If a plugin's playbook position was rewritten for Czech
   law, note it, so the practice profile can be corrected at source.

Where the plugin asks for a "primary jurisdiction", the answer is **Czech
Republic, within EU law**. Where it offers US-only integrations (CourtListener,
Westlaw, Trellis), the answer is "not available — use `lex` and `cz_case_*`".

---

## Concepts with no Czech equivalent

Say so plainly rather than substituting the nearest thing.

| US concept | Position in Czech law |
| --- | --- |
| **Fair use** | Does not exist. Exceptions and limitations are a **closed list** (§§ 29–39d AZ — note the range runs past § 39 to § 39d, which includes the text-and-data-mining exceptions in §§ 39c–39d) and every one of them is additionally subject to the three-step test in **§ 29(1) AZ**: only in the specific cases laid down by statute, not conflicting with normal exploitation, and not unreasonably prejudicing the author's legitimate interests. A use that fits no listed exception is infringing however reasonable it looks. |
| **Assignment of copyright** | Impossible. Czech copyright is inalienable during the author's life; only a **licence** can be granted (§ 2358 et seq. of the Civil Code, Act No. 89/2012 Coll.). An "assignment" clause in a Czech-law contract is construed as, at best, an exclusive licence. Draft it as one. |
| **Work made for hire** | Nearest equivalent is **zaměstnanecké dílo**, § 58 AZ: unless agreed otherwise, the *employer exercises the author's economic rights in its own name and on its own account*. Authorship and moral rights stay with the employee. Commissioned work does **not** follow one rule — see the row below. |
| **Commissioned work** | Three regimes, and getting them confused is the most expensive mistake available here. **(a) Software, databases and cartographic works** created *na objednávku*: **§ 58(7) AZ** deems them employee works and deems the **commissioner to be the employer**, and expressly disapplies § 61. So for commissioned software the client exercises the economic rights *by statute*, with no licence clause at all. **(b) Any other commissioned work** (§ 61(1)): the author is deemed to have granted a licence **for the purpose following from the contract** — use beyond that purpose needs an express licence, and under § 61(2) the author may generally still use the work themselves unless that conflicts with the commissioner's legitimate interests. **(c) Neither** — e.g. a pre-existing work merely delivered: express licence needed. |
| **Punitive damages** | Not available. Compensation is restitutionary. |
| **US-style discovery** | No equivalent. Each party produces its own evidence; there is a limited information right in IP matters under Act No. 221/2006 Coll. |
| **At-will employment** | Not available. Termination requires a statutory ground under the Labour Code (Act No. 262/2006 Coll.). |
| **Attorney–client privilege (US form)** | Different instrument: the advocate's duty of confidentiality under the Advocacy Act. Do not reason from US privilege-waiver rules. |

---

## Per-plugin mapping

### `privacy-legal`

| Plugin assumes | Use instead |
| --- | --- |
| CCPA/CPRA, state privacy patchwork | **GDPR** (Regulation (EU) 2016/679, CELEX 32016R0679) as the primary instrument; **Act No. 110/2019 Coll.** for the Czech specifics |
| "DSAR" | Data subject rights, Arts. 15–22 GDPR. Response deadline **one month** from receipt, extendable by two further months for complexity (Art. 12(3)) — not 45 days |
| Privacy Impact Assessment | **DPIA**, Art. 35 GDPR; prior consultation with the supervisory authority under Art. 36 |
| Vendor data agreement | **Art. 28 GDPR** processor contract, with the mandatory content in Art. 28(3) |
| Breach notification to state AGs | **Art. 33** — to ÚOOÚ within **72 hours** of becoming aware, unless unlikely to result in risk; **Art. 34** — to data subjects without undue delay where high risk |
| Cross-border transfer analysis | Chapter V GDPR; SCCs are **Commission Implementing Decision (EU) 2021/914** (CELEX 32021D0914), plus a transfer impact assessment |
| State AG / FTC as regulator | **Úřad pro ochranu osobních údajů (ÚOOÚ)**, uoou.gov.cz |
| Cookie consent under state law | **§ 89 of Act No. 127/2005 Coll.** (electronic communications) implementing the ePrivacy Directive (32002L0058) — opt-in consent since 2022 |

### `ip-legal`

| Plugin assumes | Use instead |
| --- | --- |
| USPTO, TTAB, trademark opposition practice | **ÚPV** (upv.gov.cz) for national marks under **Act No. 441/2003 Coll.**; **EUIPO** for EU trade marks under **Regulation (EU) 2017/1001** (CELEX 32017R1001) |
| Patent practice before the USPTO | **Act No. 527/1990 Coll.** nationally; EPO for European patents; unitary patent where designated |
| Copyright registration as a precondition | No registration exists or is needed — protection arises on creation |
| DMCA notice-and-takedown | **Art. 16 DSA** (Regulation (EU) 2022/2065) notice-and-action for hosting providers, plus **§ 5 of Act No. 480/2004 Coll.** on liability. There is no DMCA counter-notice or safe-harbour registration regime |
| Cease-and-desist letter | **Předžalobní výzva** is not optional if costs matter: under **§ 142a of the Civil Procedure Code (Act No. 99/1963 Coll.)**, a successful claimant recovers costs only if it sent a demand to the defendant's service address at least **7 days before filing**. Always send one, always keep proof |
| Trade secret protection by state UTSA | **§ 504 of the Civil Code** (obchodní tajemství) and **Act No. 221/2006 Coll.**, implementing the Trade Secrets Directive (32016L0943) |
| OSS licence compliance | Same licences, but enforceability and remedies run through Czech contract and copyright law; note § 2358 CC form requirements for exclusive licences |

### `ai-governance-legal`

| Plugin assumes | Use instead |
| --- | --- |
| NIST AI RMF, state AI statutes, EO-based obligations | **AI Act** (Regulation (EU) 2024/1689, CELEX 32024R1689). It has consolidated versions — check `eu_act_versions` before quoting |
| Voluntary framework posture | Binding, staged obligations. Verify the applicable date for the specific obligation with `eu_act_metadata`; the Act's provisions phase in on different dates |
| "High-risk" as an internal label | A defined legal category (Art. 6 and Annex III). Prohibited practices are Art. 5. GPAI obligations are Chapter V |
| Sectoral US regulator | Czech national authority designation should be confirmed against the current text before naming one — do not assume; check `cz_act_relations` for implementing legislation |
| AI + personal data treated separately | They stack. An AI use case processing personal data needs both an AI Act assessment and a GDPR Art. 35 DPIA |

### `regulatory-legal`

| Plugin assumes | Use instead |
| --- | --- |
| Federal Register, NPRM, comment deadlines | **Sbírka zákonů** via e-Sbírka (`cz_act_versions` for what changed and when) and the **Official Journal of the EU** via EUR-Lex |
| Agency docket monitoring | Czech draft legislation runs through **ODok**; EU files through EUR-Lex procedure references |
| Effective-date tracking | Czech acts are consolidated by effective date — `cz_act_versions` is the authoritative changelog. EU acts: entry into force ≠ date of application; `eu_act_metadata` gives entry into force, the text gives application |

### `commercial-legal`

| Plugin assumes | Use instead |
| --- | --- |
| UCC Article 2, common-law contract doctrine | **Civil Code, Act No. 89/2012 Coll.** |
| Freely negotiated limitation of liability | **§ 2898 CC** voids in advance any exclusion or limitation of the duty to compensate harm caused *to a person's natural rights*, or caused *intentionally or by gross negligence*; and any exclusion or limitation of a **weaker party's** right to compensation for any harm. These rights cannot validly be waived. A US-style uncapped-carve-out clause needs rewriting |
| Liquidated damages | **Smluvní pokuta** (contractual penalty), moderable by the court if excessive |
| Choice of law / forum boilerplate | **Rome I** for applicable law, **Brussels Ia** for jurisdiction; consumer and employee protective rules override choice of law |
| Consumer terms drafted to US standards | Czech consumer protection (Act No. 634/1992 Coll.) plus the Consumer Rights Directive (32011L0083) and UCPD (32005L0029); unfair-terms control applies |
| Signature authority assumed from title | Verify with **`cz_company`** — it returns the registered acting rules and the current statutory bodies from the Commercial Register. A contract signed contrary to the registered acting rules is a live risk |

---

## Practical workflow

1. Run the plugin skill normally — its structure is the value.
2. Before delivering, sweep the output for: US statute names, US agencies, day
   counts, "fair use", "assignment" of copyright, "at-will", "discovery".
3. Replace each using this file.
4. Verify each replacement with `lex`, and cite the version read.
5. If the correction is one you will need again, write it into the practice
   profile at `~/.claude/plugins/config/claude-for-legal/<plugin>/CLAUDE.md` so
   the plugin stops producing it.

## Sources

All Czech provisions read from e-Sbírka (Ministry of the Interior) on 2026-08-24:
- Act No. 121/2000 Coll. (Copyright Act), version in force from 2025-07-01 — §§ 29, 58 (incl. 58(7)), 61, and the exception range 29–39d
- Act No. 89/2012 Coll. (Civil Code), version in force from 2026-01-01 — §§ 2358, 2898
- Act No. 99/1963 Coll. (Civil Procedure Code), version in force from 2026-01-01 — § 142a

EU instruments identified by CELEX and verified in force via CELLAR on 2026-08-24.
Statements marked "confirm before naming" have deliberately not been asserted.
