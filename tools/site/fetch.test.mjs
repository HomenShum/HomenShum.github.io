// Scenario tests for the README media picker and the Content-Range guard (tools/site/media.mjs).
import assert from 'node:assert/strict';
import { firstMedia, isAnimated, rangeTotal, hostAllowed } from './media.mjs';

const cases = {
  'commented-out GIF before the real one': () => {
    const m = firstMedia('# T\n<!-- ![old](docs/old.gif) -->\n<!--\n<img src="docs/hidden.png" alt="hidden">\n-->\n![real](docs/real.gif)\n');
    assert.deepEqual(m, { alt: 'real', src: 'docs/real.gif' });
  },
  'reference-style image, full / collapsed / shortcut': () => {
    assert.deepEqual(firstMedia('![Demo run][d]\n\n[d]: docs/demo.png "title"\n'), { alt: 'Demo run', src: 'docs/demo.png' });
    assert.deepEqual(firstMedia('![Demo][]\n\n[DEMO]: <docs/demo.webp>\n'), { alt: 'Demo', src: 'docs/demo.webp' });
    assert.deepEqual(firstMedia('![hero]\n\n[hero]: https://x.test/a.jpg?raw=1\n'), { alt: 'hero', src: 'https://x.test/a.jpg?raw=1' });
  },
  'reference definition: destination on the next line, spaces inside <>': () => {
    assert.deepEqual(firstMedia('![Demo][d]\n\n[d]:\n  docs/demo.png\n'), { alt: 'Demo', src: 'docs/demo.png' });
    assert.deepEqual(firstMedia('![Demo][d]\n\n[d]: <docs/demo run.png> "t"\n'), { alt: 'Demo', src: 'docs/demo run.png' });
  },
  'reference definition: backslash escapes and entities are decoded': () => {
    const def = (d) => firstMedia('![D][d]\n\n[d]: ' + d + '\n').src;
    assert.equal(def(String.raw`docs/demo\(1\).png`), 'docs/demo(1).png');
    assert.equal(def('docs/a&amp;b.png'), 'docs/a&b.png');
    assert.equal(def('docs/a&#38;b&#x26;c.png'), 'docs/a&b&c.png');
    assert.equal(def('docs/a&amp;lt;b.png'), 'docs/a&lt;b.png');
  },
  'reference with no definition is skipped, later image wins': () => {
    assert.equal(firstMedia('![ghost][nope]\n![real](a.png)\n').src, 'a.png');
  },
  'brand SVG and shields badge before a GIF': () => {
    const m = firstMedia('<img src="brand/banner.svg" alt="banner">\n![build](https://img.shields.io/github/actions/workflow/status/x/y/ci.yml?branch=main)\n![npm](https://img.shields.io/badge/npm-1.0-blue.svg)\n![Run](docs/run.GIF)\n');
    assert.deepEqual(m, { alt: 'Run', src: 'docs/run.GIF' });
  },
  'code fence is ignored': () => assert.equal(firstMedia('```md\n![x](fenced.png)\n```\n![y](real.png)').src, 'real.png'),
  'alt: empty markdown alt stays empty, <img> without alt is undefined': () => {
    assert.equal(firstMedia('![](a.gif)').alt, '');
    assert.equal(firstMedia('<img src="a.gif">').alt, undefined);
    assert.equal(firstMedia('<img src="a.gif" alt="">').alt, '');
  },
  'no raster media': () => assert.equal(firstMedia('![b](b.svg)\n# nothing'), undefined),

  'entities in a markdown image: alt and destination are decoded once': () => {
    assert.deepEqual(firstMedia('![A &amp; B](docs/a&amp;b.png)'), { alt: 'A & B', src: 'docs/a&b.png' });
  },
  'markdown destination in <> may contain spaces; balanced and escaped parens': () => {
    assert.deepEqual(firstMedia('![x](<docs/demo run.png>)'), { alt: 'x', src: 'docs/demo run.png' });
    assert.deepEqual(firstMedia('![x](<docs/demo run.png> "t")'), { alt: 'x', src: 'docs/demo run.png' });
    assert.equal(firstMedia(String.raw`![x](docs/demo\(1\).png)`).src, 'docs/demo(1).png');
    assert.equal(firstMedia('![x](docs/demo(1).png)').src, 'docs/demo(1).png');
  },
  'image syntax inside inline code is ignored': () => {
    assert.equal(firstMedia('use `![x](code.png)` here\n![y](real.png)').src, 'real.png');
    assert.equal(firstMedia('``<img src="code.png" alt="c">``\n![y](real.png)').src, 'real.png');
    assert.equal(firstMedia('`![x](code.png)`'), undefined);
  },
  'image syntax inside indented and 4-backtick fences is ignored': () => {
    const f3 = '`'.repeat(3), f4 = '`'.repeat(4);
    assert.equal(firstMedia(`  ${f3}md\n  ![x](fenced.png)\n  ${f3}\n![y](real.png)`).src, 'real.png');
    assert.equal(firstMedia(`    ${f3}\n    ![x](fenced.png)\n    ${f3}\n![y](real.png)`).src, 'real.png');
    // a ``` line inside a 4-backtick fence does not close it
    assert.equal(firstMedia(`${f4}md\n${f3}\n![x](fenced.png)\n${f3}\n![x2](fenced2.png)\n${f4}\n![y](real.png)`).src, 'real.png');
    assert.equal(firstMedia('~~~~\n![x](fenced.png)\n~~~\n![x2](fenced2.png)\n~~~~\n![y](real.png)').src, 'real.png');
    assert.equal(firstMedia(`${f3}\n![x](unclosed.png)`), undefined);
  },
  '<img> attributes: a quoted value that looks like an attribute does not win': () => {
    assert.deepEqual(firstMedia(`<img title="... src='wrong'" src="real.png" alt="A &amp; B">`), { alt: 'A & B', src: 'real.png' });
    assert.equal(firstMedia('<img data-src="wrong.png" alt="a>b" src=right.png>').src, 'right.png');
    assert.equal(firstMedia(`<img src='a.png' src='b.png'>`).src, 'a.png');
  },
  'reference definition: an escaped ampersand is not then decoded as an entity': () => {
    const def = (d) => firstMedia('![D][d]\n\n[d]: ' + d + '\n').src;
    assert.equal(def(String.raw`docs/a\&amp;b.png`), 'docs/a&amp;b.png');
    assert.equal(def(String.raw`docs/a\\&amp;b.png`), 'docs/a\\&b.png');
  },
  'first image in document order across forms': () => {
    assert.equal(firstMedia('<img src="html.png" alt="h">\n![md](md.png)').src, 'html.png');
    assert.equal(firstMedia('![md](md.png)\n<img src="html.png" alt="h">').src, 'md.png');
  },
  'animation is classified by content, not extension': () => {
    const pad = (s) => Buffer.concat([Buffer.from(s, 'latin1'), Buffer.alloc(64)]);
    // PNG: signature + chunks framed by length/type/payload/crc
    const chunk = (type, payload = Buffer.alloc(0)) => { const h = Buffer.alloc(8); h.writeUInt32BE(payload.length, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, payload, Buffer.alloc(4)]); };
    const png = (...chunks) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', Buffer.alloc(13)), ...chunks, chunk('IEND')]);
    const text = (s) => chunk('tEXt', Buffer.from('Comment' + String.fromCharCode(0) + s, 'latin1'));
    // WebP: RIFF header + chunks framed by type/LE length/payload(+pad)
    const wchunk = (type, payload) => { const h = Buffer.alloc(8); h.write(type, 0, 'latin1'); h.writeUInt32LE(payload.length, 4); return Buffer.concat([h, payload, Buffer.alloc(payload.length & 1)]); };
    const webp = (...chunks) => { const body = Buffer.concat([Buffer.from('WEBP'), ...chunks]); const h = Buffer.alloc(8); h.write('RIFF', 0); h.writeUInt32LE(body.length, 4); return Buffer.concat([h, body]); };
    const vp8x = (flags) => wchunk('VP8X', Buffer.from([flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    assert.equal(isAnimated(pad('GIF89a')), true);
    assert.equal(isAnimated(pad('GIF87a')), true);
    assert.equal(isAnimated(webp(vp8x(0x12), wchunk('ANIM', Buffer.alloc(6)), wchunk('ANMF', Buffer.alloc(16)))), true);
    assert.equal(isAnimated(webp(vp8x(0x00), wchunk('ANIM', Buffer.alloc(6)))), true, 'ANIM chunk without the flag');
    assert.equal(isAnimated(webp(vp8x(0x10), wchunk('VP8 ', Buffer.alloc(40)))), false);
    assert.equal(isAnimated(webp(wchunk('VP8L', Buffer.alloc(40)))), false);
    assert.equal(isAnimated(webp(vp8x(0x10), wchunk('EXIF', Buffer.from('ANIM' + 'x'.repeat(30))), wchunk('VP8 ', Buffer.alloc(40)))), false, 'ANIM text in a payload');
    assert.equal(isAnimated(png(chunk('acTL', Buffer.alloc(8)), chunk('IDAT', Buffer.alloc(8)))), true);
    assert.equal(isAnimated(png(chunk('IDAT', Buffer.alloc(8)))), false);
    assert.equal(isAnimated(png(text('acTL'), chunk('IDAT', Buffer.alloc(8)))), false, 'acTL text in a tEXt payload');
    assert.equal(isAnimated(png(text('IDAT'), chunk('acTL', Buffer.alloc(8)), chunk('IDAT', Buffer.alloc(8)))), true, 'IDAT text before the real acTL');
    assert.equal(isAnimated(Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(64), Buffer.from('GIF89aacTL')])), false);
    assert.equal(isAnimated(Buffer.from('GIF89a')), false); // too short to be a real file
  },
  'unmatched backticks stay literal; escapes keep images': () => {
    assert.equal(firstMedia('``oops ![x](real.png) end`').src, 'real.png');
    assert.equal(firstMedia('![x](real.png "say \\"hi\\"")').src, 'real.png');
    assert.equal(firstMedia(String.raw`\\![x](real.png)`).src, 'real.png');
    assert.equal(firstMedia(String.raw`\![x](nope.png)`), undefined);
    assert.equal(firstMedia('![x][d]\n\n[d]: real.png "say \\"hi\\""').src, 'real.png');
  },
  'fences: a closer indented 4+ more does not close; a fence inside a comment is not a fence': () => {
    const f = '`'.repeat(3);
    assert.equal(firstMedia('~~~\n    ~~~\n![x](code.png)\n~~~\n\n![y](real.png)').src, 'real.png');
    assert.equal(firstMedia('<!--\n~~~\n-->\n![y](real.png)').src, 'real.png');
    assert.equal(firstMedia(`- item\n\n  ${f}\n  ![x](code.png)\n  ${f}\n\n![y](real.png)`).src, 'real.png');
  },
  'a code span does not fuse the text around it into an image; spans stay inside their paragraph': () => {
    assert.equal(firstMedia('![fake]`literal`(docs/fake.png)\n\n![real](docs/real.png)').src, 'docs/real.png');
    assert.deepEqual(firstMedia('![Run `npm test`](demo.png)'), { alt: 'Run ', src: 'demo.png' });
    assert.equal(firstMedia('a lone `\n\n![real](real.png)\n\nanother lone `').src, 'real.png');
  },
  '<img> attribute text is not read as a comment or a code span': () => {
    assert.equal(firstMedia('<img title="literal <!--" src="docs/real.png">').src, 'docs/real.png');
    assert.equal(firstMedia('<img src="docs/a`b`c.png">').src, 'docs/a`b`c.png');
  },
  'fence indentation: top-level closer needs <= 3 spaces; an unclosed indented fence is code, not a fence': () => {
    assert.equal(firstMedia('   ~~~\n    ~~~\n![fake](code.png)\n~~~\n\n![real](real.png)').src, 'real.png');
    assert.equal(firstMedia('    ~~~\n    example\n\n![real](real.png)').src, 'real.png');
  },
  'animation: a window that ends before a deciding chunk is unknown, which counts as animated': () => {
    const chunk = (type, n) => { const h = Buffer.alloc(8); h.writeUInt32BE(n, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, Buffer.alloc(n + 4)]); };
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const head = Buffer.concat([sig, chunk('IHDR', 13), chunk('tEXt', 4000)]).subarray(0, 2048); // acTL would come after the window
    assert.equal(isAnimated(head), true);
  },
  'media host allow-list: https and listed hosts only': () => {
    const hosts = new Set(['raw.githubusercontent.com', 'github.com']);
    assert.equal(hostAllowed('https://raw.githubusercontent.com/HomenShum/x/main/a.gif', hosts), true);
    for (const bad of ['http://raw.githubusercontent.com/a.gif', 'https://raw.githubusercontent.com.evil.test/a.gif', 'https://169.254.169.254/a.gif', 'https://user@evil.test/a.gif', 'file:///etc/passwd', 'not a url']) assert.equal(hostAllowed(bad, hosts), false, bad);
  },

  'Content-Range */abc is unknown': () => assert.equal(rangeTotal('*/abc'), 0),
  'Content-Range bytes 0-0/12 is 12': () => assert.equal(rangeTotal('bytes 0-0/12'), 12),
  'Content-Range total must be a positive integer past the range end': () => {
    for (const bad of ['', undefined, 'bytes 0-99/*', 'bytes 0-99/abc', 'bytes 0-99/0', 'bytes 0-99/-5', 'bytes 0-99/99', 'bytes 0-99/12.5', 'bytes 5-2/100', 'bytes 0-1/99999999999999999999999']) assert.equal(rangeTotal(bad), 0, String(bad));
    assert.equal(rangeTotal('bytes 0-262143/7849403'), 7849403);
  },
};
let failed = 0;
for (const [name, fn] of Object.entries(cases)) {
  try { fn(); console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
}
process.exit(failed ? 1 : 0);
