// Pure README-media helpers (no network): which image does the project page show, does it animate, and can a Content-Range be trusted.
const RASTER = /\.(gif|png|webp|jpe?g)$/i;
const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
const entity = (e, m) => ENT[e.toLowerCase()] ?? (() => { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m; })();
const ENTITY = String.raw`&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);`;
// HTML attribute values: entities only.
const unent = s => s.replace(new RegExp(ENTITY, 'gi'), (m, e) => entity(e, m));
// Markdown strings (destinations, alt, definitions): backslash escapes and entities in ONE left-to-right pass, so `\&amp;` is a literal "&amp;".
const mdDecode = s => s.replace(new RegExp(String.raw`\\([!-/:-@[-` + '`' + String.raw`{-~])|` + ENTITY, 'gi'), (m, esc, e) => esc ?? entity(e, m));
const txt = s => mdDecode(s).replace(/\0/g, ''); // alt text: a code span left a NUL placeholder
const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();

// Remove what GitHub does not render as markdown, scanning left to right so whichever starts first wins:
//  - fenced code: 3+ ` or ~ at the start of a line, any indentation (fences sit inside list items); closed by the same char, at least as long,
//    indented at most 3 (top level, opener indented <= 3) or 3 more than the opener (nested in a list); an unclosed fence runs to the end,
//    except when it is indented 4+ (then it is indented code, not a fence);
//  - <!-- comments --> (unclosed runs to the end); <img ...> tags are copied whole so their attribute text is never read as markdown;
//  - code spans: a backtick run closed by a run of exactly the same length within the paragraph; unmatched runs stay literal.
//    A span leaves one NUL behind so the text around it cannot fuse into link syntax.
// Backslash pairs are kept intact so `\`` and `\![` stay escaped.
const FENCE = /( *)(`{3,}|~{3,})([^\n]*)/y, IMG_TAG = /<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>/iy, BLANK = /\n[ \t]*\n/g;
function stripCode(s) {
  let out = '', i = 0;
  while (i < s.length) {
    if (i === 0 || s[i - 1] === '\n') {
      FENCE.lastIndex = i;
      const o = FENCE.exec(s);
      if (o && !(o[2][0] === '`' && o[3].includes('`'))) {
        const limit = o[1].length <= 3 ? 3 : o[1].length + 3;
        let end = -1;
        for (let p = s.indexOf('\n', i), q; p >= 0 && end < 0; p = q) {
          q = s.indexOf('\n', p + 1);
          const c = /^( *)(`{3,}|~{3,})[ \t\r]*$/.exec(s.slice(p + 1, q < 0 ? s.length : q));
          if (c && c[2][0] === o[2][0] && c[2].length >= o[2].length && c[1].length <= limit) end = q < 0 ? s.length : q;
        }
        if (end >= 0 || o[1].length <= 3) { i = end >= 0 ? end : s.length; out += '\n'; continue; }
      }
    }
    const c = s[i];
    if (c === '\\') { out += s.slice(i, i + 2); i += 2; }
    else if (s.startsWith('<!--', i)) { const e = s.indexOf('-->', i + 4); i = e < 0 ? s.length : e + 3; }
    else if (c === '<' && (IMG_TAG.lastIndex = i, IMG_TAG.test(s))) { out += s.slice(i, IMG_TAG.lastIndex); i = IMG_TAG.lastIndex; }
    else if (c === '`') {
      let k = i; while (s[k] === '`') k++;
      BLANK.lastIndex = k; const para = BLANK.exec(s)?.index ?? s.length;
      let end = -1;
      for (let e = k; end < 0 && (e = s.indexOf('`', e)) >= 0 && e < para;) { let f = e; while (s[f] === '`') f++; if (f - e === k - i) end = f; e = f; }
      if (end >= 0) { out += '\0'; i = end; } else { out += s.slice(i, k); i = k; }
    } else { out += c; i++; }
  }
  return out;
}

