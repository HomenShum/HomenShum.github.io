// Offline determinism check: rebuild the site from the committed tools/site/meta.json into a temp dir and fail if it differs from docs/.
// Catches a docs/ that was hand-edited, built from a stale meta.json, or built by an out-of-date build.mjs. No network.
// CHECK_BUILD_DOCS=<dir> compares against that directory instead of docs/ (used to show the check bites: copy docs/, change one byte, point this at it).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const docs = path.resolve(process.env.CHECK_BUILD_DOCS || path.join(root, 'docs'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'check-build-'));
try {
  execFileSync(process.execPath, [path.join(root, 'tools/site/build.mjs'), tmp], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  const diff = (...flags) => spawnSync('git', ['diff', '--no-index', '--no-renames', ...flags, '--', docs, tmp], { encoding: 'utf8' });
  if (!fs.statSync(docs, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${docs} is not a directory: nothing to compare`);
  const names = diff('--name-only', '-z');
  if (names.error || ![0, 1].includes(names.status) || (names.status === 1 && !names.stdout)) throw new Error(`git diff failed (status ${names.status}): ${names.error || names.stderr}`);
  if (names.stdout) {
    const flat = p => p.split(path.sep).join('/');
    const rel = names.stdout.split('\0').filter(Boolean).map(p => flat(p).replace(flat(tmp) + '/', '').replace(flat(docs) + '/', ''));
    console.error(`check-build: ${docs} differs from a fresh build of tools/site/meta.json in ${rel.length} path(s):\n${rel.map(p => '  ' + p).join('\n')}\n${diff('--stat').stdout}`);
    process.exitCode = 1;
  } else console.log(`check-build: ${path.relative(root, docs) || docs} is byte-identical to a fresh build (no network)`);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
