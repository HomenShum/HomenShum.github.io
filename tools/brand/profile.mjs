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

const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true }); fs.copyFileSync(path.join(root, 'brand', from), path.join(dir, to)); };
for (const f of ['banner-light.svg', 'banner-dark.svg', 'compact-light.svg', 'compact-dark.svg']) copy(`HomenShum/${f}`, `assets/brand/${f}`);
for (const r of PINS) for (const t of ['light', 'dark']) copy(`${r}/card-${t}.svg`, `assets/cards/${r}-${t}.svg`);

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

const file = path.join(dir, 'README.md');
let md = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const oldHead = /^<h2 align="center">Homen Shum<\/h2>\n\n<h3 align="center">[^\n]*<\/h3>\n/;
if (!oldHead.test(md)) throw new Error('profile header shape changed; update profile.mjs');
md = md.replace(oldHead, `${head}\n`);
const anchor = '### Background';
if (!md.includes(anchor)) throw new Error('no "### Background" section to place the cards before');
if (!md.includes('### Selected projects')) md = md.replace(anchor, `${cards}\n\n${anchor}`);
fs.writeFileSync(file, md);
console.log('profile README updated');
