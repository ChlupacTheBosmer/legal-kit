#!/bin/sh
# Start the lex MCP server, installing its two dependencies on first run.
#
# Claude Code starts MCP servers before any skill or command can run, so there
# is no earlier moment to install anything. Doing it here means a fresh install
# works without the user being told to go and run something first. The cost is
# one slow first start, roughly the time npm takes to fetch two packages.
#
# Everything writable lives outside the plugin. Plugin installs are versioned
# (~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/), so an upgrade is
# a new directory: anything written inside would be orphaned by it. Indexes and
# the HTTP cache go to ~/.legal-kit, which survives upgrades.

set -e

ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
SERVER="$ROOT/mcp/lex"
DATA="${LEGAL_KIT_DATA:-$HOME/.legal-kit}"

mkdir -p "$DATA/data" "$DATA/cache"

# Where the server keeps its indexes and its HTTP cache. Set here rather than in
# .mcp.json so that ~ is expanded by the shell and LEGAL_KIT_DATA can override.
LEX_MCP_DATA_DIR="$DATA/data"
LEX_MCP_CACHE_DIR="$DATA/cache"
export LEX_MCP_DATA_DIR LEX_MCP_CACHE_DIR
export LEX_MCP_CACHE_TTL_MS="${LEX_MCP_CACHE_TTL_MS:-43200000}"
export NODE_NO_WARNINGS=1

if [ ! -d "$SERVER/node_modules/@modelcontextprotocol/sdk" ]; then
  # stderr, never stdout: stdout is the MCP protocol channel and anything
  # written to it that is not a JSON-RPC message breaks the session.
  echo "legal-kit: first run, installing the server's two dependencies..." >&2
  if ! command -v npm >/dev/null 2>&1; then
    echo "legal-kit: npm not found. Install Node 22 or newer, then restart Claude Code." >&2
    exit 1
  fi
  ( cd "$SERVER" && npm install --omit=dev --no-audit --no-fund --silent >&2 ) || {
    echo "legal-kit: npm install failed. Run it by hand in $SERVER and restart Claude Code." >&2
    exit 1
  }
  echo "legal-kit: dependencies installed." >&2
fi

# Is this a configured legal project?
#
# Decided here rather than in the server because the shell knows the session's
# working directory. Walk up a few levels so a session started in a subfolder of
# a matter still counts; stop at the home directory, since a marker there would
# switch every session on.
if [ "${LEGAL_KIT_SCOPE:-}" = "always" ]; then
  LEGAL_KIT_ACTIVE=1
else
  LEGAL_KIT_ACTIVE=0
  dir="$PWD"
  for _ in 1 2 3 4 5; do
    [ "$dir" = "$HOME" ] && break
    [ "$dir" = "/" ] && break
    if [ -f "$dir/.legal-kit/project.md" ]; then LEGAL_KIT_ACTIVE=1; break; fi
    dir="$(dirname "$dir")"
  done
fi
export LEGAL_KIT_ACTIVE

exec node "$SERVER/server.js"
