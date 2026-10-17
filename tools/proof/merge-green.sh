#!/usr/bin/env bash
# Squash-merges each Repo/PR only if its head commit is fully verified right now:
#   - at least one check run exists, every check run is completed, and each concluded
#     success / skipped / neutral;
#   - every Actions workflow run for that head SHA is completed (catches jobs not yet
#     registered as check runs).
# `gh pr checks` alone is not enough: right after a push it can list no pending checks
# while queued runs exist (this merged NodeGraph#3 early on 2026-10-07).
# Both queries MUST paginate: per_page=100 alone hid 105 of NodeBenchAI main 8b4846ba's 205 check runs.
# usage: tools/proof/merge-green.sh Repo/123 [Repo/456 ...]   (exit 2 if any arg is not Repo/PR)
# exit 0: every PR merged, already closed, or held on checks; exit 1: a PR head was unreadable or a merge did not land; exit 2: bad arg.
rc=0
for pr in "$@"; do
  [[ $pr =~ ^[A-Za-z0-9._-]+/[0-9]+$ ]] || { echo "$pr: expected Repo/PR" >&2; rc=2; continue; }
  r=${pr%/*}; n=${pr#*/}
  read -r state sha < <(gh pr view "$n" -R "HomenShum/$r" --json state,headRefOid --jq '.state + " " + .headRefOid')
  [[ $state =~ ^(OPEN|CLOSED|MERGED)$ && $sha =~ ^[0-9a-f]{40}$ ]] || { echo "$r #$n held: could not read PR state/head sha"; rc=$((rc>1?rc:1)); continue; }
  [ "$state" != "OPEN" ] && { echo "$r #$n already $state"; continue; }
  runs=$(gh api --paginate "repos/HomenShum/$r/commits/$sha/check-runs?per_page=100" --jq '.check_runs[] | if .status == "completed" and (.conclusion | IN("success","skipped","neutral")) then "ok" else "bad" end') || { echo "$r #$n held: check-runs query failed"; continue; }
  total=$(grep -c . <<<"$runs"); notok=$(grep -c '^bad$' <<<"$runs")
  wf=$(gh api --paginate "repos/HomenShum/$r/actions/runs?head_sha=$sha&per_page=100" --jq '.workflow_runs[] | select(.status != "completed") | .id') || { echo "$r #$n held: workflow-runs query failed"; continue; }
  wf=$(grep -c . <<<"$wf")
  if [ "$total" -ge 1 ] && [ "$notok" = "0" ] && [ "$wf" = "0" ]; then
    # --match-head-commit: merge exactly the commit whose checks were read, or nothing.
    err=$(gh pr merge "$n" -R "HomenShum/$r" --squash --delete-branch --match-head-commit "$sha" 2>&1 >/dev/null)
    after=$(gh pr view "$n" -R "HomenShum/$r" --json state,mergeCommit --jq '.state + " " + (.mergeCommit.oid // "")[0:7]')
    if [ "${after%% *}" = MERGED ]; then echo "$r #$n -> $after ($total checks green)"
    else echo "$r #$n merge failed: $(head -n1 <<<"${err:-state is ${after:-unreadable}}")"; rc=$((rc>1?rc:1)); fi
  else
    echo "$r #$n held: $total check runs, $notok not green, $wf workflow runs unfinished"
  fi
done
exit $rc
