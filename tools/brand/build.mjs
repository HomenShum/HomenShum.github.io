// Generates the Node ecosystem's README banners, profile cards and social previews.
// Text is converted to outlines so every viewer sees the same type, with or without
// Inter installed. Tokens come from NodeRoom's src/ui/tokens.css.
//
//   node tools/brand/build.mjs            -> brand/<repo>/{banner-light,banner-dark,card-light,card-dark,social}.svg
//
// Motion: rung 3, one reviewed decorative recipe ("trace"). Every frame is complete: the
// text and pipeline never animate in, so a renderer that freezes the SVG (an offscreen tab,
// a rasterizer, a crawler) still shows the whole banner. On top of that, one accent signal
// runs the pipeline once, in order, and settles on the outcome, because the order is the
// information. Finite; prefers-reduced-motion removes the signal and leaves the same frame.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(self), '../..');
const fontFile = (pkg, file) => path.join(root, 'node_modules/@fontsource', pkg, 'files', file);
const load = (pkg, file) => { const b = fs.readFileSync(fontFile(pkg, file)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const F = {
  black: load('inter', 'inter-latin-800-normal.woff'),
  medium: load('inter', 'inter-latin-500-normal.woff'),
  mono: load('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'),
};

export const THEMES = {
  light: { bg: '#fafafa', panel: '#ffffff', ink: '#111418', muted: '#4b5563', faint: '#636c77', line: '#e2e5e9', wire: '#c3c8cf', dot: '#111418', dotA: 0.06, accent: '#D97757', accentInk: '#9c4f37', wash: '#fbebe5', glowA: 0.10 },
  dark: { bg: '#101317', panel: '#171b20', ink: '#f3f4f6', muted: '#a7afb9', faint: '#8d96a1', line: '#262c33', wire: '#3a424c', dot: '#ffffff', dotA: 0.05, accent: '#D97757', accentInk: '#EC9C82', wash: '#2b1d18', glowA: 0.14 },
};
const EASE = 'cubic-bezier(.2,.7,.2,1)';
const DUR = { pulse: 400, signal: 340, halo: 400 };
const T0 = 250, HOP = 260; // first pulse, then one step every HOP ms

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const width = (font, s, size, ls = 0) => font.getAdvanceWidth(s, size, { letterSpacing: ls });
// Each glyph outline is defined once per document (in font units) and placed with <use>,
// which keeps a banner far smaller than one outlined path per character.
let defs = new Map();
const fontId = new Map([[F.black, 'b'], [F.medium, 'm'], [F.mono, 'o']]);
function text(font, s, x, y, size, ls = 0) {
  const k = size / font.unitsPerEm, uses = [];
  for (const ch of s) if (ch !== ' ' && font.charToGlyph(ch).index === 0) throw new Error(`no glyph for "${ch}" in "${s}"`);
  font.forEachGlyph(s, 0, 0, size, { letterSpacing: ls }, (g, gx) => {
    if (!g.path.commands.length) return;
    const id = fontId.get(font) + g.index;
    if (!defs.has(id)) defs.set(id, `<path id="${id}" d="${g.getPath(0, 0, font.unitsPerEm).toPathData(0)}"/>`);
    uses.push(`<use href="#${id}" x="${Math.round(gx / k)}"/>`);
  });
  return `<g transform="translate(${+x.toFixed(1)} ${+y.toFixed(1)}) scale(${+k.toFixed(5)})">${uses.join('')}</g>`;
}
const doc = (open, body) => { const out = `${open}<defs>${[...defs.values()].join('')}</defs>${body}</svg>`; defs = new Map(); return out; };

// Balanced wrap (like CSS text-wrap: balance): keep the greedy line count, then
// shrink the measure until one more pixel would add a line, so no line ends as an orphan.
function wrap(font, s, size, maxW) {
  const n = greedy(font, s, size, maxW).length;
  let lo = 0, hi = maxW;
  while (hi - lo > 1) { const mid = (lo + hi) / 2; if (greedy(font, s, size, mid).length > n) lo = mid; else hi = mid; }
  return greedy(font, s, size, hi);
}

function greedy(font, s, size, maxW) {
  const lines = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && width(font, next, size) > maxW) { lines.push(cur); cur = word; } else cur = next;
  }
  return [...lines, cur];
}

function fit(font, s, max, min, maxW, ls) {
  let size = max;
  while (size > min && width(font, s, size, ls) > maxW) size -= 1;
  return size;
}


// Keyframes only name the peak; the start and end are each element's own resting values,
// so before, between and after the run every element shows its final state.
const style = t => `<style>
.p{animation:p ${DUR.pulse}ms ${EASE}}
.c{animation:c ${DUR.pulse}ms ${EASE}}
.s{animation:s ${DUR.signal}ms cubic-bezier(.4,0,.2,1)}
.h{animation:h ${DUR.halo}ms ${EASE};transform-box:fill-box;transform-origin:center}
@keyframes p{45%{stroke:${t.accent};fill:${t.wash}}}
@keyframes c{45%{fill:${t.accent}}}
@keyframes s{from{stroke-dashoffset:.55}to{stroke-dashoffset:-1.1}}
@keyframes h{from{opacity:.8}to{opacity:0;transform:scale(1.12,1.6)}}
@media (prefers-reduced-motion:reduce){.p,.c,.s,.h{animation:none}}
</style>`;
const at = ms => `style="animation-delay:${Math.round(ms)}ms"`;

