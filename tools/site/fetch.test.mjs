// Scenario tests for the README media picker and the Content-Range guard (tools/site/media.mjs).
import assert from 'node:assert/strict';
import { firstMedia, rangeTotal } from './media.mjs';

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
    assert.equal(firstMedia('![D][d]\n\n[d]: docs/demo\(1\).png\n').src, 'docs/demo(1).png');
    assert.equal(firstMedia('![D][d]\n\n[d]: docs/a&amp;b.png\n').src, 'docs/a&b.png');
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
