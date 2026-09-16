# Drafting in Google Docs, and working from comments

**Optional.** Nothing else in this repository needs Google. This is for the
drafting and revision loop: push a draft into a Google Doc, read back the
comments your colleagues leave with the text each one is anchored to, make a
surgical edit, reply to the comment and resolve it.

## Setting it up, once

Three steps. The middle one is tedious and there is no way around it, because
Google requires every application to be registered before it will issue a token.

```bash
# 1. Python libraries
python3 -m pip install -r tools/requirements.txt

# 2. Get an OAuth client secret from Google (see below)

# 3. Authorise, once. Opens a browser, writes ~/.claude_google_token.json
python3 tools/google-auth.py ~/Downloads/client_secret_xxx.json
```

Step 2, in Google Cloud Console:

1. Create a project. Any name.
2. **APIs & Services -> Library**: enable **Google Docs API** and **Google Drive API**.
3. **OAuth consent screen**: choose External, fill in the required fields, and
   add your own Google address under **Test users**. Without that last part
   Google refuses the token.
4. **Credentials -> Create credentials -> OAuth client ID**, application type
   **Desktop app**. Download the JSON.

The token is written to `~/.claude_google_token.json` with mode 600, outside the
repository, and refreshes itself from then on. `make doctor` reports whether both
halves are in place, because having the token but not the Python libraries is a
common and confusing state.

### What it can and cannot see

The token requests `drive.file`, not full Drive access. That means this tool can
only touch documents it created itself or that you explicitly opened with it. It
cannot read the rest of your Drive, and that is deliberate.

Revoke it at any time at [myaccount.google.com/permissions](https://myaccount.google.com/permissions),
and delete `~/.claude_google_token.json`.

Two paths exist, and they are for different things:Two paths exist, and they are for different things:

| | `tools/gdoc.py` | `google-workspace` MCP |
| --- | --- | --- |
| Auth | `~/.claude_google_token.json`, set up above | its own OAuth, separate |
| Comments with anchors | yes, with character offsets | yes, via `get_doc_as_markdown` |
| **Tracked changes (suggestions)** | **yes** | no |
| **Resolve a comment as part of an edit** | **yes** | separate call |
| Gmail, Calendar, Sheets, Slides | no | yes |

Use `tools/gdoc.py` for the drafting and revision loop: it is the only one of the
two that can read tracked changes and resolve a comment as part of the same edit.
The `google-workspace` MCP server is worth authorising separately if you also
want mail, calendar, Sheets or Slides.

## The tool

```bash
python3 tools/gdoc.py list [--query Q]                 # find a document
python3 tools/gdoc.py read <DOC_ID>                    # text + comments + tracked changes
python3 tools/gdoc.py comments <DOC_ID> [--json]       # just the threads
python3 tools/gdoc.py create --title T --from-md FILE  # markdown -> native Google Doc
python3 tools/gdoc.py edit <DOC_ID> --old '"..."' --new '"..."' \
        [--resolve-comment ID] [--reply TEXT] [--all]
python3 tools/gdoc.py link <DOC_ID> --text '"..."' --url URL
```

`--old` and `--new` are JSON-encoded strings, so quotes and newlines survive.
`edit` **refuses** when the target text is not unique, rather than changing
several places silently; extend the snippet or pass `--all` deliberately.

## Reading a marked-up draft

`read` returns, for every unresolved comment: the thread id, the author, the
comment, the **anchor text** it is attached to, and the character offsets of that
anchor in the document — plus an `anchor_status` of `unique`, `ambiguous (n)` or
`not found in body`. That last case matters: it means the text a comment refers
to has since been edited away, and the comment needs reading in context rather
than acted on literally.

It also returns Google Docs **suggestions** (tracked changes) as insertions and
deletions with their suggestion ids. The MCP server does not expose these, and a
draft someone has marked up with Suggesting mode will otherwise look unchanged.

## Citations: the part that was hard in the scientific-writer project

There, in-text citations had to be linked to Zotero entries by hand through the
Zotero Google Docs plugin, because field codes cannot be written through the API.

For legal work that problem dissolves, because legal citation does not need a
bibliography — it needs a pointer to the authoritative text. Drive converts
`text/markdown` natively on upload, and **markdown links become real hyperlinks**
in the resulting Doc. Verified end to end:

```markdown
Under [§ 58 of Act No. 121/2000 Coll.](https://www.e-sbirka.cz/eli/cz/sb/2000/121/2025-07-01)
the employer exercises the author's economic rights.
```

becomes a live link to e-Sbírka in the Doc. Headings, bold, lists and tables
survive the same way.

So the citation pipeline is:

1. `legal_cite "§ 58 121/2000"` — returns the citation in English and Czech, the
   official URL, a ready-to-paste markdown link, **and the wording the provision
   actually has**, so the claim can be checked before it is written.
2. Paste the markdown link into the draft.
3. `gdoc.py create` — the link is live in the Doc.
4. For a citation added to an existing Doc, `gdoc.py link` applies the URL to a
   span that is already there.

Zotero stays for commentary — articles, textbooks, regulator guidance PDFs —
cited author–year and kept in the `law` collection (`tools/zotero.mjs`).

## Revision loop

1. `gdoc.py read <DOC_ID>` — the draft, every open comment in place, and any
   tracked changes.
2. Deal with each comment on its own terms. Where it raises a legal question,
   verify with `lex` before answering; never answer from the draft's own text.
3. `gdoc.py edit` scoped to the commented span, with `--reply` saying what changed
   and citing the provision, and `--resolve-comment`. Leave everything else —
   including edits made by hand — untouched.
4. Where a `vault/` note covers the point, link it in the reply.

## Caution

A new Google Doc is restricted to you by default, but sharing settings are easy
to widen by accident and a link, once shared, is hard to recall. Check the
sharing state before putting counterparty names, contract terms or personal data
in a Doc, and keep the authoritative version of substantive notes in `vault/`.
