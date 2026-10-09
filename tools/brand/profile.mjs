// Refreshes the HomenShum profile README: the banner replaces the text header, and a grid of
// project cards (the pinned repos) sits under "The system, in layers". All other text stays.
//   node tools/brand/profile.mjs <HomenShum checkout>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://homenshum.github.io';
const PINS = ['NodeRoom', 'NodeBenchAI', 'NodeAgent', 'NodeProof', 'NodeVoice', 'FeatureClipStudio'];
const [dir] = process.argv.slice(2);
const profile = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/profile.json'), 'utf8'));
const repos = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/repos.json'), 'utf8'));

// A checkout with core.autocrlf holds CRLF copies of LF assets; rewriting those with LF bytes
// makes git report them modified though the content is the same. Only write when content differs.
const same = (a, b) => fs.existsSync(b) && fs.readFileSync(a, 'utf8').replace(/\r\n/g, '\n') === fs.readFileSync(b, 'utf8').replace(/\r\n/g, '\n');
const copy = (from, to) => {
  const src = path.join(root, 'brand', from), dst = path.join(dir, to);
  if (same(src, dst)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};
// Step 1: the 16 assets (4 banners + 6 pins x light/dark). Safe to repeat: it writes only what differs.
const copyAssets = () => {
  for (const f of ['banner-light.svg', 'banner-dark.svg', 'compact-light.svg', 'compact-dark.svg']) copy(`HomenShum/${f}`, `assets/brand/${f}`);
  for (const r of PINS) for (const t of ['light', 'dark']) copy(`${r}/card-${t}.svg`, `assets/cards/${r}-${t}.svg`);
};

const head = `<a href="${SITE}/">
  <picture>
    <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="assets/brand/compact-dark.svg">
    <source media="(max-width: 600px)" srcset="assets/brand/compact-light.svg">
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/banner-dark.svg">
    <img alt="Homen Shum: ${profile.tagline}" src="assets/brand/banner-light.svg" width="100%">
  </picture>
</a>`;

const cards = `### Selected projects

<p align="center">
${PINS.map(n => {
  const r = repos.find(x => x.repo === n);
  return `<a href="https://github.com/HomenShum/${n}"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/cards/${n}-dark.svg"><img alt="${r.name || n}: ${r.tagline}" src="assets/cards/${n}-light.svg" width="49%"></picture></a>`;
}).join('\n')}
</p>

<p align="center"><a href="${SITE}/"><b>All ${repos.length} projects, grouped by layer →</b></a></p>`;

// Step 2: the README. The header is either the legacy text header or the banner this script
// wrote on an earlier run, so a re-run rewrites it in place. The cards are added once.
const rewriteReadme = () => {
  const file = path.join(dir, 'README.md');
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let md = raw.replace(/\r\n/g, '\n');
  const oldHead = new RegExp(
    '^(?:<h2 align="center">Homen Shum</h2>\\n\\n<h3 align="center">[^\\n]*</h3>' +
    // The installed banner is matched line by line (no [\s\S] span), so a changed shape fails loudly instead of eating README text.
    `|<a href="${SITE.replace(/[.]/g, '\\.')}/">\\n  <picture>\\n(?:    <source [^\\n]*>\\n)*    <img [^\\n]*>\\n  </picture>\\n</a>)\\n`);
  if (!oldHead.test(md)) throw new Error('profile header shape changed; update profile.mjs');
  md = md.replace(oldHead, () => `${head}\n`);
  const anchor = '### Background';
  if (!md.includes(anchor)) throw new Error('no "### Background" section to place the cards before');
  if (!md.includes('### Selected projects')) md = md.replace(anchor, () => `${cards}\n\n${anchor}`);
  fs.writeFileSync(file, md.replace(/\n/g, eol));
};

copyAssets();
rewriteReadme();
console.log('profile assets copied, README updated');