function backdrop(t, W, H, id) {
  return `<defs>
<pattern id="g${id}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="${t.dot}" fill-opacity="${t.dotA}"/></pattern>
<radialGradient id="h${id}" cx="${W - 120}" cy="0" r="${Math.round(W * 0.48)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.glowA}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
<clipPath id="c${id}"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#c${id})"><rect width="${W}" height="${H}" fill="${t.bg}"/><rect width="${W}" height="${H}" fill="url(#g${id})"/><rect width="${W}" height="${H}" fill="url(#h${id})"/></g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.line}"/>`;
}

// The staircase pipeline: each step is a pill offset down and right of the one before,
// joined by an elbow wire, like spans in a trace waterfall. The last step is the outcome.
function pipeline(t, steps, box, animate) {
  const n = steps.length;
  const size = 15, padX = 16, h = 40, idxW = width(F.mono, '00', 12) + 10;
  const pills = steps.map(s => ({ s, w: Math.ceil(padX * 2 + idxW + width(F.mono, s, size)) }));
  const dy = (box.h - h) / (n - 1);
  const lastW = pills[n - 1].w;
  const dx = Math.max(44, Math.min(120, (box.w - lastW) / (n - 1)));
  const out = [];
  pills.forEach((p, i) => {
    const x = box.x + i * dx, y = box.y + i * dy, last = i === n - 1;
    const arrive = T0 + i * HOP;
    if (i > 0) {
      const px = box.x + (i - 1) * dx + 22, py = box.y + (i - 1) * dy + h, ty = y + h / 2, r = 8;
      const d = `M${px} ${py}V${(ty - r).toFixed(1)}Q${px} ${ty.toFixed(1)} ${px + r} ${ty.toFixed(1)}H${x}`;
      out.push(`<path d="${d}" fill="none" stroke="${t.wire}" stroke-width="1.5" stroke-linecap="round"/>`);
      if (animate) out.push(`<path class="s" ${at(arrive - DUR.signal + 60)} pathLength="1" stroke-dasharray=".55 2" stroke-dashoffset="-1.1" d="${d}" fill="none" stroke="${t.accent}" stroke-width="2.5"/>`);
    }
    const y1 = y.toFixed(1);
    out.push(`<rect ${animate ? `class="p" ${at(arrive - 40)} ` : ''}x="${x}" y="${y1}" width="${p.w}" height="${h}" rx="8" fill="${t.panel}" stroke="${last ? t.accent : t.line}" stroke-width="${last ? 1.5 : 1}"/>`);
    if (animate && last) out.push(`<rect class="h" ${at(arrive + 120)} x="${x}" y="${y1}" width="${p.w}" height="${h}" rx="8" fill="none" stroke="${t.accent}" stroke-width="1.5" opacity="0"/>`);
    out.push(`<g ${animate ? `class="c" ${at(arrive - 40)} ` : ''}fill="${last ? t.accentInk : t.faint}">${text(F.mono, String(i + 1).padStart(2, '0'), x + padX, y + h / 2 + 4.5, 12)}</g>
<g fill="${last ? t.accentInk : t.ink}">${text(F.mono, p.s, x + padX + idxW, y + h / 2 + 5.5, size)}</g>`);
  });
  return out.join('\n');
}

function headline(t, r, o) {
  const name = r.name || r.repo;
  const out = [];
  const ey = r.eyebrow.toUpperCase();
  out.push(`<g><rect x="${o.x}" y="${o.eyebrowY - 10}" width="10" height="10" rx="2" fill="${t.accent}"/><g fill="${t.faint}">${text(F.mono, ey, o.x + 22, o.eyebrowY, o.eyebrowSize, 0.08)}</g></g>`);
  const nameSize = fit(F.black, name, o.nameMax, o.nameMin, o.maxW, -0.03);
  out.push(`<g fill="${t.ink}">${text(F.black, name, o.x - nameSize * 0.04, o.nameY, nameSize, -0.03)}</g>`);
  const lines = wrap(F.medium, r.tagline, o.tagSize, o.maxW).slice(0, 3);
  out.push(`<g>${lines.map((l, i) => `<g fill="${t.muted}">${text(F.medium, l, o.x, o.tagY + i * o.tagLH, o.tagSize)}</g>`).join('')}</g>`);
  if (o.footY) out.push(`<g fill="${t.faint}">${text(F.mono, r.foot || `github.com/HomenShum/${r.repo}`, o.x, o.footY, o.footSize)}</g>`);
  return out.join('\n');
}

