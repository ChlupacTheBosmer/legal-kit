#!/usr/bin/env python3
"""
Google Docs toolkit for drafting and revising legal documents.

    python3 tools/gdoc.py read <DOC_ID> [--json] [--include-resolved]
    python3 tools/gdoc.py comments <DOC_ID> [--json] [--include-resolved]
    python3 tools/gdoc.py edit <DOC_ID> --old '<json str>' --new '<json str>'
                                        [--resolve-comment ID] [--reply TEXT]
    python3 tools/gdoc.py create --title T --from-md FILE [--folder FOLDER_ID]
    python3 tools/gdoc.py link <DOC_ID> --text '<json str>' --url URL
    python3 tools/gdoc.py list [--query Q] [--limit N]

Why this exists alongside the google-workspace MCP server: the MCP exposes
comments, but not Google Docs *suggestions* (tracked changes), and it cannot
resolve a comment as part of an edit. Both matter when revising a draft someone
has marked up. This is modelled on the working scripts in
~/gacr/claude-scientific-writer (scripts/revise_doc.py, scripts/apply_edit.py).

Credentials: reuses ~/.claude_google_token.json (Drive + Docs scopes, with a
refresh token), the same file the scientific-writer project uses. Nothing is
sent anywhere except googleapis.com.
"""

import sys, json, pathlib, argparse, re

sys.path.insert(0, "/Users/chlup/Library/Python/3.11/lib/python/site-packages")

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"]
TOKEN_PATH = pathlib.Path.home() / ".claude_google_token.json"


def services():
    if not TOKEN_PATH.exists():
        sys.exit(f"No Google token at {TOKEN_PATH}. See docs/google-docs-workflow.md.")
    creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        TOKEN_PATH.write_text(creds.to_json())
    return build("drive", "v3", credentials=creds), build("docs", "v1", credentials=creds)


def doc_id_of(s):
    """Accept a bare id or any Docs/Drive URL."""
    m = re.search(r"/d/([\w-]{20,})", s)
    return m.group(1) if m else s


def _walk(elements):
    """Yield every structural element, descending into tables.

    Tables matter: `replaceAllText` operates on the whole document, so text that
    plain_text() cannot see is still edited. Missing table content made the
    uniqueness guard in `edit` report hits==1 for a target appearing once in a
    paragraph and once in a table — and then silently change both.
    """
    for elem in elements or []:
        yield elem
        table = elem.get("table")
        if table:
            for row in table.get("tableRows", []):
                for cell in row.get("tableCells", []):
                    yield from _walk(cell.get("content", []))


def plain_text(doc):
    out = []
    for elem in _walk(doc.get("body", {}).get("content", [])):
        for run in elem.get("paragraph", {}).get("elements", []):
            out.append(run.get("textRun", {}).get("content", ""))
    return "".join(out)


def suggestions(doc):
    """Tracked changes. The MCP server does not surface these."""
    found = []
    for elem in _walk(doc.get("body", {}).get("content", [])):
        for run in elem.get("paragraph", {}).get("elements", []):
            tr = run.get("textRun", {})
            content = tr.get("content", "")
            if not content.strip():
                continue
            if tr.get("suggestedInsertionIds"):
                found.append({"id": tr["suggestedInsertionIds"][0], "type": "insertion", "content": content})
            if tr.get("suggestedDeletionIds"):
                found.append({"id": tr["suggestedDeletionIds"][0], "type": "deletion", "content": content})
    return found


def comments(drive, doc_id, include_resolved=False):
    """Comment threads with the anchored span located in the document text."""
    items, token = [], None
    while True:
        resp = drive.comments().list(
            fileId=doc_id,
            fields="nextPageToken,comments(id,content,resolved,createdTime,modifiedTime,"
                   "author(displayName),quotedFileContent(value),replies(id,content,author(displayName),createdTime))",
            includeDeleted=False,
            pageSize=100,
            pageToken=token,
        ).execute()
        items.extend(resp.get("comments", []))
        token = resp.get("nextPageToken")
        if not token:
            break
    if not include_resolved:
        items = [c for c in items if not c.get("resolved")]
    return items


