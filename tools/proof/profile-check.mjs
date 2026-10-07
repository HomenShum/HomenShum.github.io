// Live check of github.com/HomenShum: banner variant per viewport/theme, six cards loaded.
import { chromium } from 'playwright';
const b = await chromium.launch();
let bad = 0;
for (const [label, viewport, colorScheme, want] of [['desktop-light', { width: 1280, height: 900 }, 'light', 'banner-light.svg'], ['phone-dark', { width: 390, height: 844 }, 'dark', 'compact-dark.svg']]) {
  const p = await (await b.newContext({ viewport, colorScheme })).newPage();
  await p.goto('https://github.com/HomenShum', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForFunction(() => [...document.querySelectorAll('article.markdown-body picture img')].length >= 7 && [...document.querySelectorAll('article.markdown-body picture img')].every(i => i.complete), null, { timeout: 30000 }).catch(() => {});
  const r = await p.evaluate(() => { const imgs = [...document.querySelectorAll('article.markdown-body picture img')]; return { banner: imgs[0]?.currentSrc.split('/').pop(), cards: imgs.slice(1).filter(i => i.complete && i.naturalWidth > 0).map(i => i.currentSrc.split('/').pop()) }; });
  const ok = r.banner === want && r.cards.length === 6 && r.cards.every(c => c.endsWith(colorScheme === 'dark' ? '-dark.svg' : '-light.svg'));
  if (!ok) bad++;
  console.log(label, ok ? 'ok' : 'FAIL', JSON.stringify(r));
  const box = await p.evaluate(() => { const a = document.querySelector('article.markdown-body'); const q = a.getBoundingClientRect(); return { x: q.x + scrollX, y: q.y + scrollY, w: q.width }; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `proof/gh-main/profile-${label}.png`, fullPage: true, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.w + 16, viewport.width), height: viewport.width < 600 ? 420 : 520 } });
}
await b.close();
process.exit(bad ? 1 : 0);