const svgOpen = (W, H, r) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d"><title id="t">${esc(r.name || r.repo)}</title><desc id="d">${esc(r.tagline)} ${esc(r.steps.join(' → '))}</desc>`;

export function banner(r, theme, animate = true) {
  const t = THEMES[theme], W = 1280, H = 400;
  return doc(svgOpen(W, H, r), `${animate ? style(t) : ''}${backdrop(t, W, H, 'b')}
${headline(t, r, { x: 72, eyebrowY: 100, eyebrowSize: 14, nameY: 196, nameMax: 92, nameMin: 50, maxW: 590, tagY: 250, tagSize: 26, tagLH: 36, footY: 340, footSize: 14 })}
${pipeline(t, r.steps, { x: 712, y: 72, w: 1216 - 712, h: 256 }, animate)}`);
}

// Profile cards are read at about 400px wide, so the chain keeps a fixed 15px size and
// elides middle steps ("…") rather than shrinking below legibility.
export function card(r, theme) {
  const t = THEMES[theme], W = 640, H = 264, size = 15, maxW = 560;
  const join = xs => xs.join('  ›  ');
  const fits = xs => width(F.mono, join(xs), size) <= maxW;
  let steps = r.steps;
  if (!fits(steps)) {
    const first = steps[0], last = steps.at(-1);
    let mid = steps.slice(1, -1);
    while (mid.length && !fits([first, ...mid, '…', last])) mid = mid.slice(0, -1);
    steps = [first, ...mid, '…', last];
  }
  const chain = join(steps);
  return doc(svgOpen(W, H, r), `${backdrop(t, W, H, 'k')}
${headline(t, r, { x: 40, eyebrowY: 54, eyebrowSize: 13, nameY: 112, nameMax: 52, nameMin: 34, maxW, tagY: 152, tagSize: 20, tagLH: 28 })}
<g fill="${t.faint}">${text(F.mono, chain, 40, 230, size)}</g>`);
}

// Phone art direction: the same recipe re-laid for a ~360px column, where the wide banner
// would shrink its pipeline labels to ~4px. Steps flow as one wrapped chain instead.
export function compact(r, theme, animate = true) {
  const t = THEMES[theme], W = 720, x0 = 48, maxX = W - 48, size = 21, lh = 34;
  const lines = wrap(F.medium, r.tagline, 30, maxX - x0).slice(0, 3);
  const tagY = 214, chainTop = tagY + (lines.length - 1) * 40 + 70;
  const sep = '  ›  ', sepW = width(F.mono, sep, size);
  let x = x0, y = chainTop;
  const placed = r.steps.map(s => {
    const w = width(F.mono, s, size);
    if (x > x0 && x + w > maxX) { x = x0; y += lh; }
    const p = { s, w, x, y };
    x += w + sepW;
    return p;
  });
  const chain = placed.map((p, i) => {
    const next = placed[i + 1], last = !next;
    const arrow = next && next.y === p.y ? `<g fill="${t.faint}">${text(F.mono, '›', p.x + p.w + sepW / 2 - width(F.mono, '›', size) / 2, p.y, size)}</g>` : '';
    return `<g ${animate ? `class="c" ${at(T0 + i * HOP)} ` : ''}fill="${last ? t.accentInk : t.ink}">${text(F.mono, p.s, p.x, p.y, size)}</g>${arrow}`;
  });
  const H = Math.ceil(y + 46);
  return doc(svgOpen(W, H, r), `${animate ? style(t) : ''}${backdrop(t, W, H, 'm')}
${headline(t, r, { x: x0, eyebrowY: 68, eyebrowSize: 18, nameY: 158, nameMax: 96, nameMin: 52, maxW: maxX - x0, tagY, tagSize: 30, tagLH: 40 })}
${chain.join('\n')}`);
}

export function social(r) {
  const t = THEMES.light, W = 1280, H = 640;
  return doc(svgOpen(W, H, r), `${backdrop(t, W, H, 's')}
${headline(t, r, { x: 80, eyebrowY: 190, eyebrowSize: 16, nameY: 300, nameMax: 104, nameMin: 56, maxW: 600, tagY: 364, tagSize: 30, tagLH: 42, footY: 520, footSize: 18 })}
${pipeline(t, r.steps, { x: 712, y: 150, w: 1200 - 712, h: 330 }, false)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) {
  const repos = [...JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/repos.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/profile.json'), 'utf8'))];
  for (const r of repos) {
    const dir = path.join(root, 'brand', r.repo);
    fs.mkdirSync(dir, { recursive: true });
    const files = {
      'banner-light.svg': banner(r, 'light'), 'banner-dark.svg': banner(r, 'dark'),
      'compact-light.svg': compact(r, 'light'), 'compact-dark.svg': compact(r, 'dark'),
      'card-light.svg': card(r, 'light'), 'card-dark.svg': card(r, 'dark'),
      'social.svg': social(r),
    };
    for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), s);
    console.log(r.repo, Object.entries(files).map(([f, s]) => `${f}=${(s.length / 1024).toFixed(1)}KB`).join(' '));
  }
}
