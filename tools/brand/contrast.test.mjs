// Every colour that text can take in a generated SVG, at rest or mid-animation, must reach
// 4.5:1 against every surface of its theme (WCAG AA for small text). Text is outlined, but
// it is still text to a reader. Codex review 2 caught the pulse keyframe flashing small
// numerals to the decorative accent (2.69:1); this keeps that from coming back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let checked = 0;
for (const repo of fs.readdirSync(path.join(root, 'brand'))) {
  for (const kind of ['banner', 'compact', 'card']) for (const theme of ['light', 'dark']) {
    const svg = fs.readFileSync(path.join(root, 'brand', repo, `${kind}-${theme}.svg`), 'utf8');
    const t = THEMES[theme];
    const surfaces = [t.bg, t.panel, t.wash];
    // Text colours at rest: a <g fill> whose content is glyph <use> elements.
    const rest = [...svg.matchAll(/<g[^>]*\sfill="(#[0-9a-fA-F]{6})"[^>]*>(?:<g[^>]*>)?<use /g)].map(m => m[1]);
    // Text colours mid-animation: keyframe c is the text pulse (keyframe p tints step boxes).
    const moving = [...svg.matchAll(/@keyframes c\{[^}]*fill:(#[0-9a-fA-F]{6})/g)].map(m => m[1]);
    for (const c of new Set([...rest, ...moving])) for (const s of surfaces) {
      checked++;
      assert.ok(ratio(c, s) >= 4.5, `${repo}/${kind}-${theme}: text ${c} on ${s} is ${ratio(c, s).toFixed(2)}:1`);
    }
  }
}
console.log(`contrast.test: ${checked} text/surface pairs at >= 4.5:1`);