def locate(text, quoted):
    """Character offsets of the anchored text. Ambiguity is reported, not hidden."""
    if not quoted:
        return []
    return [m.start() for m in re.finditer(re.escape(quoted), text)]


def cmd_read(args):
    drive, docs = services()
    did = doc_id_of(args.doc_id)
    doc = docs.documents().get(documentId=did, includeTabsContent=False).execute()
    text = plain_text(doc)
    cs = comments(drive, did, args.include_resolved)
    payload = {
        "document_id": did,
        "title": doc.get("title"),
        "url": f"https://docs.google.com/document/d/{did}/edit",
        "characters": len(text),
        "comments": [],
        "suggestions": suggestions(doc),
        "full_text": text,
    }
    for c in cs:
        quoted = (c.get("quotedFileContent") or {}).get("value", "")
        offs = locate(text, quoted)
        payload["comments"].append({
            "id": c["id"],
            "author": (c.get("author") or {}).get("displayName"),
            "created": c.get("createdTime"),
            "resolved": bool(c.get("resolved")),
            "comment": c.get("content", ""),
            "anchor_text": quoted,
            "offsets": offs,
            "anchor_status": "unique" if len(offs) == 1 else ("not found in body" if not offs else f"ambiguous ({len(offs)} matches)"),
            "replies": [{"author": (r.get("author") or {}).get("displayName"), "content": r.get("content", "")} for r in c.get("replies", [])],
        })

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=1))
        return

    print(f"# {payload['title']}\n{payload['url']}\n{payload['characters']} characters\n")
    if payload["suggestions"]:
        print(f"## Tracked changes ({len(payload['suggestions'])})\n")
        for s in payload["suggestions"]:
            print(f"- [{s['type']}] {s['content'].strip()[:160]}")
        print()
    print(f"## Comments ({len(payload['comments'])})\n")
    for c in payload["comments"]:
        print(f"### {c['id']} — {c['author']} ({c['anchor_status']})")
        if c["anchor_text"]:
            print(f"anchored on: “{c['anchor_text'][:300]}”")
        print(f"comment: {c['comment']}")
        for r in c["replies"]:
            print(f"  reply ({r['author']}): {r['content']}")
        print()
    print("## Full text\n")
    print(text)


def cmd_comments(args):
    drive, docs = services()
    did = doc_id_of(args.doc_id)
    doc = docs.documents().get(documentId=did).execute()
    text = plain_text(doc)
    out = []
    for c in comments(drive, did, args.include_resolved):
        quoted = (c.get("quotedFileContent") or {}).get("value", "")
        out.append({
            "id": c["id"], "author": (c.get("author") or {}).get("displayName"),
            "resolved": bool(c.get("resolved")), "comment": c.get("content", ""),
            "anchor_text": quoted, "offsets": locate(text, quoted),
        })
    print(json.dumps(out, ensure_ascii=False, indent=1) if args.json
          else "\n".join(f"[{c['id']}] {c['author']}: {c['comment']}\n    on: “{c['anchor_text'][:200]}”" for c in out))


def cmd_edit(args):
    drive, docs = services()
    did = doc_id_of(args.doc_id)
    old, new = json.loads(args.old), json.loads(args.new)

    doc = docs.documents().get(documentId=did).execute()
    hits = plain_text(doc).count(old)
    if hits == 0:
        sys.exit(f"Text not found, nothing changed:\n  {old[:200]!r}")
    if hits > 1 and not args.all:
        sys.exit(f"Text occurs {hits} times. Pass --all to replace every occurrence, "
                 f"or extend the snippet until it is unique.")

    res = docs.documents().batchUpdate(
        documentId=did,
        body={"requests": [{"replaceAllText": {"containsText": {"text": old, "matchCase": True}, "replaceText": new}}]},
    ).execute()
    changed = res.get("replies", [{}])[0].get("replaceAllText", {}).get("occurrencesChanged", 0)
    print(f"replaced {changed} occurrence(s)")

    if args.reply and not args.resolve_comment:
        sys.exit("--reply needs --resolve-comment: a reply is posted into a specific thread.")
    if args.resolve_comment:
        # One reply carrying both the text and the resolve, so the thread does not
        # get a redundant "Done." after a substantive reply.
        drive.replies().create(
            fileId=did, commentId=args.resolve_comment,
            body={"content": args.reply or "Done.", "action": "resolve"}, fields="id",
        ).execute()
        print(f"resolved comment {args.resolve_comment}" + (" with reply" if args.reply else ""))


