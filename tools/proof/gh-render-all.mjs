// For each repo, open the README on a branch (or the default branch) as a reader would and
// confirm the banner block: the right variant per viewport/theme, image loaded, link row present.
// usage: node tools/proof/gh-render-all.mjs <ref|default> <outDir> Repo...
import { chromium } from 'playwright';
import fs from 'node:fs';
const [ref, out, ...repos] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const want = { 'desktop-light': 'banner-light.svg', 'desktop-dark': 'banner-dark.svg', 'phone-light': 'compact-light.svg', 'phone-dark': 'compact-dark.svg' };
const b = await chromium.launch();
let bad = 0;
const check = async repo => {
  const row = [];
  for (const [label, file] of Object.entries(want)) {
    const phone = label.startsWith('phone');
    const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, colorScheme: label.endsWith('dark') ? 'dark' : 'light' });
    const p = await ctx.newPage();
    const url = `https://github.com/HomenShum/${repo}${ref === 'default' ? '' : `/tree/${ref}`}`;
    let r = { src: 'none', loaded: false, nav: 0 };
    for (let attempt = 0; attempt < 2 && !r.loaded; attempt++) {
      try {
        // github.com rarely reaches networkidle; wait for the banner image itself instead.
        await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await p.waitForFunction(() => { const i = document.querySelector('article.markdown-body picture img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 }).catch(() => {});
        r = await p.evaluate(() => {
          const img = document.querySelector('article.markdown-body picture img');
          const nav = [...document.querySelectorAll('article.markdown-body p[align="center"] a')].length;
          return img ? { src: img.currentSrc.split('/').pop(), loaded: img.complete && img.naturalWidth > 0, nav } : { src: 'none', loaded: false, nav };
        });
      } catch (e) { r.src = 'timeout'; }
    }
    const ok = r.src === file && r.loaded && r.nav > 0;
    if (!ok) bad++;
    row.push(`${label}:${ok ? 'ok' : `FAIL(${r.src},loaded=${r.loaded},nav=${r.nav})`}`);
    if (label === 'desktop-light' || label === 'phone-dark') {
      const box = await p.evaluate(() => { const a = document.querySelector('article.markdown-body'); if (!a) return null; const q = a.getBoundingClientRect(); return { x: q.x + scrollX, y: q.y + scrollY, w: q.width }; });
      if (box) { await p.waitForTimeout(1800); await p.screenshot({ path: `${out}/${repo}-${label}.png`, fullPage: true, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.w + 16, phone ? 390 : 1280), height: phone ? 380 : 470 } }); }
    }
    await ctx.close();
  }
  return `${repo.padEnd(22)} ${row.join('  ')}`;
};
const lines = [];
for (let i = 0; i < repos.length; i += 4) lines.push(...await Promise.all(repos.slice(i, i + 4).map(check)));
console.log(lines.join('\n'));
await b.close();
console.log(bad ? `${bad} FAILED` : 'ALL OK');
process.exit(bad ? 1 : 0);
