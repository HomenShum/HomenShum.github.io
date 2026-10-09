// Snapshot the live GitHub metadata the site shows (description, homepage, language, topics, license),
// plus each README's first raster media (url, alt, dimensions, bytes) for the project page.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { firstMedia, rangeTotal } from './media.mjs';
const repos = JSON.parse(fs.readFileSync('tools/brand/repos.json', 'utf8'));
const MAX_BYTES = 4 * 1024 * 1024; // above this a lazy image is still too heavy for a phone; skip it
const q = `query{ ${repos.map((r, i) => `r${i}: repository(owner:"HomenShum",name:"${r.repo}"){ name description homepageUrl stargazerCount pushedAt createdAt licenseInfo{spdxId} primaryLanguage{name} defaultBranchRef{name} startHere: object(expression:"HEAD:docs/START_HERE.md"){id} handoff: object(expression:"HEAD:HANDOFF.md"){id} readme: object(expression:"HEAD:README.md"){... on Blob{text}} repositoryTopics(first:20){nodes{topic{name}}} }`).join(' ')} }`;
const data = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${q}`], { maxBuffer: 1 << 24 })).data;

// Image dimensions from the first bytes: PNG IHDR, GIF screen, WebP VP8/VP8L/VP8X, JPEG SOF.
function dims(b) {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 10 && b.toString('latin1', 0, 4) === 'GIF8') return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const k = b.toString('latin1', 12, 16);
    if (k === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    if (k === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + (m === 0xff || (m >= 0xd0 && m <= 0xd9) || m === 0x01 ? -1 : b.readUInt16BE(i + 2));
    }
  }
  return null;
}

async function mediaFor(repo, branch, readme) {
  const ref = firstMedia(readme || '');
  if (!ref) return { skipped: 'no raster media in README' };
  const rel = !/^[a-z][a-z0-9+.-]*:/i.test(ref.src) && !ref.src.startsWith('//');
  let url;
  try {
    url = new URL(rel ? ref.src.replace(/^\.?\//, '') : ref.src, `https://raw.githubusercontent.com/HomenShum/${repo}/${branch}/`).href;
    const path = rel ? ref.src.replace(/^\.?\//, '').split(/[?#]/)[0] : new URL(url).pathname.split('/').pop();
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!head.ok) return { skipped: `HEAD ${head.status}`, url };
    let bytes = +head.headers.get('content-length') || 0;
    if (bytes > MAX_BYTES) return { skipped: `${bytes} bytes > ${MAX_BYTES}`, url };
    const get = await fetch(url, { headers: { Range: 'bytes=0-262143' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
    // Read only the header bytes even if the server ignores Range: the body is abandoned, never buffered whole.
    const chunks = []; let got = 0;
    for await (const c of get.body) { chunks.push(c); if ((got += c.length) >= 262144) break; }
    const buf = Buffer.concat(chunks);
    // The GET is authoritative: 206 -> total from Content-Range, 200 (Range ignored) -> its Content-Length; else unknown.
    bytes = get.status === 206 ? rangeTotal(get.headers.get('content-range')) : get.status === 200 ? +get.headers.get('content-length') || 0 : 0;
    if (!bytes) return { skipped: 'size unknown', url };
    if (bytes > MAX_BYTES) return { skipped: `${bytes} bytes > ${MAX_BYTES}`, url };
    const d = dims(buf);
    if (!d || !d[0] || !d[1]) return { skipped: 'dimensions unreadable', url };
    return { media: { url, path, alt: ref.alt, width: d[0], height: d[1], bytes } };
  } catch (e) { return { skipped: `fetch failed: ${e.message}`, url }; }
}

const meta = {};
for (const r of Object.values(data)) {
  const m = await mediaFor(r.name, r.defaultBranchRef.name, r.readme?.text);
  meta[r.name] = {
    description: r.description, homepage: r.homepageUrl || null, stars: r.stargazerCount, pushedAt: r.pushedAt, createdAt: r.createdAt,
    license: r.licenseInfo?.spdxId || null, language: r.primaryLanguage?.name || null, branch: r.defaultBranchRef.name,
    topics: r.repositoryTopics.nodes.map(n => n.topic.name),
    startHere: !!r.startHere, handoff: !!r.handoff,
    headings: (r.readme?.text || '').split(/\r?\n/).filter(l => /^#{2,3} /.test(l)).map(l => l.replace(/^#+ /, '').trim()),
    media: m.media || null, mediaSkipped: m.skipped ? { reason: m.skipped, url: m.url || null } : null,
  };
  console.log(r.name.padEnd(22), m.media ? `${m.media.width}x${m.media.height} ${m.media.bytes}B ${m.media.path}` : `skip: ${m.skipped}`);
}
fs.writeFileSync('tools/site/meta.json', JSON.stringify(meta, null, 2) + '\n');
console.log(Object.keys(meta).length, 'repos');
