# pravo-skills-cz — Czech legal workflows, wired to `lex`

Nine Czech-language slash commands for everyday legal work, adapted from
DirectCase's MIT-licensed `pravo-skills` and rewired to this project's own `lex`
MCP server. See [NOTICE.md](NOTICE.md) for exactly what was changed and why.

| Command | What it does |
| --- | --- |
| `/pravo-skills-cz:revize-smlouvy` | Contract review against a playbook, redlines, Word output with comments |
| `/pravo-skills-cz:triage-nda` | Fast NDA classification (green / amber / red) |
| `/pravo-skills-cz:kontrola-podpis` | Signatory KYC and pre-signature checklist |
| `/pravo-skills-cz:kontrola-dodavatele` | Consolidated vendor contract view, KYC, gap analysis |
| `/pravo-skills-cz:kontrola-souladu` | Compliance check (GDPR, NIS2, DORA, AI Act) |
| `/pravo-skills-cz:priprava-jednani` | Negotiation briefing, counterparty profile, argument map |
| `/pravo-skills-cz:posouzeni-rizika` | Severity × likelihood matrix, memorandum, risk register |
| `/pravo-skills-cz:pravni-odpoved` | Template legal responses (DSR, hold, vendor, NDA…) |
| `/pravo-skills-cz:prehled-pravni` | Daily / thematic / crisis briefing |

## Language

**The skills are written in Czech and produce Czech output.** That is deliberate
and is the reason to have them: Czech legal documents should be drafted in Czech.

The project's default working language stays English — analysis, knowledge-base
notes and conversation. Use these commands when the *deliverable* is a Czech
document. See the language policy in the project `CLAUDE.md`.

## Legal sources

Every skill takes its legal authority from `lex`, which reads the official
registries directly. `legal_cite` is the tool that matters: it resolves a
reference, returns the citation in Czech and English, and returns the wording the
provision actually has, so nothing goes into a document unverified.

ÚOOÚ guidance is in `lex` (`cz_guidance_search`) — search it, do not look it up
by hand. Not covered, and the skills say so rather than promising it: Supreme
Administrative and high-court case law, and guidance from ČNB, ÚOHS, ČTÚ, SÚKL
and NÚKIB. Look those up by hand and mark them as unverified.

## Configuration

Copy `legal.local.example.md` to `legal.local.md` in the project root and fill in
your standard positions, escalation triggers and response templates. The skills
read it. Without it they fall back to generic defaults.

## The disclaimer, which is upstream's and still applies

These skills support legal workflows; they do not provide legal advice within the
meaning of Act No. 85/1996 Coll. on the legal profession. Generated analyses,
redlines and template responses must be reviewed by a qualified advocate before
they are relied on.
