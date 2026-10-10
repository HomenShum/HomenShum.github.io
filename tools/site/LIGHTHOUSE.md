# Lighthouse rule for the site

For / and every project page: accessibility, best-practices and SEO = 100 in every run; performance median over 5 mobile runs >= 99 and no single run < 97; request count equal to the pre-change baseline and total-byte-weight within 1% of baseline on pages whose content did not change; a page whose content changed records its new baseline in lh-base.md.

## Why a median and a floor, not "100 in at least one run"

Speed Index on an unchanged page is bimodal under simulated throttling: the round-2 judge measured about 1.9-2.0 s in some runs and 3.1-3.3 s in others, and the performance score moves between 1.00 and 0.99 with it. A rule that needs one perfect run out of three passes or fails on which mode the runs land in, so the rule uses the median of five and a floor instead.

## Command (the same for baseline and after)

```
npx -y lighthouse@12 <url> --preset=perf --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate \
  --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=<file>.json --chrome-flags="--headless=new"
```

Request count is `audits['network-requests'].details.items.length`; byte weight is `audits['total-byte-weight'].numericValue`. Baselines live in `lh-base.md` in the change's evidence folder, one per change that alters page content.
