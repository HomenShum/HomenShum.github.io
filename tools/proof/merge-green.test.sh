#!/usr/bin/env bash
# Offline test for merge-green.sh: a PATH-prepended stub `gh` answers from env vars, no network.
# Asserts the exit code AND the key output line of every outcome. Run by `npm run check`.
# MERGE_GREEN_SCRIPT overrides the script under test.
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT=${MERGE_GREEN_SCRIPT:-$here/merge-green.sh}
work=$(mktemp -d) || exit 1
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"
cat >"$work/bin/gh" <<'STUB'
#!/usr/bin/env bash
# Stub gh: PRE/POST = `pr view` output before/after the merge, CHECKS = check-run verdicts, MERGE_ERR/MERGE_RC = `pr merge`.
echo "gh $*" >>"$CALLS"
case "$1 $2" in
  "pr view") if [[ " $* " == *headRefOid* ]]; then printf '%s\n' "$PRE"; else printf '%s\n' "$POST"; fi ;;
  "pr merge") [ -n "$MERGE_ERR" ] && echo "$MERGE_ERR" >&2; exit "$MERGE_RC" ;;
  "api --paginate") if [[ "$*" == *check-runs* ]]; then printf '%s' "$CHECKS"; fi ;;
  *) echo "stub gh: unexpected $*" >&2; exit 99 ;;
esac
STUB
chmod +x "$work/bin/gh"
export CALLS="$work/calls.log" PATH="$work/bin:$PATH"
SHA=$(printf 'a%.0s' {1..40}); GREEN=$'ok\nok\nok\n'
fail=0
# t NAME WANT_RC WANT_OUTPUT_FRAGMENT WANT_MERGE_CALLS(0|1) args...   (PRE/POST/CHECKS/MERGE_* come from the caller's env prefix)
t() {
  local name=$1 want_rc=$2 want_out=$3 want_merges=$4; shift 4
  : >"$CALLS"
  local out rc merges
  out=$(bash "$SCRIPT" "$@" 2>&1); rc=$?
  merges=$(grep -c '^gh pr merge ' "$CALLS")
  if [ "$rc" = "$want_rc" ] && [[ $out == *"$want_out"* ]] && [ "$merges" = "$want_merges" ]; then
    echo "ok   - $name (exit $rc: $out)"
  else
    echo "FAIL - $name: want exit $want_rc / '$want_out' / $want_merges merge call(s); got exit $rc / '$out' / $merges"; fail=1
  fi
}
PRE="" POST="" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "unreadable state/sha -> hold, exit 1" 1 "Repo #7 held: could not read PR state/head sha" 0 Repo/7
PRE="OPEN abc" POST="" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "malformed sha -> hold, exit 1" 1 "held: could not read PR state/head sha" 0 Repo/7
PRE="BROKEN $SHA" POST="" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "unknown state -> hold, exit 1" 1 "held: could not read PR state/head sha" 0 Repo/7
PRE="" POST="" CHECKS="" MERGE_ERR="" MERGE_RC=0 t "malformed arg -> rejected, exit 2" 2 "bad-arg: expected Repo/PR" 0 bad-arg
PRE="" POST="" CHECKS="" MERGE_ERR="" MERGE_RC=0 t "bad arg then unreadable PR -> exit 2 wins over 1" 2 "held: could not read" 0 bad-arg Repo/7
PRE="MERGED $SHA" POST="" CHECKS="" MERGE_ERR="" MERGE_RC=0 t "already MERGED -> reported, exit 0, no merge call" 0 "Repo #7 already MERGED" 0 Repo/7
PRE="OPEN $SHA" POST="OPEN " CHECKS=$'ok\nbad\n' MERGE_ERR="" MERGE_RC=0 t "red check -> hold, exit 0, no merge call" 0 "Repo #7 held: 2 check runs, 1 not green, 0 workflow runs unfinished" 0 Repo/7
PRE="OPEN $SHA" POST="OPEN " CHECKS="" MERGE_ERR="" MERGE_RC=0 t "no check runs -> hold, exit 0, no merge call" 0 "Repo #7 held: 0 check runs" 0 Repo/7
PRE="OPEN $SHA" POST="MERGED 1234567" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "MERGED -> exit 0" 0 "Repo #7 -> MERGED 1234567 (3 checks green)" 1 Repo/7
PRE="OPEN $SHA" POST="OPEN " CHECKS=$GREEN MERGE_ERR="merge conflict" MERGE_RC=1 t "merge failure -> 'merge failed', exit 1" 1 "Repo #7 merge failed: merge conflict" 1 Repo/7
PRE="OPEN $SHA" POST="MERGED_BOGUS 1234567" CHECKS=$GREEN MERGE_ERR="merge conflict" MERGE_RC=1 t "garbled post-merge state is not MERGED -> 'merge failed', exit 1" 1 "Repo #7 merge failed: merge conflict" 1 Repo/7
PRE="OPEN $SHA" POST="OPEN " CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "merge rc 0 but still OPEN -> 'merge failed', exit 1" 1 "Repo #7 merge failed: state is OPEN" 1 Repo/7
PRE="OPEN $SHA" POST="" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "merge rc 0, no stderr, post-merge view unreadable -> 'merge unconfirmed', exit 1" 1 "Repo #7 merge unconfirmed" 1 Repo/7
PRE="OPEN $SHA" POST="" CHECKS=$GREEN MERGE_ERR="boom" MERGE_RC=1 t "merge rc 1, post-merge view unreadable -> 'merge failed', exit 1" 1 "Repo #7 merge failed: boom" 1 Repo/7
PRE="OPEN $SHA" POST="" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=1 t "merge rc 1 with empty stderr, post-merge view unreadable -> 'merge failed', exit 1" 1 "Repo #7 merge failed: state is unreadable" 1 Repo/7
PRE="OPEN $SHA" POST="" CHECKS=$GREEN MERGE_ERR="warning" MERGE_RC=0 t "merge rc 0 with stderr, post-merge view unreadable -> 'merge failed', exit 1" 1 "Repo #7 merge failed: warning" 1 Repo/7
# the merge must be pinned to the head commit whose checks were read
PRE="OPEN $SHA" POST="MERGED 1234567" CHECKS=$GREEN MERGE_ERR="" MERGE_RC=0 t "merge call pinned with --match-head-commit" 0 "-> MERGED" 1 Repo/7
if grep -q -- "--match-head-commit $SHA" "$CALLS"; then echo "ok   - gh pr merge carried --match-head-commit <head sha>"; else echo "FAIL - gh pr merge missing --match-head-commit <head sha>: $(cat "$CALLS")"; fail=1; fi
[ "$fail" = 0 ] && echo "merge-green.test.sh: all cases passed" || echo "merge-green.test.sh: FAILED"
exit $fail
