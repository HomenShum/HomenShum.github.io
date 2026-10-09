// Visual + structural checks of the built site against the local server:
// screenshots at phone/desktop in both themes, no horizontal overflow, no console errors,
// every internal link resolves, and every page carries title/description/canonical/og:image/JSON-LD.
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shots = process.argv[3] || 'proof/site';
fs.mkdirSync(shots, { recursive: true });
const pages = ['/', ...fs.readdirSync('docs', { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(`docs/${d.name}/index.html`)).map(d => `/${d.name}/`)];
// Playwright emulates reduced-motion per context (it overrides the browser flag), so stills
// set it explicitly: every page must show its final frame immediately.
const b = await chromium.launch();
const problems = [];
const seen = new Set();
for (const [label, viewport, scheme] of [['desktop', { width: 1440, height: 1000 }, 'light'], ['phone', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await b.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('console', m => m.type() === 'error' && problems.push(`console ${label}: ${m.text()}`));
  p.on('pageerror', e => problems.push(`pageerror ${label}: ${e.message}`));
  for (const path of pages) {
    const res = await p.goto(base + path, { waitUntil: 'networkidle' });
    if (res.status() !== 200) problems.push(`${path} status ${res.status()}`);
    const r = await p.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      title: document.title, desc: document.querySelector('meta[name=description]')?.content,
      canonical: document.querySelector('link[rel=canonical]')?.href, og: document.querySelector('meta[property="og:image"]')?.content,
      ld: (() => { try { return !!JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch { return false; } })(),
      h1: document.querySelectorAll('h1').length,
      links: [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute('href')),
      fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
      scripts: [...document.scripts].map(s => s.type),
      imgs: [...document.querySelectorAll('.demo img')].map(i => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.getAttribute('loading'), dec: i.getAttribute('decoding') })),
      stills: [...document.querySelectorAll('.demo')].filter(d => d.querySelector('img.anim')).map(d => ({ alt: d.querySelector('img.anim').getAttribute('alt'), text: d.querySelector('.still')?.innerText ?? null, shown: !!d.querySelector('.still') && getComputedStyle(d.querySelector('.still')).display !== 'none' && getComputedStyle(d.querySelector('img.anim')).display === 'none' })),
    }));
    if (r.overflow > 0) problems.push(`${label} ${path} overflows by ${r.overflow}px`);
    if (!r.title || !r.desc || !r.canonical || !r.og || !r.ld) problems.push(`${path} missing head metadata ${JSON.stringify({ t: !!r.title, d: !!r.desc, c: !!r.canonical, og: !!r.og, ld: r.ld })}`);
    // Demo-figure contract: sized + lazy + async images, one script (the JSON-LD), and the GIF's description surviving reduced motion.
    if (r.scripts.length !== 1 || r.scripts[0] !== 'application/ld+json') problems.push(`${label} ${path} scripts must be exactly one application/ld+json, got ${JSON.stringify(r.scripts)}`);
    r.imgs.forEach(i => { if (!/^[1-9]\d*$/.test(i.w || '') || !/^[1-9]\d*$/.test(i.h || '') || i.lazy !== 'lazy' || i.dec !== 'async') problems.push(`${label} ${path} .demo img needs numeric width/height, loading=lazy, decoding=async: ${JSON.stringify(i)}`); });
    r.stills.forEach(x => { if (!x.shown || !x.text.includes(x.alt ?? '')) problems.push(`${label} ${path} reduced-motion .still must show the image alt ${JSON.stringify(x.alt)}, got ${JSON.stringify(x.text)}`); });
    if (r.h1 !== 1) problems.push(`${path} has ${r.h1} h1`);
    r.links.forEach(l => seen.add(l.split('#')[0] || '/'));
    if (path === '/' || path === '/nodekit/') await p.screenshot({ path: `${shots}/${label}${path === '/' ? '-home' : '-nodekit'}.png`, fullPage: label === 'phone' ? false : true });
  }
  await ctx.close();
}
// Motion contract on the hero: the steps are fully visible on the first frame either way;
// with motion, a step's border lights mid-run and returns; with reduced motion nothing runs.
for (const reducedMotion of ['no-preference', 'reduce']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion });
  const p = await ctx.newPage();
  await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const read = () => p.evaluate(() => [...document.querySelectorAll('.stair li')].map(li => ({ o: +getComputedStyle(li).opacity, b: getComputedStyle(li).borderTopColor, a: getComputedStyle(li).animationName })));
  const first = await read();
  await p.waitForTimeout(250 + 260 - 40 + 180);
  const mid = await read();
  await p.waitForTimeout(1800);
  const settled = await read();
  if (first.some(x => x.o !== 1)) problems.push(`${reducedMotion}: a hero step is hidden on the first frame`);
  if (reducedMotion === 'reduce' && first.some(x => x.a !== 'none')) problems.push('reduce: hero still animates');
  if (reducedMotion === 'no-preference' && mid[1].b === settled[1].b) problems.push('no-preference: step 2 never lit (no motion)');
  if (JSON.stringify(settled.map(x => x.b)) !== JSON.stringify(first.map(x => x.b)) && reducedMotion === 'reduce') problems.push('reduce: frames differ');
  await ctx.close();
}
for (const l of seen) { const r = await fetch(base + l); if (r.status !== 200) problems.push(`internal link ${l} -> ${r.status}`); }
await b.close();
console.log(JSON.stringify({ pages: pages.length, internalLinks: seen.size, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