def cmd_create(args):
    drive, _ = services()
    src = pathlib.Path(args.from_md)
    if not src.exists():
        sys.exit(f"No such file: {src}")
    body = {"name": args.title, "mimeType": "application/vnd.google-apps.document"}
    if args.folder:
        body["parents"] = [args.folder]
    # Drive converts text/markdown natively: headings, bold, lists, tables and —
    # the part that matters for citations — [text](url) becomes a real hyperlink.
    f = drive.files().create(
        body=body,
        media_body=MediaFileUpload(str(src), mimetype="text/markdown", resumable=False),
        fields="id,name,webViewLink",
    ).execute()
    print(json.dumps({"document_id": f["id"], "title": f["name"], "url": f["webViewLink"]}, indent=1))


def cmd_link(args):
    """Turn an existing run of text into a hyperlink (for citations added later)."""
    _, docs = services()
    did = doc_id_of(args.doc_id)
    target = json.loads(args.text)
    doc = docs.documents().get(documentId=did).execute()

    ranges = []
    for elem in _walk(doc.get("body", {}).get("content", [])):
        for run in elem.get("paragraph", {}).get("elements", []):
            content = run.get("textRun", {}).get("content", "")
            if not content:
                continue
            start = run.get("startIndex", 0)
            idx = content.find(target)
            if idx != -1:
                ranges.append({"startIndex": start + idx, "endIndex": start + idx + len(target)})
    if not ranges:
        sys.exit(f"Text not found in a single run: {target[:120]!r}. Links can only be applied to text inside one run.")
    reqs = [{"updateTextStyle": {"range": r, "textStyle": {"link": {"url": args.url}},
                                "fields": "link"}} for r in ranges]
    docs.documents().batchUpdate(documentId=did, body={"requests": reqs}).execute()
    print(f"linked {len(ranges)} occurrence(s) to {args.url}")


def cmd_list(args):
    drive, _ = services()
    q = "mimeType='application/vnd.google-apps.document' and trashed=false"
    if args.query:
        q += f" and name contains '{args.query}'"
    r = drive.files().list(q=q, pageSize=args.limit, orderBy="modifiedTime desc",
                           fields="files(id,name,modifiedTime,webViewLink)").execute()
    for f in r.get("files", []):
        print(f"{f['modifiedTime'][:10]}  {f['id']}  {f['name']}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("read"); r.add_argument("doc_id"); r.add_argument("--json", action="store_true")
    r.add_argument("--include-resolved", action="store_true"); r.set_defaults(func=cmd_read)

    c = sub.add_parser("comments"); c.add_argument("doc_id"); c.add_argument("--json", action="store_true")
    c.add_argument("--include-resolved", action="store_true"); c.set_defaults(func=cmd_comments)

    e = sub.add_parser("edit"); e.add_argument("doc_id")
    e.add_argument("--old", required=True, help="JSON-encoded string to find")
    e.add_argument("--new", required=True, help="JSON-encoded replacement")
    e.add_argument("--all", action="store_true", help="allow replacing every occurrence")
    e.add_argument("--resolve-comment", default=None)
    e.add_argument("--reply", default=None, help="reply posted before resolving")
    e.set_defaults(func=cmd_edit)

    n = sub.add_parser("create"); n.add_argument("--title", required=True)
    n.add_argument("--from-md", required=True); n.add_argument("--folder", default=None)
    n.set_defaults(func=cmd_create)

    l = sub.add_parser("link"); l.add_argument("doc_id")
    l.add_argument("--text", required=True, help="JSON-encoded text to linkify")
    l.add_argument("--url", required=True); l.set_defaults(func=cmd_link)

    ls = sub.add_parser("list"); ls.add_argument("--query", default=None)
    ls.add_argument("--limit", type=int, default=20); ls.set_defaults(func=cmd_list)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
