#!/usr/bin/env bash
#
# verify-cache-purge-wired.sh — static check that every SSH deploy script
# in scripts/ invokes purge-cache.sh as its final step.
#
# Run in CI (.github/workflows/regression.yml). Fails the build if a deploy
# script ships without the purge call, so the user-rule "always purge after
# SSH deploy" cannot silently be skipped.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
FAIL=0

shopt -s nullglob
for f in "$SCRIPTS_DIR"/deploy*.sh "$SCRIPTS_DIR"/ssh-*.sh; do
  [ -f "$f" ] || continue
  if ! grep -qE 'purge-cache\.sh' "$f"; then
    echo "FAIL: $f does not call scripts/purge-cache.sh" >&2
    FAIL=1
  fi
done

if [ $FAIL -ne 0 ]; then
  echo "" >&2
  echo "Every SSH deploy script must end with: bash scripts/purge-cache.sh" >&2
  echo "See mem://rules/bugfix-definition-of-done (item #4)." >&2
  exit 1
fi

echo "verify-cache-purge-wired: ok"
