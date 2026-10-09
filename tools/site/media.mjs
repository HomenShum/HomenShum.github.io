// Pure README-media helpers (no network): which image does the project page show, and can a Content-Range be trusted.
const RASTER = /\.(gif|png|webp|jpe?g)$/i;
const attr = (tag, n) => tag.match(new RegExp(String.raw`(?:^|\s)` + n + String.raw`\s*=\s*(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(v => v !== undefined);
const unent = s => s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (m, e) => ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' })[e.toLowerCase()] ?? (() => { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m; })());
const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();

// First image in the README (outside code fences and <!-- comments -->) whose file is gif/png/webp/jpg/jpeg.
// Forms: ![alt](src), ![alt][id] / ![alt][] / ![id] with a `[id]: src` definition, and <img src alt>.
// alt is '' for an empty markdown alt and undefined only for an <img> with no alt attribute.
export function firstMedia(readme) {
  const text = readme.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const defs = new Map();
  for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>\n]*)>|(\S+))(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm)) if (!defs.has(norm(m[1]))) defs.set(norm(m[1]), unent(m[2] ?? m[3]).replace(/\\([!-/:-@[-`{-~])/g, '$1'));
  const refs = [...text.matchAll(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)|!\[([^\]]*)\]\[([^\]]*)\]|!\[([^\]]+)\](?![[(])|<img\b[^>]*>/gi)].map(m => {
    if (m[2]) return { alt: m[1], src: m[2] };
    if (m[3] !== undefined) return { alt: m[3], src: defs.get(norm(m[4] || m[3])) };
    if (m[5] !== undefined) return { alt: m[5], src: defs.get(norm(m[5])) };
    const a = attr(m[0], 'alt');
    return { alt: a === undefined ? undefined : unent(a), src: unent(attr(m[0], 'src') || '') };
  });
  return refs.find(r => r.src && RASTER.test(r.src.split(/[?#]/)[0]));
}

// Total size from `Content-Range: bytes a-b/total`, or 0 (unknown) unless total is a positive integer past the range end.
export function rangeTotal(header) {
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec((header || '').trim());
  if (!m) return 0;
  const end = +m[2], total = +m[3];
  return Number.isSafeInteger(total) && total > 0 && total > end && end >= +m[1] ? total : 0;
}