// HTML attributes of one tag, first occurrence wins; quoted values may contain other attribute names and '>'.
function attrs(tag) {
  const out = new Map();
  for (const m of tag.replace(/^<\w+/, '').matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const k = m[1].toLowerCase();
    if (!out.has(k)) out.set(k, m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

// Index of the ']' closing the '[' just before `from`, honouring nesting and backslash escapes; -1 if none.
function closeBracket(t, from) {
  for (let d = 1, i = from; i < t.length; i++) {
    if (t[i] === '\\') i++;
    else if (t[i] === '[') d++;
    else if (t[i] === ']' && --d === 0) return i;
  }
  return -1;
}

// `(dest "title")` starting after '(' at k: <dest with spaces> or a bare dest with balanced parens, optional title. -> { dest, end } or null.
function inlineDest(t, k) {
  const ws = () => { while (/\s/.test(t[k] ?? '')) k++; };
  ws();
  let dest;
  if (t[k] === '<') {
    const s = ++k;
    while (k < t.length && t[k] !== '>' && t[k] !== '\n' && t[k] !== '<') k += t[k] === '\\' ? 2 : 1;
    if (t[k] !== '>') return null;
    dest = t.slice(s, k++);
  } else {
    const s = k;
    for (let d = 0; k < t.length && !/\s/.test(t[k]); k++) {
      if (t[k] === '\\') k++;
      else if (t[k] === '(') d++;
      else if (t[k] === ')' && d-- === 0) break;
    }
    dest = t.slice(s, k);
  }
  ws();
  const q = { '"': '"', "'": "'", '(': ')' }[t[k]];
  if (q) { let e = k + 1; while (e < t.length && t[e] !== q) e += t[e] === '\\' ? 2 : 1; if (e >= t.length) return null; k = e + 1; ws(); }
  return t[k] === ')' ? { dest, end: k + 1 } : null;
}

// First image in the README (outside code fences, code spans and <!-- comments -->) whose file is gif/png/webp/jpg/jpeg.
// Forms: ![alt](src), ![alt](<src with spaces>), ![alt][id] / ![alt][] / ![id] with a `[id]: src` definition, and <img src alt>.
// alt is '' for an empty markdown alt and undefined only for an <img> with no alt attribute.
export function firstMedia(readme) {
  const text = stripCode(readme);
  const defs = new Map();
  for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>\n]*)>|(\S+))(?:[ \t]+(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^)\\]|\\.)*\)))?[ \t]*$/gm)) if (!defs.has(norm(m[1]))) defs.set(norm(m[1]), mdDecode(m[2] ?? m[3]));
  const found = [];
  for (let i = text.indexOf('!['); i >= 0; i = text.indexOf('![', i + 2)) {
    let bs = 0; while (text[i - 1 - bs] === '\\') bs++;
    if (bs % 2) continue; // `\![` is an escaped '!'; `\\![` is an escaped backslash then an image
    const j = closeBracket(text, i + 2);
    if (j < 0) continue;
    const alt = text.slice(i + 2, j), next = text[j + 1];
    if (next === '(') { const d = inlineDest(text, j + 2); if (d) found.push({ at: i, alt: txt(alt), src: mdDecode(d.dest) }); }
    else if (next === '[') { const e = closeBracket(text, j + 2); if (e > 0) found.push({ at: i, alt: txt(alt), src: defs.get(norm(text.slice(j + 2, e) || alt)) }); }
    else found.push({ at: i, alt: txt(alt), src: defs.get(norm(alt)) });
  }
  for (const m of text.matchAll(/<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi)) {
    const a = attrs(m[0]);
    found.push({ at: m.index, alt: a.has('alt') ? unent(a.get('alt')) : undefined, src: unent(a.get('src') || '') });
  }
  const r = found.sort((x, y) => x.at - y.at).find(r => r.src && RASTER.test(r.src.split(/[?#]/)[0]));
  return r && { alt: r.alt, src: r.src };
}

// By content, not extension: any GIF (GIF87a/GIF89a), an animated WebP (VP8X animation flag, or an ANIM chunk before the image data),
// or an APNG (an acTL chunk before the first IDAT). RIFF and PNG chunks are walked by their length fields, so payload text such as a
// tEXt "acTL" is never mistaken for a chunk header. `b` is only the first bytes of the file; running out of them before a deciding chunk (IDAT/IEND, VP8/VP8L/ANMF) means
// "unknown", which counts as animated: the safe side is the reduced-motion fallback, never a moving image that was missed.
export function isAnimated(b) {
  if (b.length < 32) return false;
  const h = b.toString('latin1', 0, 12);
  if (h.startsWith('GIF87a') || h.startsWith('GIF89a')) return true;
  if (h.startsWith('RIFF') && h.slice(8) === 'WEBP') {
    if (b.toString('latin1', 12, 16) === 'VP8X' && (b[20] & 2) !== 0) return true;
    for (let p = 12; p + 8 <= b.length; p += 8 + b.readUInt32LE(p + 4) + (b.readUInt32LE(p + 4) & 1)) {
      const t = b.toString('latin1', p, p + 4);
      if (t === 'ANIM') return true;
      if (t === 'ANMF' || t === 'VP8 ' || t === 'VP8L') return false;
    }
    return true;
  }
  if (b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) {
    for (let p = 8; p + 8 <= b.length; p += 12 + b.readUInt32BE(p)) {
      const t = b.toString('latin1', p + 4, p + 8);
      if (t === 'acTL') return true;
      if (t === 'IDAT' || t === 'IEND') return false;
    }
    return true;
  }
  return false;
}

// Total size from `Content-Range: bytes a-b/total`, or 0 (unknown) unless total is a positive integer past the range end.
export function rangeTotal(header) {
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec((header || '').trim());
  if (!m) return 0;
  const end = +m[2], total = +m[3];
  return Number.isSafeInteger(total) && total > 0 && total > end && end >= +m[1] ? total : 0;
}

// https only, and only the listed hosts (checked on every redirect hop by fetch.mjs).
export const hostAllowed = (url, hosts) => { try { const u = new URL(url); return u.protocol === 'https:' && hosts.has(u.hostname); } catch { return false; } };
