#!/bin/sh
# Load the legal-kit sourcing rules, but only where they apply.
#
# These rules are the product: without them the assistant answers a legal
# question from memory, which is the exact failure the whole toolset exists to
# prevent. A skill the model may or may not choose to load is not enough for
# that, so they are injected at session start instead.
#
# They are injected ONLY in a project that has been through
# /legal-kit:setup-project. The plugin installs globally and most projects are
# not legal work; firing everywhere would put a page of Czech citation rules
# into every unrelated session.

set -e
ROOT="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"

[ -f "./.legal-kit/project.md" ] || exit 0

cat "$ROOT/rules/core.md"

# The profile decides register, standing and how much background to carry, so it
# travels with the rules rather than waiting to be looked up.
PROFILE="$HOME/.claude/plugins/config/legal-kit/profile.md"
if [ -f "$PROFILE" ]; then
  printf '\n---\n\n# Your profile\n\n'
  cat "$PROFILE"
else
  printf '\n---\n\nNo legal-kit profile found. Run /legal-kit:setup: without it the\n'
  printf 'register, the standing and the privilege position are all guesses.\n'
fi
