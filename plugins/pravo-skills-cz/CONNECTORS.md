# Connectors

Upstream shipped a recommended stack built around DirectCase MCP and a set of
commercial legal SaaS products. This build uses neither. What is actually wired:

| Category | Upstream placeholder | Here |
| --- | --- | --- |
| Czech / EU legal sources | `~~pravni-zdroje` | **`lex`** — e-Sbírka, EUR-Lex/CELLAR, rozhodnuti.nsoud.cz, NALUS, rozhodnuti.justice.cz, ARES |
| Company register / KYC | (DirectCase) | **`lex`** — `cz_company_search`, `cz_company` |
| Office suite | `~~office-suite` | **Google Workspace** — `tools/gdoc.py` plus the `google-workspace` MCP |
| Cloud storage | `~~cloud-storage` | **Google Drive**, via the same token |
| Reference library | — | **Zotero** — `law` collection, for commentary and scholarship |

Deliberately not connected: DirectCase MCP, DocuSign, Slack, Microsoft 365,
Ironclad, iManage, Definely, TopCounsel. The commercial ones are blocked by name
in `.claude/settings.json` (`deniedMcpServers`).

Two gaps worth naming, both genuinely useful and neither yet built:

- **Datová schránka (ISDS).** Upstream is right that it matters in Czech practice
  — it is the channel for service of legal acts under Act No. 300/2008 Coll.
  There is an official ISDS web-service API; it needs credentials and a decision
  about whether automated access to a data box is wanted at all.
- **Regulator guidance.** ÚOOÚ, ČNB, ÚOHS and the rest publish opinions that are
  often more decisive in practice than the statute. No API; see `docs/tooling.md`.
