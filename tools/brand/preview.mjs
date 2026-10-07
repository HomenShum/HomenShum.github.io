// Renders what a reader will see: social.png per repo, contact sheets of every banner and
// card in both themes, and frames of one banner mid-animation (motion evidence).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repos = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/repos.json'), 'utf8')).map(r => r.repo).concat('HomenShum');
const out = path.join(root, 'proof/brand');
fs.mkdirSync(out, { recursive: true });
// The OS-level reduced-motion flag shows every banner's final frame, including offscreen
// ones whose SVG animations Chrome would otherwise pause.
const b = await chromium.launch({ args: ['--force-prefers-reduced-motion'] });
const bm = await chromium.launch();
const svg = (repo, f) => fs.readFileSync(path.join(root, 'brand', repo, f), 'utf8');
const dataUrl = s => 'data:image/svg+xml;base64,' + Buffer.from(s).toString('base64');

const still = await b.newPage({ viewport: { width: 1280, height: 640 }, reducedMotion: 'reduce' });
for (const repo of repos) {
  await still.setContent(`<body style="margin:0"><img src="${dataUrl(svg(repo, 'social.svg'))}" width="1280" height="640">`);
  await still.waitForTimeout(50);
  await still.screenshot({ path: path.join(root, 'brand', repo, 'social.png') });
}
for (const [kind, w] of [['banner', 1280], ['card', 640]]) for (const theme of ['light', 'dark']) {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
  const imgs = repos.map(r => `<img src="${dataUrl(svg(r, `${kind}-${theme}.svg`))}" style="width:${kind === 'banner' ? 820 : 400}px;display:block;margin:0 0 14px">`).join('');
  await still.setViewportSize({ width: kind === 'banner' ? 860 : 860, height: 800 });
  await still.setContent(`<body style="margin:0;padding:20px;background:${bg};${kind === 'card' ? 'display:flex;flex-wrap:wrap;gap:0 14px' : ''}">${imgs}`);
  await still.waitForTimeout(300);
  await still.screenshot({ path: path.join(out, `${kind}-${theme}-sheet.png`), fullPage: true });
}
const moving = await bm.newPage({ viewport: { width: 1280, height: 400 } });
const target = process.argv[2] || 'NodeVideo';
for (const ms of [0, 250, 600, 1000, 1800]) {
  await moving.setContent(`<body style="margin:0;background:#fff"><img src="${dataUrl(svg(target, 'banner-light.svg'))}" width="1280" height="400">`);
  await moving.waitForTimeout(ms);
  await moving.screenshot({ path: path.join(out, `motion-${target}-${String(ms).padStart(4, '0')}ms.png`) });
}
await b.close();
await bm.close();
console.log('wrote', out);
