#!/usr/bin/env python3
"""
One-time Google authorisation for tools/gdoc.py.

Writes a refresh token to ~/.claude_google_token.json with Drive and Docs
scopes. Run it once; gdoc.py refreshes the token itself from then on.

    python3 -m pip install -r tools/requirements.txt
    python3 tools/google-auth.py path/to/client_secret.json

Getting the client secret is the part Google makes you do by hand, and there is
no way around it:

  1. console.cloud.google.com -> create a project (any name)
  2. APIs & Services -> Library -> enable "Google Docs API" and "Google Drive API"
  3. APIs & Services -> OAuth consent screen -> External -> fill in the required
     fields -> add yourself under "Test users"
  4. APIs & Services -> Credentials -> Create credentials -> OAuth client ID
     -> Application type: **Desktop app**
  5. Download the JSON and pass its path to this script

Scopes requested, and why each is needed:

  drive.file       create documents and open ones this tool created.
                   Deliberately NOT full Drive access: this tool cannot see
                   documents you did not make with it or explicitly open.
  documents        read and edit document content, comments and suggestions.

Nothing is uploaded anywhere except Google. The token stays on this machine.
"""
import json
import pathlib
import sys

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    sys.exit(
        "Missing Python dependencies.\n"
        "  python3 -m pip install -r tools/requirements.txt"
    )

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
]
TOKEN_PATH = pathlib.Path.home() / ".claude_google_token.json"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(f"usage: {sys.argv[0]} <client_secret.json>\n\n{__doc__}")

    secret = pathlib.Path(sys.argv[1]).expanduser()
    if not secret.is_file():
        sys.exit(f"No such file: {secret}")

    if TOKEN_PATH.exists():
        answer = input(f"{TOKEN_PATH} already exists. Replace it? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            sys.exit("Left alone.")

    flow = InstalledAppFlow.from_client_secrets_file(str(secret), SCOPES)
    # Opens a browser and listens on localhost for the redirect.
    creds = flow.run_local_server(port=0, prompt="consent")

    if not creds.refresh_token:
        sys.exit(
            "Google returned no refresh token, so the credential would expire in an\n"
            "hour. This happens when the app was already authorised. Revoke it at\n"
            "myaccount.google.com/permissions and run this again."
        )

    TOKEN_PATH.write_text(json.dumps({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes or SCOPES),
    }, indent=1))
    TOKEN_PATH.chmod(0o600)

    print(f"\nWrote {TOKEN_PATH} (readable only by you).")
    print("Check it with:  python3 tools/gdoc.py list")


if __name__ == "__main__":
    main()
