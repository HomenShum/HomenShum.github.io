// How does github.com actually render the banner block? Reports the sanitized <picture>
// markup, which source each viewport/theme picks, and whether the image loaded.
// usage: node tools/proof/gh-render.mjs <url> <outPrefix>
import { chromium } from 'playwright';
const [url, outPrefix] = process.argv.slice(2);
const b = await chromium.launch();
for (const [label, viewport, colorScheme] of [['desktop-light', { width: 1280, height: 900 }, 'light'], ['desktop-dark', { width: 1280, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await b.newContext({ viewport, colorScheme });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const info = await p.evaluate(() => {
    const pic = document.querySelector('article.markdown-body picture');
    const img = pic?.querySelector('img');
    return pic ? { html: pic.outerHTML.slice(0, 900), current: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, w: Math.round(img.getBoundingClientRect().width), parentHref: pic.closest('a')?.href } : { html: null };
  });
  if (label === 'desktop-light') console.log('MARKUP:', info.html);
  console.log(label, '->', (info.current || '').split('/').slice(-1)[0], 'loaded=' + info.loaded, 'width=' + info.w, 'link=' + info.parentHref);
  await p.waitForTimeout(2200);
  const box = await p.evaluate(() => { const r = document.querySelector('article.markdown-body').getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width }; });
  await p.screenshot({ path: `${outPrefix}-${label}.png`, fullPage: true, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, viewport.width), height: viewport.width < 600 ? 420 : 560 } });
  await ctx.close();
}
await b.close();
