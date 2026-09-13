# Origin and modifications

This plugin is derived from **`pravo-skills` v1.1.0 by DirectCase**, released
under the MIT Licence (see `LICENSE`, which is retained unchanged as the licence
requires). Original: <https://www.directcase.ai/cz/cs/news/claude-legal-plugin-cs>

DirectCase wrote the nine Czech legal workflows. They are good, and they are kept
substantially as written.

## What was changed

1. **Legal sources rewired from DirectCase MCP to `lex`.** The upstream skills
   call DirectCase's paid MCP server for case law, legislation, regulatory
   opinions and the commercial register. This project reads the same categories
   of material directly from the official registries — e-Sbírka, EUR-Lex/CELLAR,
   rozhodnuti.nsoud.cz, NALUS, rozhodnuti.justice.cz and ARES — through the `lex`
   server in `mcp-servers/lex/`. Every "Krok 0" connector-check section and every
   `Pro AI agenta` tool list was rewritten accordingly.

   This is a substitution of one provider for another in skills that were written
   to be provider-agnostic. `mcp.directcase.ai` is not contacted.

2. **`mcp__mcp-registry__*` calls removed.** Those tools exist in Claude.ai /
   Cowork, not in Claude Code; the skills would have failed on them.

3. **`.mcp.json` emptied.** Upstream declared DocuSign, Slack, Microsoft 365,
   Gmail, Calendar and Drive. None are used here.

4. **`README.md` and `CONNECTORS.md` replaced** with documentation for this setup.

## What was not changed

The substantive Czech legal content of the nine skills — checklists, risk
matrices, classification rules, response templates — is DirectCase's work and is
kept as they wrote it. It has **not** been verified provision by provision.
Treat statements inside the skills as a starting structure, not as verified law:
the standing project rule applies, and anything cited must be checked with
`legal_cite` before it reaches a document.

## What is deliberately absent

ÚOOÚ guidance **is** now in `lex` (`cz_guidance_search`), as is Constitutional
Court and lower-court search. Still absent: Supreme Administrative Court and
high-court case law, and guidance from ČNB, ÚOHS, ČTÚ, SÚKL and NÚKIB. The
skills say so where they used to promise coverage. See `docs/tooling.md`.
