---
name: legal-delivery
description: Deliver legal work to a Google Doc and revise it from reviewer comments, and file commentary to Zotero. Delegates to gdocs-kit and zotero-kit when installed. Use when a memo, opinion, contract or submission must reach a reviewer or client, when a delivered document comes back commented, or when a source needs adding to a reference library.
---

# Delivering legal work, and getting it back

Two things leave this workspace: **documents** people comment on, and
**references** worth keeping. Both have a companion plugin that does the
mechanics better than anything bundled here, and both have a legal-specific rule
the companion cannot know.

## First: which tools are here

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --quick
```

The "Companion plugins" section says what is installed. Prefer them:

| Present | Use | Missing, fall back to |
| --- | --- | --- |
| `gdocs-kit` | `${CLAUDE_PLUGIN_ROOT}/../../claude-writing-kit/gdocs-kit/scripts/deliver_doc.py`, via the `gdoc-pipeline` skill | `${CLAUDE_PLUGIN_ROOT}/tools/gdoc.py` |
| `zotero-kit` | the `zotero-library` skill | `${CLAUDE_PLUGIN_ROOT}/tools/zotero.mjs` |

Resolve the companion's real path from the plugin cache rather than guessing:

```bash
ls -d ~/.claude/plugins/cache/*/gdocs-kit/*/ 2>/dev/null | tail -1
```

**If a companion is missing, say what it would add before falling back.** The
bundled scripts create a Doc and edit it; they do not update an existing Doc in
place, which is the thing that matters for anything reviewed more than once.
Offer the install line once, then get on with the fallback:

```
/plugin marketplace add ChlupacTheBosmer/claude-writing-kit
/plugin install gdocs-kit@claude-writing-kit
```

---

## Before anything is delivered

### 1. Confidentiality is a decision, not a default

Read `.legal-kit/project.md` for the project's confidentiality setting.

**If the project is client-confidential, stop and ask.** Delivering to Google
Docs puts client material on a third-party service. That can be entirely proper,
and it is the lawyer's call, not the tool's:

> This matter is marked client-confidential. Delivering to Google Docs uploads
> it to Google. Do you want that for this document, or should I produce a local
> `.docx` instead?

`deliver_doc.py --target docx` produces the file without uploading anything.

**If the user is on the roll of advocates,** the duty under § 21 of Act No.
85/1996 Coll. is theirs and the question is a professional one. Ask it once per
project, not once per document, and record the answer in `.legal-kit/project.md`.

### 2. Every citation goes through `legal_cite` first

This is the rule that makes a legal document different from any other document,
and the delivery plugin has no way to know it.

`legal_cite` returns a ready-to-paste markdown link. Drive converts markdown
natively, so this in the source file:

```markdown
[§ 58 of Act No. 121/2000 Coll.](https://www.e-sbirka.cz/eli/cz/sb/2000/121/2025-07-01)
```

becomes a live hyperlink in the Doc, and the reader can check the provision in
one click. That is what replaces a bibliography entry for legislation and case
law: a link to e-Sbírka, EUR-Lex or the court's own database beats a citation
the reader has to go and look up.

**A citation that has not been through `legal_cite` does not go in a draft.**
Before delivering, check every provision reference in the document:

- Is the instrument named in full on first mention?
- Is the operative wording quoted, not paraphrased?
- Is there a link, and a version date?
- For historical facts, was `as_of` used?

If the document has a citation you cannot verify, say so in the delivery message
rather than delivering silently.

### 3. Language

Czech deliverables are drafted in Czech, in full, never translated from an
English draft. When you deliver one, summarise it in English in the same message
so the user can check it without re-reading the Czech.

---

## Delivering

With `gdocs-kit`, follow its `gdoc-pipeline` skill. Two things legal work adds:

**Always update the existing Doc.** `--update-doc <DOC_ID>` keeps the Doc ID, the
comment threads and every share link. Creating a second Doc orphans the review
history, and in a contract negotiation that history is the record of what was
agreed and when. Never create a second Doc for a new version of the same
instrument.

**Record the Doc ID where this project keeps its notes.** gdocs-kit asks you to
put it "wherever the project keeps its notes"; here that is
`.legal-kit/project.md`. Add a delivery table and keep it current:

```markdown
## Deliveries

| Document | Doc ID | Version | Delivered | Status |
| --- | --- | --- | --- | --- |
| Smlouva o dílo, Acme | 1a2b3c... | v3 | 2026-09-16 | with counterparty |
```

Without the ID the next version cannot target the right document, and the
fallback is creating a second one, which is the thing to avoid.

---

## Working from comments

The reviewer's comments are the instruction. The rule here is the same one that
governs every edit in this workspace, and it matters more in a legal document
than a general one:

**Change the commented span. Leave everything else alone, including edits the
reviewer made themselves.** Never rewrite a whole document to address one
comment. In a contract, an unrequested change to a clause nobody commented on is
a change to the parties' bargain, and it can pass review unnoticed precisely
because nobody was looking at it.

The revision flow, in order:

1. **Read the comments with their anchors.** The anchor text is what the comment
   is actually about. A comment whose anchor no longer exists in the body means
   the text was edited after the comment was written, and it needs reading in
   context rather than applying blind.
2. **Pull the reviewer's own edits into the local draft first.** An update
   replaces content wholesale, so delivering before reconciling overwrites
   whatever they changed in the Doc.
3. **For each comment, decide and say which:** applied, applied differently, or
   not applied and why. A comment declined silently reads as a comment missed.
4. **Re-verify any citation you touched.** If a comment moved a provision
   reference, run `legal_cite` on it again before redelivering.
5. **Reply on the thread and resolve it** as part of the same edit, so the
   reviewer sees what happened where they asked.

**A comment that asks a legal question is not an edit instruction.** If a
reviewer writes "are we sure this survives § 1796?", that is research, not a
redline. Answer it properly, with the provision quoted, before changing anything.

---

## References, and what belongs in Zotero

The division is sharp, and it is the opposite of the academic habit:

| Material | Where it goes |
| --- | --- |
| Legislation, Czech or EU | **Not in Zotero.** A `legal_cite` link to e-Sbírka or EUR-Lex |
| Case law | **Not in Zotero.** A link to the official database, with the ECLI |
| Regulator guidance with a stable URL | Either; the link is usually enough |
| Commentary, textbooks, journal articles | **Zotero**, cited author-year |
| Regulator PDFs worth keeping | **Zotero**, with the date retrieved |

The reason is that a statute has an authoritative, versioned, permanent URL, and
a bibliography entry for it is strictly worse: it cannot tell the reader which
consolidated version was read, and it cannot be clicked. Commentary has no such
URL, which is exactly what a reference manager is for.

With `zotero-kit` installed, use its `zotero-library` skill. Before adding
anything, look at what is already there: a colleague's collection is what they
expect to see cited.

**Read before you write** applies with force in legal work. If the library
already holds a commentary on the provision in question, use it rather than
finding a different one that says the same thing.

---

## When none of this is installed

Everything above degrades to: write the document, keep it local, run every
citation through `legal_cite`, and hand the user the file path. The research is
unaffected. Only the delivery loop is.
