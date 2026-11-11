#!/usr/bin/env bash
# Portable hook entry: works from a git clone or from an npm package install.
# Do not hard-code a machine-specific Node path.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DEPLOY_CHECK_ROOT="${DEPLOY_CHECK_ROOT:-$ROOT}"
export DEPLOY_CHECK_MODE="${DEPLOY_CHECK_MODE:-advisory}"

# Prints a node path on stdout, or returns 1. Must not print the fail-open JSON:
# this function is used inside $(...), and exit inside that subshell does not stop the script.
resolve_node() {
  if [[ -n "${DEPLOY_CHECK_NODE:-}" && -x "${DEPLOY_CHECK_NODE}" ]]; then
    printf '%s\n' "$DEPLOY_CHECK_NODE"
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  # DEPLOY_CHECK_NO_FALLBACK=1 is a test seam so CI can simulate a machine with no Node.
  if [[ "${DEPLOY_CHECK_NO_FALLBACK:-}" == "1" ]]; then
    return 1
  fi
  # Optional fallbacks (still user-agnostic): Homebrew / common version managers
  local candidate
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "${HOME:-}/.nvm/current/bin/node" \
    "${HOME:-}/.local/share/fnm/aliases/default/bin/node"
  do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

if ! NODE="$(resolve_node)"; then
  echo "deploy-check: node not found (need Node >= 22). Set DEPLOY_CHECK_NODE or put node on PATH." >&2
  # Fail open for hook hosts that treat non-zero as hard deny (e.g. Copilot preToolUse).
  echo '{"permission":"allow","permissionDecision":"allow","permissionDecisionReason":"deploy-check: node not found (fail open)","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"deploy-check: node not found (fail open)"}}'
  exit 0
fi
exec "$NODE" "$ROOT/hooks/bridge.mjs"
