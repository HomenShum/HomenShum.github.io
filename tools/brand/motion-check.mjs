// Proves the motion contract on a real Chromium <img> embed (how GitHub shows a README image):
//  1. the first frame is already complete (nothing animates in), so a frozen render is whole;
//  2. mid-run, the signal is visibly moving (the motion exists);
//  3. with the OS-level reduced-motion preference the banner never moves: every frame is final.
// usage: node tools/brand/motion-check.mjs [Repo ...]   (defaults to every repo, wide + phone)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const all = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/repos.json'), 'utf8')).map(r => r.repo).concat('HomenShum');
const repos = process.argv.slice(2).length ? process.argv.slice(2) : all;

const full = await chromium.launch();
const reduced = await chromium.launch({ args: ['--force-prefers-reduced-motion'] });
const shot = async (browser, file, wait) => {
  const svg = fs.readFileSync(file, 'utf8');
  const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const p = await browser.newPage({ viewport: { width: +w, height: +h } });
  await p.setContent(`<body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${w}" height="${h}">`);
  await p.waitForTimeout(wait);
  const png = await p.screenshot();
  await p.close();
  return png;
};
// Fraction of pixels whose RGB differs by more than 8/255, measured in a canvas.
const cmp = await full.newPage();
const diff = (a, b) => cmp.evaluate(async ([x, y]) => {
  const load = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
  const [d1, d2] = [await load(x), await load(y)];
  let n = 0; for (let k = 0; k < d1.length; k += 4) if (Math.abs(d1[k] - d2[k]) > 8 || Math.abs(d1[k + 1] - d2[k + 1]) > 8 || Math.abs(d1[k + 2] - d2[k + 2]) > 8) n++;
  return n / (d1.length / 4);
}, [a.toString('base64'), b.toString('base64')]);

let failed = 0;
for (const repo of repos) for (const kind of ['banner-light', 'compact-dark']) {
  const file = path.join(root, 'brand', repo, `${kind}.svg`);
  const first = await shot(full, file, 30), mid = await shot(full, file, 700), settled = await shot(full, file, 3000);
  const rFirst = await shot(reduced, file, 30), rMid = await shot(reduced, file, 700);
  const r = { first: await diff(first, settled), mid: await diff(mid, settled), reducedFirst: await diff(rFirst, settled), reducedMid: await diff(rMid, settled) };
  const ok = r.first < 0.0005 && r.mid > 0.0002 && r.reducedFirst < 0.0005 && r.reducedMid < 0.0005;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${repo}/${kind} firstVsSettled=${r.first.toFixed(5)} midVsSettled=${r.mid.toFixed(5)} reducedFirst=${r.reducedFirst.toFixed(5)} reducedMid=${r.reducedMid.toFixed(5)}`);
  if (repo === repos[0] && kind === 'banner-light') fs.writeFileSync(path.join(root, 'proof/brand', `motion-${repo}-mid.png`), mid);
}
await full.close();
await reduced.close();
process.exit(failed ? 1 : 0);
