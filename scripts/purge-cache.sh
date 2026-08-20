#!/usr/bin/env bash
#
# purge-cache.sh — deterministic cache flush for SiteGround / WordPress
# deploys. Called as the final step of every SSH deploy.
#
# Replaces the manual "purge site cache after SSH deploy" user rule with an
# automated step. Logs to .deploy/purge-log.json for the regression test
# (tests/regression/cache/deploy-purge-marker.test.ts).
#
# Required env (from secrets, never hardcoded):
#   REBAR_SSH_HOST         — e.g. c53779.sgvps.net
#   REBAR_SSH_USER         — e.g. u11-f4kfrvt8x4uk
#   REBAR_SSH_PORT         — e.g. 18765
#   REBAR_SSH_PRIVATE_KEY  — PEM body (multi-line or single-line; normalized)
#   REBAR_WP_PURGE_URL     — optional: WP REST endpoint that flushes object cache
#   REBAR_WP_PURGE_TOKEN   — optional: bearer token for the WP endpoint
#
# Exit codes:
#   0  — purge succeeded (or partial success with logged warning)
#   1  — missing required env / SSH failure
#   2  — log write failure

set -euo pipefail

REQUIRED=(REBAR_SSH_HOST REBAR_SSH_USER REBAR_SSH_PORT REBAR_SSH_PRIVATE_KEY)
for v in "${REQUIRED[@]}"; do
  if [ -z "${!v:-}" ]; then
    echo "purge-cache: missing required env var: $v" >&2
    exit 1
  fi
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/.deploy"
LOG_FILE="$DEPLOY_DIR/purge-log.json"
mkdir -p "$DEPLOY_DIR"

# Normalize key from single-line storage if needed.
KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE"' EXIT
chmod 600 "$KEY_FILE"
printf '%s\n' "$REBAR_SSH_PRIVATE_KEY" | sed 's/\\n/\n/g' > "$KEY_FILE"

SSH_OPTS=(-i "$KEY_FILE" -p "$REBAR_SSH_PORT" -o StrictHostKeyChecking=accept-new -o BatchMode=yes)

PURGE_STATUS="ok"
PURGE_ERROR=""

# 1. SiteGround SuperCacher purge via WP-CLI (preferred when available).
set +e
SSH_OUT=$(ssh "${SSH_OPTS[@]}" "$REBAR_SSH_USER@$REBAR_SSH_HOST" \
  "command -v wp >/dev/null 2>&1 && wp sg purge 2>&1 || echo 'wp-cli-unavailable'" 2>&1)
SSH_RC=$?
set -e

if [ $SSH_RC -ne 0 ]; then
  PURGE_STATUS="ssh_failed"
  PURGE_ERROR="$SSH_OUT"
fi

# 2. Optional WP REST flush (object cache, page cache).
if [ -n "${REBAR_WP_PURGE_URL:-}" ]; then
  set +e
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "$REBAR_WP_PURGE_URL" \
    -H "Authorization: Bearer ${REBAR_WP_PURGE_TOKEN:-}" \
    --max-time 30)
  set -e
  if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "204" ]; then
    PURGE_STATUS="${PURGE_STATUS}+rest_${HTTP_CODE}"
  fi
fi

COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Append-only JSON log (array of entries).
node - <<NODE
const fs = require("fs");
const p = "${LOG_FILE}";
let arr = [];
try { arr = JSON.parse(fs.readFileSync(p, "utf8")); if (!Array.isArray(arr)) arr = []; } catch {}
arr.push({
  timestamp: "${TIMESTAMP}",
  commit: "${COMMIT}",
  status: "${PURGE_STATUS}",
  error: ${PURGE_ERROR:+'`'"$PURGE_ERROR"'`'}${PURGE_ERROR:-null}
});
fs.writeFileSync(p, JSON.stringify(arr.slice(-100), null, 2));
NODE

echo "purge-cache: status=$PURGE_STATUS commit=$COMMIT"
[ "$PURGE_STATUS" = "ok" ] || echo "purge-cache: WARN: $PURGE_STATUS" >&2
exit 0
