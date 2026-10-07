#!/usr/bin/env bash
# Prints check buckets for every open portfolio PR this work opened.
# usage: tools/proof/pr-status.sh   (exit 0 when none are pending)
pending=0
while read -r repo head; do
  n=$(gh pr list -R "HomenShum/$repo" --head "$head" --state open --json number --jq '.[0].number')
  [ -z "$n" ] && { echo "$repo ($head): no open PR"; continue; }
  s=$(gh pr checks "$n" -R "HomenShum/$repo" --json bucket --jq 'group_by(.bucket) | map("\(.[0].bucket)=\(length)") | join(" ")' 2>/dev/null)
  case "$s" in *pending*) pending=1;; esac
  echo "$repo #$n: ${s:-no checks}"
done <<LIST
$(node -e 'for (const r of require("./tools/brand/repos.json")) console.log(r.repo, r.repo === "NodeBenchAI" ? "docs/readme-banner" : "claude/readme-banner")')
HomenShum claude/profile-banner
NodeRoom claude/undici-8.10.2
NodeTrace claude/audit-fix
NodeGraph claude/audit-fix
LIST
exit $pending
