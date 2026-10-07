// Capture the top fold of each repo page on github.com at desktop and phone widths.
// usage: node tools/proof/capture.mjs <outDir> [repo ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out, ...only] = process.argv.slice(2);
const repos = only.length ? only : [...JSON.parse(fs.readFileSync(new URL('../brand/repos.json', import.meta.url))).map(r => r.repo), 'HomenShum'];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [label, viewport, scheme] of [['desktop', { width: 1280, height: 900 }, 'light'], ['phone', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const repo of repos) {
    const url = repo === 'HomenShum' ? 'https://github.com/HomenShum' : `https://github.com/HomenShum/${repo}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      const readme = page.locator('article.markdown-body').first();
      await readme.scrollIntoViewIfNeeded({ timeout: 10000 });
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${out}/${repo}-${label}.png` });
      console.log('ok', repo, label);
    } catch (e) { console.log('FAIL', repo, label, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
await browser.close();
