# Lighthouse rule for the site

For / and every project page: accessibility, best-practices and SEO = 100 in every run; performance median over 5 mobile runs >= 99 and no single run < 97; request count equal to the pre-change baseline and total-byte-weight within 1% of baseline on pages whose content did not change; a page whose content changed records its new baseline in lh-base.md.

## Why a median and a floor, not "100 in at least one run"

Speed Index on an unchanged page is bimodal under simulated throttling: the round-2 judge measured about 1.9-2.0 s in some runs and 3.1-3.3 s in others, and the performance score moves between 1.00 and 0.99 with it. A rule that needs one perfect run out of three passes or fails on which mode the runs land in, so the rule uses the median of five and a floor instead.

## Command (the same for baseline and after)

```
npx -y lighthouse@12 <url> --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=<file>.json --chrome-flags="--headless=new"
```

Output-only flags (`--quiet`, `--output-path`) may be added; any flag that changes configSettings (throttling, preset, form factor, categories) may not.

Request count is `audits['network-requests'].details.items.length`; byte weight is `audits['total-byte-weight'].numericValue`. Baselines live in `lh-base.md` in the change's evidence folder, one per change that alters page content.

## Font preload (measured 2026-10-29)

Only `/assets/inter.woff2` is preloaded; `/assets/mono.woff2` is not. On the current `/` (4 text assets plus three selected-work JPEGs) a localhost A/B of the committed page with the mono preload against the same page without it, 15 runs each (10 interleaved on one port plus a 5-run control with the two ports swapped: before-1..10, swap-before-1..5, nomono-1..10, swap-nomono-1..5 in the evidence folder), gave Speed Index > 2.5 s (the slow mode above) in 7/15 runs with the preload and 0/15 without (Fisher exact p = 0.006); `font-display: optional` on the mono face did not help (6/10 slow). Requests stayed at 7 and total-byte-weight changed by -0.03%. Local timing has no edge latency, so the live bimodality is still judged by the live runs in the rule above. Evidence: `site-perf-speed-index-20261029T072736Z` (local-table-n10.md for the 10 interleaved runs, slow-counts.txt for the pooled 15).
