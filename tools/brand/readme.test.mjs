// Scenario checks for the README injector: the real README shapes in the portfolio.
import assert from 'node:assert/strict';
import { apply, header, rewrite } from './readme.mjs';
const r = { repo: 'NodeMem', eyebrow: 'Passive memory', tagline: 'Notice passively. Act explicitly.', steps: ['a', 'b', 'c'] };
const m = { homepage: null, startHere: true, handoff: true };

// 1. Plain "# Name" README with a quickstart: banner above the H1, body untouched, quickstart anchored.
const plain = '# NodeMem\n\nIntro line.\n\n## Quick start\n\nnpm i\n';
const out1 = apply(plain, header(r, m, plain), r.tagline);
assert.ok(/^# NodeMem$/m.test(out1), 'H1 kept'); // was: !/^# NodeMem$/m 'H1 removed' (the banner used to replace the H1)
assert.ok(out1.includes('Intro line.') && out1.includes('## Quick start'), 'body kept');
assert.ok(out1.includes('href="#quick-start"'), 'quickstart anchor');
assert.ok(out1.includes('docs/START_HERE.md') && out1.includes('HANDOFF.md'), 'only existing docs linked');

// 2. Centered README whose H3 repeats the tagline: subtitle dropped, the div survives.
const centered = '<div align="center">\n\n# NodeMem\n\n### Notice passively. Act explicitly.\n\nA provider-agnostic passive memory.\n</div>\n';
const out2 = apply(centered, header(r, m, centered), r.tagline);
assert.ok(!out2.includes('### Notice passively'), 'duplicate subtitle dropped');
assert.ok(out2.startsWith('<div align="center">') && out2.includes('A provider-agnostic passive memory.'), 'rest kept');

// 3. A different subtitle is kept (only exact repeats go).
const other = '# NodeMem\n### Something else entirely\n';
assert.ok(apply(other, header(r, m, other), r.tagline).includes('### Something else entirely'));

// 4. "# comment" inside a code fence is not mistaken for the title.
const fenced = '```sh\n# install\n```\n\n# NodeMem\n';
const out4 = apply(fenced, header(r, m, fenced), r.tagline);
assert.ok(out4.includes('# install') && out4.includes('<!-- brand:end -->\n\n# NodeMem\n')); // was: !/^# NodeMem$/m (the H1 used to be replaced)

// 5. Re-running replaces the block instead of stacking a second banner.
const again = apply(out1, header({ ...r, tagline: 'New line.' }, m, out1), 'New line.');
assert.equal(again.split('brand:start').length - 1, 1, 'one block');
assert.ok(again.includes('NodeMem: New line.'), 'block refreshed');

// 6. No H1 at all is an error, never a silent insert at a random place.
assert.throws(() => apply('just text\n', header(r, m, ''), r.tagline), /no H1/);

// 7. A live homepage is linked; a GitHub self-link is not presented as a demo.
assert.ok(header(r, { ...m, homepage: 'https://x.vercel.app' }, '').includes('https://x.vercel.app'));
assert.ok(!header(r, { ...m, homepage: 'https://github.com/HomenShum/NodeMem' }, '').includes('Live demo'));
// 8. A CRLF README stays CRLF throughout (no mixed line endings); an LF one stays LF.
const crlf = rewrite('# NodeMem\r\n\r\nBody.\r\n', r, m);
assert.ok(crlf.includes('brand:end -->\r\n') && !/[^\r]\n/.test(crlf), 'CRLF kept');
assert.ok(!rewrite('# NodeMem\n\nBody.\n', r, m).includes('\r'), 'LF kept');
// 9. A homepage that is this portfolio page is not a live demo.
assert.ok(!header(r, { ...m, homepage: 'https://homenshum.github.io/nodemem/' }, '').includes('Live demo'));
// 10. First install keeps the H1 directly below brand:end (one blank line between), LF and CRLF.
for (const [name, eol] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  const o = rewrite(['# Foo', '', 'Body.', ''].join(eol), r, m);
  assert.ok(o.startsWith('<!-- brand:start'), `${name}: block is at the top`);
  assert.ok(o.includes(`<!-- brand:end -->${eol}${eol}# Foo${eol}${eol}Body.${eol}`), `${name}: H1 directly below brand:end`);
  assert.equal(o.split('# Foo').length - 1, 1, `${name}: H1 not duplicated`);
  if (eol === '\r\n') assert.ok(!/[^\r]\n/.test(o), 'CRLF kept throughout');
}
// 11. An <h1> tag is kept too, directly below the block.
const h1tag = '<h1 align="center">Foo</h1>\n\nBody.\n';
assert.ok(apply(h1tag, header(r, m, h1tag), r.tagline).includes('<!-- brand:end -->\n\n<h1 align="center">Foo</h1>\n\nBody.\n'), '<h1> tag kept');
// 12. A refresh is a pure block replacement: everything outside brand:start..brand:end is byte-identical.
const END_MARK = '<!-- brand:end -->';
const outside = md => { const a = md.indexOf('<!-- brand:start'), b = md.indexOf(END_MARK, a) + END_MARK.length; return [md.slice(0, a), md.slice(b)]; };
for (const eol of ['\n', '\r\n']) {
  const installed = rewrite(['<div align="center">', '', '# Foo', '', '### Notice passively. Act explicitly.', '', 'Body with  odd   spacing.', '', '## Quick start', ''].join(eol), r, m);
  const edited = installed.replace('Body with', 'Hand-edited body with'); // author edits made after install must survive
  const next = { ...r, tagline: 'A different tagline.' }, nextM = { ...m, homepage: 'https://x.vercel.app' };
  const refreshed = rewrite(edited, next, nextM);
  assert.deepEqual(outside(refreshed), outside(edited), 'outside-marker text byte-identical after refresh');
  assert.ok(refreshed.includes('A different tagline.') && refreshed.includes('https://x.vercel.app'), 'block itself refreshed');
  assert.equal(rewrite(refreshed, next, nextM), refreshed, 'a second refresh changes nothing');
}
console.log('readme.test: 12 scenarios passed');
