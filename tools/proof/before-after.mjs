// Before/after of a merged README change, both rendered by github.com at the README top:
// before = the README at the merge commit's parent, after = the README at the merge commit.
// usage: node tools/proof/before-after.mjs <out.png> Repo=<mergeSha> ...
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
const [out, ...pairs] = process.argv.slice(2);
const b = await chromium.launch();
const shot = async url => {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })).newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForFunction(() => { const a = document.querySelector('article.markdown-body'); return a && [...a.querySelectorAll('img')].slice(0, 2).every(i => i.complete); }, null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const box = await p.evaluate(() => { const q = document.querySelector('article.markdown-body').getBoundingClientRect(); return { x: q.x + scrollX, y: q.y + scrollY, w: q.width }; });
  const png = await p.screenshot({ fullPage: true, clip: { x: box.x - 8, y: box.y - 8, width: box.w + 16, height: 430 } });
  await p.close();
  return png.toString('base64');
};
const rows = [];
for (const pair of pairs) {
  const [repo, sha] = pair.split('=');
  const parent = execFileSync('gh', ['api', `repos/HomenShum/${repo}/commits/${sha}`, '--jq', '.parents[0].sha']).toString().trim();
  rows.push([repo, await shot(`https://github.com/HomenShum/${repo}/blob/${parent}/README.md`), await shot(`https://github.com/HomenShum/${repo}/blob/${sha}/README.md`)]);
}
const page = await b.newPage({ viewport: { width: 1760, height: 600 } });
await page.setContent(`<body style="margin:0;padding:18px;background:#fff;font:600 15px system-ui">${rows.map(([r, a, z]) => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px"><div><div style="color:#666;margin-bottom:6px">${r} · before</div><img src="data:image/png;base64,${a}" style="width:100%;border:1px solid #ddd"></div><div><div style="color:#9c4f37;margin-bottom:6px">${r} · after</div><img src="data:image/png;base64,${z}" style="width:100%;border:1px solid #ddd"></div></div>`).join('')}`);
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await b.close();
