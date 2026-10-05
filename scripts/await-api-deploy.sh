#!/usr/bin/env bash
# Gate for deploy-worker.yml: the worker must never go live ahead of the API pipeline for the same
# commit, because the API pipeline is the only thing that migrates the schema (TDD §15.1). A
# worker built from a commit that expects a new column would otherwise run against the old one.
#
#   - No `api.yml` run for the commit (a worker-only change)      -> nothing to wait for, pass.
#   - `api.yml` ran: wait for it to finish; it must have passed.
#   - Then wait for `deploy-api.yml` on that commit to finish; it must have passed.
#
# Fails closed: any other outcome, any `gh` error and any timeout means the worker does not deploy.
set -euo pipefail
: "${GH_TOKEN:?set GH_TOKEN}"
: "${GH_REPO:?set GH_REPO}"
: "${SHA:?set SHA}"

POLL_SECONDS="${POLL_SECONDS:-20}" # overridable so the gate can be exercised without waiting
MAX_POLLS=75 # 25 minutes: the API's CI run plus its deploy
# Consecutive empty listings before "no api.yml run" is believed: the listing is eventually
# consistent, and a missing run must not be mistaken for a worker-only change.
EMPTY_POLLS_BEFORE_NONE=3

# Prints "<status>/<conclusion>" for the newest push run of a workflow on this commit, or nothing
# when there is none. `conclusion` is empty until the run completes. A `gh` failure (auth, rate
# limit, network) fails the call: bash drops `set -e` inside `$(...)`, so the caller must check.
run_state() {
  gh run list --workflow "$1" --commit "$SHA" --event push --limit 1 --json status,conclusion \
    --jq '.[0] // empty | "\(.status)/\(.conclusion)"'
}

# Waits until the workflow has a completed run on this commit; echoes its conclusion.
# $2 = "optional": no run at all is a valid answer (echoes "none") instead of a wait.
await_completed() {
  local workflow="$1" mode="${2:-required}" state empty_polls=0
  for _ in $(seq 1 "$MAX_POLLS"); do
    if ! state="$(run_state "$workflow")"; then
      echo "gh failed while listing $workflow runs for $SHA" >&2
      return 1
    fi
    if [ -z "$state" ]; then
      empty_polls=$((empty_polls + 1))
      if [ "$mode" = "optional" ] && [ "$empty_polls" -ge "$EMPTY_POLLS_BEFORE_NONE" ]; then
        echo none
        return 0
      fi
    else
      empty_polls=0
      if [ "${state%%/*}" = "completed" ]; then
        echo "${state#*/}"
        return 0
      fi
    fi
    sleep "$POLL_SECONDS"
  done
  echo "timed out waiting for $workflow on $SHA" >&2
  return 1
}

# The assignments run in this shell, not a subshell, so a failing call stops the script here.
api_ci="$(await_completed api.yml optional)"
if [ "$api_ci" = "none" ]; then
  echo "No api.yml run for $SHA: worker-only change, nothing to wait for."
  exit 0
fi
if [ "$api_ci" != "success" ]; then
  echo "api.yml concluded '$api_ci' for $SHA; not deploying the worker." >&2
  exit 1
fi

api_deploy="$(await_completed deploy-api.yml)"
if [ "$api_deploy" != "success" ]; then
  echo "deploy-api.yml concluded '$api_deploy' for $SHA; not deploying the worker." >&2
  exit 1
fi

echo "API pipeline for $SHA is deployed and migrated; the worker may deploy."
