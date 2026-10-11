#!/usr/bin/env bash
# Installs (or updates) the usage-panel mod for Claude Code on this machine.
#
#   gh api repos/jamesnguyen1309/claude-usage/contents/install.sh -H "Accept: application/vnd.github.raw" | bash
#
# SCOPE=user (default: every session on this machine), project or local.
set -euo pipefail

REPO="jamesnguyen1309/claude-usage"
MARKETPLACE="claude-usage"
PLUGIN="usage-panel"
SCOPE="${SCOPE:-user}"

say() { printf '\033[1;35m▸\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

command -v claude >/dev/null || die "Claude Code isn't installed: https://code.claude.com/docs/en/setup"
# The repository is private: git must be able to read it (gh auth login sets that up).
if command -v gh >/dev/null && ! gh auth status >/dev/null 2>&1; then
  die "Sign in to GitHub first: gh auth login"
fi

if claude plugin marketplace list 2>/dev/null | grep -q "$MARKETPLACE"; then
  say "Refreshing the $MARKETPLACE marketplace"
  claude plugin marketplace update "$MARKETPLACE"
else
  say "Adding the $MARKETPLACE marketplace ($REPO)"
  claude plugin marketplace add "$REPO"
fi

if claude plugin list 2>/dev/null | grep -q "$PLUGIN@$MARKETPLACE"; then
  say "Updating $PLUGIN"
  claude plugin update "$PLUGIN@$MARKETPLACE"
else
  say "Installing $PLUGIN ($SCOPE scope)"
  claude plugin install "$PLUGIN@$MARKETPLACE" --scope "$SCOPE"
fi

say "Done. Start a new Claude Code session: the Usage pane opens on its own (/usage-panel shows or hides it)."
