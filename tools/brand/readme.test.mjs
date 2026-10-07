// Scenario checks for the README injector: the real README shapes in the portfolio.
import assert from 'node:assert/strict';
import { apply, header, rewrite } from './readme.mjs';
const r = { repo: 'NodeMem', eyebrow: 'Passive memory', tagline: 'Notice passively. Act explicitly.', steps: ['a', 'b', 'c'] };
const m = { homepage: null, startHere: true, handoff: true };

// 1. Plain "# Name" README with a quickstart: H1 replaced, body untouched, quickstart anchored.
const plain = '# NodeMem\n\nIntro line.\n\n## Quick start\n\nnpm i\n';
const out1 = apply(plain, header(r, m, plain), r.tagline);
assert.ok(!/^# NodeMem$/m.test(out1), 'H1 removed');
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
assert.ok(out4.includes('# install') && !/^# NodeMem$/m.test(out4));

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
console.log('readme.test: 9 scenarios passed');
