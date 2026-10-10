// Visual + structural checks of the built site against the local server:
// screenshots at phone/desktop in both themes, no horizontal overflow, no console errors,
// every internal link resolves, and every page carries title/description/canonical/og:image/JSON-LD.
// usage: node tools/site/check.mjs [baseUrl] [screenshotDir]
// With no baseUrl it serves ./docs itself on an ephemeral localhost port, so `npm run check` needs no server and no network.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const shots = process.argv[3] || 'proof/site';
fs.mkdirSync(shots, { recursive: true });
const dirs = fs.readdirSync('docs', { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(`docs/${d.name}/index.html`)).map(d => d.name);
const pages = ['/', ...dirs.map(d => `/${d}/`)];
const problems = [];

// Demo-figure contract on disk: the pages with a <figure> are exactly the meta.json entries that have media (slug = lower-cased repo name),
// each with exactly one; the home page and every other page have none.
const meta = JSON.parse(fs.readFileSync('tools/site/meta.json', 'utf8'));
const expected = Object.entries(meta).filter(([, v]) => v.media).map(([k]) => k.toLowerCase()).sort();
// Source scan (fails fast, no browser): comments are dropped and the tag name must end at whitespace, '>' or '/'. The browser loop below re-counts real DOM <figure> elements.
const figures = n => (fs.readFileSync(n === '' ? 'docs/index.html' : `docs/${n}/index.html`, 'utf8').replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1>/gi, '').match(/<figure(?=[\s>/])/gi) || []).length;
const actual = dirs.filter(d => figures(d) > 0).sort();
if (!expected.length) problems.push('meta.json has no media entries: nothing to check the figures against');
for (const s of expected) if (!actual.includes(s)) problems.push(`/${s}/ has media in meta.json but no <figure> in docs/${s}/index.html`);
for (const s of actual) if (!expected.includes(s)) problems.push(`/${s}/ has a <figure> but no media in meta.json`);
for (const s of actual) if (figures(s) !== 1) problems.push(`/${s}/ must have exactly one <figure>, has ${figures(s)}`);
if (figures('') !== 0) problems.push('/ must have no <figure>');

if (problems.length) { console.log(JSON.stringify({ problems }, null, 1)); process.exit(1); } // fail fast, before any browser
const { chromium } = await import('playwright');
let server;
const base = process.argv[2] || await new Promise(done => {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon' };
  const root = path.resolve('docs');
  server = http.createServer((req, res) => {
    let f = null;
    try { f = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { /* malformed escape: 404 */ }
    if (f && f !== root && !f.startsWith(root + path.sep)) f = null; // never leave docs/ (a sibling like docs-private shares the prefix)
    if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (f && fs.existsSync(f) && !fs.realpathSync(f).startsWith(fs.realpathSync(root) + path.sep)) f = null; // a symlink out of docs/
    const ok = !!f && fs.existsSync(f);
    res.writeHead(ok ? 200 : 404, { 'content-type': types[path.extname(ok ? f : '.html')] || 'application/octet-stream' });
    res.end(ok ? fs.readFileSync(f) : 'Not found'); // literal 404 body: docs/404.html is not read through a path that skipped the containment checks
  }).listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`));
});
// Playwright emulates reduced-motion per context (it overrides the browser flag), so stills
// set it explicitly: every page must show its final frame immediately.
const b = await chromium.launch();
// innerText collapses runs of whitespace; an alt attribute does not. Compare them collapsed.
const norm = t => t.trim().replace(/\s+/g, ' ');
const seen = new Set();
// Offline and deterministic: with our own server, anything that is not ours (README media on raw.githubusercontent.com) gets a 1x1 PNG, in every context.
const offline = ctx => server ? ctx.route(u => new URL(u).origin !== base, r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })) : undefined;
const PIXEL =Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
for (const [label, viewport, scheme] of [['desktop', { width: 1440, height: 1000 }, 'light'], ['phone', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await b.newContext({ viewport, colorScheme: scheme, reducedMotion: 'reduce' });
  await offline(ctx);
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
      figs: document.querySelectorAll('.demo > figure').length, allFigs: document.querySelectorAll('figure').length,
      imgs: [...document.querySelectorAll('.demo img')].map(i => ({ w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.getAttribute('loading'), dec: i.getAttribute('decoding') })),
      stills: [...document.querySelectorAll('.demo')].filter(d => d.querySelector('img.anim')).map(d => ({ alt: d.querySelector('img.anim').getAttribute('alt'), text: d.querySelector('.still')?.innerText ?? null, shown: !!d.querySelector('.still') && getComputedStyle(d.querySelector('.still')).display !== 'none' && getComputedStyle(d.querySelector('img.anim')).display === 'none' })),
    }));
    if (r.overflow > 0) problems.push(`${label} ${path} overflows by ${r.overflow}px`);
    if (!r.title || !r.desc || !r.canonical || !r.og || !r.ld) problems.push(`${path} missing head metadata ${JSON.stringify({ t: !!r.title, d: !!r.desc, c: !!r.canonical, og: !!r.og, ld: r.ld })}`);
    // Demo-figure contract: sized + lazy + async images, one script (the JSON-LD), and the GIF's description surviving reduced motion.
    if (r.scripts.length !== 1 || r.scripts[0] !== 'application/ld+json') problems.push(`${label} ${path} scripts must be exactly one application/ld+json, got ${JSON.stringify(r.scripts)}`);
    // Real DOM elements (not source text): exactly one demo <figure> with one <img> on the pages meta.json has media for, none elsewhere.
    const want = expected.includes(path.replace(/\//g, '')) ? 1 : 0;
    if (r.figs !== want || r.allFigs !== want || r.imgs.length !== want) problems.push(`${label} ${path} must have ${want} demo <figure> with ${want} <img>, got figure=${r.figs} (all ${r.allFigs}) img=${r.imgs.length}`);
    r.imgs.forEach(i => { if (!/^[1-9]\d*$/.test(i.w || '') || !/^[1-9]\d*$/.test(i.h || '') || i.lazy !== 'lazy' || i.dec !== 'async') problems.push(`${label} ${path} .demo img needs numeric width/height, loading=lazy, decoding=async: ${JSON.stringify(i)}`); });
    r.stills.forEach(x => { if (!x.shown || x.alt == null || !norm(x.text).includes(norm(x.alt))) problems.push(`${label} ${path} reduced-motion .still must show the image alt ${JSON.stringify(x.alt)}, got ${JSON.stringify(x.text)}`); });
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
  await offline(ctx);
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
server?.close();
console.log(JSON.stringify({ pages: pages.length, internalLinks: seen.size, problems }, null, 1));
process.exit(problems.length ? 1 : 0);
