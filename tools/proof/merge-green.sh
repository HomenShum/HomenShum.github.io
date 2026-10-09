#!/usr/bin/env bash
# Squash-merges each Repo/PR only if its head commit is fully verified right now:
#   - at least one check run exists, every check run is completed, and each concluded
#     success / skipped / neutral;
#   - every Actions workflow run for that head SHA is completed (catches jobs not yet
#     registered as check runs).
# `gh pr checks` alone is not enough: right after a push it can list no pending checks
# while queued runs exist (this merged NodeGraph#3 early on 2026-10-07).
# usage: tools/proof/merge-green.sh Repo/123 [Repo/456 ...]
for pr in "$@"; do
  r=${pr%/*}; n=${pr#*/}
  read -r state sha < <(gh pr view "$n" -R "HomenShum/$r" --json state,headRefOid --jq '.state + " " + .headRefOid')
  [ "$state" != "OPEN" ] && { echo "$r #$n already $state"; continue; }
  runs=$(gh api "repos/HomenShum/$r/commits/$sha/check-runs?per_page=100" --jq '[.check_runs | length, ([.[] | select(.status != "completed" or (.conclusion | IN("success","skipped","neutral") | not))] | length)] | @tsv')
  total=${runs%%$'\t'*}; notok=${runs##*$'\t'}
  wf=$(gh api "repos/HomenShum/$r/actions/runs?head_sha=$sha&per_page=100" --jq '[.workflow_runs[] | select(.status != "completed")] | length')
  if [ "$total" -ge 1 ] && [ "$notok" = "0" ] && [ "$wf" = "0" ]; then
    # --match-head-commit: merge exactly the commit whose checks were read, or nothing.
    gh pr merge "$n" -R "HomenShum/$r" --squash --delete-branch --match-head-commit "$sha" >/dev/null 2>&1
    echo "$r #$n -> $(gh pr view "$n" -R "HomenShum/$r" --json state,mergeCommit --jq '.state + " " + (.mergeCommit.oid // "")[0:7]') ($total checks green)"
  else
    echo "$r #$n held: $total check runs, $notok not green, $wf workflow runs unfinished"
  fi
done
