# Profile

Who this workspace is for. `make setup` writes `PROFILE.md` from your answers;
this file is the example it is built from, and it is safe to read as
documentation. **`PROFILE.md` itself is not tracked by git**, so nothing personal
leaves your machine when you push.

Edit `PROFILE.md` by hand whenever any of it changes. Re-run `make setup` to
rewrite it from scratch.

---

## Who you are

- **Name:** Jane Example
- **Role:** in-house counsel at a small software company
- **Qualification:** qualified lawyer, Czech Republic
- **On the roll of advocates (ČAK)?** No

### What follows from the qualification answer

This governs the register the assistant writes in, so answer it honestly.

| Answer | What the assistant does |
| --- | --- |
| A qualified lawyer | Writes at full legal register. Assumes the doctrinal grammar (sources of law, direct effect, interpretation) but sets out background in areas outside the stated specialism. |
| Not legally qualified | Keeps the citations and the quoted provisions, and explains the doctrinal step as well as the conclusion. Never drops the sources to simplify. |
| On the ČAK roll | May be advising clients. The assistant flags conflicts, deadlines and duties to the client more aggressively. |
| Not on the ČAK roll | Claims no privilege over anything here (see `CLAUDE.md`), and names the trigger for bringing in an advocate. |

## What you practise

- **Main areas:** data protection, commercial contracts
- **Secondary areas:** intellectual property
- **Outside your specialism:** environmental, tax, criminal

The assistant sets out doctrinal background in the areas you list as outside your
specialism, and assumes it in your main ones. Use the tags from
`vault/README.md` where they fit.

## Jurisdiction

- **Primary:** Czech Republic, within the European Union framework
- **Also relevant:** Slovakia (occasionally, for comparison)
- **Never:** United States law

Leave the last line alone unless you genuinely work in another system. The
installed `claude-for-legal` plugins are drafted for United States practice and
their substantive defaults are wrong here; `docs/jurisdiction-overlay.md` is what
corrects them.

## Language

- **Analysis, notes and conversation:** English
- **Czech deliverables** (contracts, submissions to authorities, pre-suit
  demands, replies to Czech data subjects): drafted in Czech, in full, not
  translated from an English draft
- **Quoted provisions:** always in their own language, never a translation
  presented as the text

## Organisation

- **Acting for:** Example Software s.r.o.
- **IČO:** 12345678
- **Registered:** Prague

Fill this in if you are advising one organisation regularly, so the assistant can
check the register and the signing rules without asking each time. Leave it empty
if you work across many clients, and use the matter-workspace skills instead.

## Integrations configured

| Integration | Configured? | Where the credentials live |
| --- | --- | --- |
| Zotero (commentary, articles, textbooks) | no | `~/.claude.json`, `mcpServers.zotero.env` |
| Google Docs and Drive (drafting) | no | `~/.claude_google_token.json` |
| `claude-for-legal` plugins | no | `~/.claude/plugins/config/claude-for-legal/` |

Nothing here requires any of them. The legal research tools use only free,
unauthenticated government registries.

## House style

The defaults are in `CLAUDE.md` and apply to everyone. Record only your
departures from them here.

- No em-dashes or en-dashes anywhere.
- No preamble, no recap, no closing pleasantries.
- Substantive answers are written as a legal report: see
  `vault/50-Handbook/Report format.md`.

## Notes to the assistant

Anything else it should know. For example:

- I read Czech fluently but prefer analysis in English.
- I am usually asking in order to brief someone else, so write for a reader who
  was not in the conversation.
