#!/usr/bin/env bash
# Point production aliases at the latest Ready Production deployment
# for Vercel project "trackdailyexpense".
set -euo pipefail

PROJECT="${VERCEL_PROJECT:-trackdailyexpense}"
ALIASES=(
  "trackexpense.vercel.app"
  "expense-tracker-kalashjain1010s-projects.vercel.app"
)

echo "Looking up latest Ready Production deployment for ${PROJECT}…"

# Prefer vercel ls JSON; fall back to parsing table output.
DEPLOY_URL=""
if LS_JSON=$(vercel ls "$PROJECT" --prod --json 2>/dev/null); then
  DEPLOY_URL=$(
    printf '%s' "$LS_JSON" | node -e '
      let s = "";
      process.stdin.on("data", (c) => (s += c));
      process.stdin.on("end", () => {
        try {
          const data = JSON.parse(s);
          const list = Array.isArray(data) ? data : data.deployments || data || [];
          const ready = list.find(
            (d) =>
              (d.state === "READY" || d.readyState === "READY") &&
              (d.target === "production" || !d.target || d.target === null)
          ) || list.find((d) => d.state === "READY" || d.readyState === "READY");
          if (!ready) process.exit(2);
          const url = ready.url || ready.urlHostname || "";
          if (!url) process.exit(3);
          process.stdout.write(url.startsWith("http") ? url : `https://${url}`);
        } catch {
          process.exit(1);
        }
      });
    ' 2>/dev/null || true
  )
fi

if [[ -z "${DEPLOY_URL}" ]]; then
  # Table / text fallback: first Ready production line with a *.vercel.app host
  DEPLOY_HOST=$(
    vercel ls "$PROJECT" 2>/dev/null \
      | awk '
          /Ready/ && /Production|production/ {
            for (i = 1; i <= NF; i++) {
              if ($i ~ /\.vercel\.app/) { print $i; exit }
            }
          }
        ' \
      || true
  )
  if [[ -n "${DEPLOY_HOST}" ]]; then
    DEPLOY_HOST="${DEPLOY_HOST#https://}"
    DEPLOY_HOST="${DEPLOY_HOST#http://}"
    DEPLOY_URL="https://${DEPLOY_HOST}"
  fi
fi

if [[ -z "${DEPLOY_URL}" ]]; then
  # Last resort: inspect project and ask vercel for the production URL
  INSPECT=$(vercel inspect "$PROJECT" --wait=false 2>/dev/null || vercel inspect "$PROJECT" 2>/dev/null || true)
  DEPLOY_HOST=$(
    printf '%s' "$INSPECT" \
      | awk '
          /https?:\/\/[^ ]+\.vercel\.app/ {
            if (match($0, /https?:\/\/[^ ]+\.vercel\.app/)) {
              print substr($0, RSTART, RLENGTH); exit
            }
          }
        ' \
      || true
  )
  if [[ -n "${DEPLOY_HOST}" ]]; then
    DEPLOY_URL="$DEPLOY_HOST"
  fi
fi

if [[ -z "${DEPLOY_URL}" ]]; then
  echo "error: could not find a Ready Production deployment for ${PROJECT}" >&2
  echo "Try: vercel ls ${PROJECT}" >&2
  exit 1
fi

# Normalize to bare host for alias set (vercel accepts URL or hostname)
DEPLOY_HOST="${DEPLOY_URL#https://}"
DEPLOY_HOST="${DEPLOY_HOST#http://}"
DEPLOY_HOST="${DEPLOY_HOST%%/*}"

echo "Latest production deployment: https://${DEPLOY_HOST}"
echo

FAILED=0
for alias in "${ALIASES[@]}"; do
  echo "→ vercel alias set ${DEPLOY_HOST} ${alias}"
  if vercel alias set "$DEPLOY_HOST" "$alias"; then
    echo "  OK: https://${alias}"
  else
    echo "  WARN: failed to alias ${alias} (optional aliases may be skipped)" >&2
    # First alias is required; second is optional
    if [[ "$alias" == "trackexpense.vercel.app" ]]; then
      FAILED=1
    fi
  fi
  echo
done

if [[ "$FAILED" -ne 0 ]]; then
  echo "error: required alias trackexpense.vercel.app failed" >&2
  exit 1
fi

echo "Done. Production aliases now point at https://${DEPLOY_HOST}"
