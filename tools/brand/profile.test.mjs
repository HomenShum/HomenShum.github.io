// Scenario checks for the profile README rewrite: a maintainer re-runs it after every brand change.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'profile.mjs');
const run = dir => spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'profile-test-'));
const legacy = '<h2 align="center">Homen Shum</h2>\n\n<h3 align="center">Old tagline.</h3>\n\nKEEP BIOGRAPHY\n\n### Background\nKeep background.\n';
const count = (s, t) => s.split(t).length - 1;
const assets = d => fs.readdirSync(path.join(d, 'assets'), { recursive: true }).filter(f => f.endsWith('.svg')).length;

// 1. Legacy header -> banner + cards; an immediate re-run changes nothing and exits 0 (LF and CRLF).
for (const eol of ['\n', '\r\n']) {
  const d = tmp(); fs.writeFileSync(path.join(d, 'README.md'), legacy.replace(/\n/g, eol));
  assert.equal(run(d).status, 0, 'first run');
  const first = fs.readFileSync(path.join(d, 'README.md'), 'utf8');
  assert.equal(count(first, '<picture>') > 0 && count(first, '### Selected projects'), 1, 'cards once');
  assert.ok(first.includes('KEEP BIOGRAPHY') && first.includes('Keep background.') && !first.includes('Old tagline'), 'text kept, legacy header gone');
  assert.equal(first.includes('\r\n'), eol === '\r\n', 'line endings kept');
  assert.equal(assets(d), 16, '16 assets');
  assert.equal(run(d).status, 0, 'second run exits 0');
  assert.equal(fs.readFileSync(path.join(d, 'README.md'), 'utf8'), first, 'second run is a no-op on the README');
  // A stale banner (different alt) is rewritten, not stacked.
  fs.writeFileSync(path.join(d, 'README.md'), first.replace(/alt="Homen Shum: [^"]*"/, 'alt="stale"'));
  assert.equal(run(d).status, 0);
  assert.equal(fs.readFileSync(path.join(d, 'README.md'), 'utf8'), first, 'stale banner rewritten in place');
}

// 2. A header whose shape changed must fail without touching the README (never eat body text).
const d = tmp();
fs.writeFileSync(path.join(d, 'README.md'), legacy);
assert.equal(run(d).status, 0);
const installed = fs.readFileSync(path.join(d, 'README.md'), 'utf8');
const joined = installed.replace('  </picture>\n</a>', '  </picture></a>') + '\n<a href="https://example.org/">\n  <picture>\n  <img src="body.svg">\n  </picture>\n</a>\n';
assert.notEqual(joined, installed);
fs.writeFileSync(path.join(d, 'README.md'), joined);
const bad = run(d);
assert.notEqual(bad.status, 0, 'changed header shape exits non-zero');
assert.match(bad.stderr, /header shape changed/);
assert.equal(fs.readFileSync(path.join(d, 'README.md'), 'utf8'), joined, 'README untouched on failure');
console.log('profile.test: 2 scenarios passed');
