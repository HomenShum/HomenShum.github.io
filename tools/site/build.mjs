// Builds the static portfolio into docs/ (served by GitHub Pages from main:/docs).
// Zero client JavaScript. Every page is real text with its own title, description,
// canonical URL, Open Graph card and JSON-LD, so each project is separately indexable.
//
// Motion: rung 2 (CSS hover/focus on cards) and rung 3 (the one "trace" recipe on each hero,
// shared with the README banners). Nothing animates in: text and steps are on the first frame
// (and the largest paint is never held back); a one-shot signal runs the steps in order.
// Finite; reduced motion removes it and leaves the same frame.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'docs');
const SITE = 'https://homenshum.github.io';
const GH = 'https://github.com/HomenShum';
const LINKEDIN = 'https://www.linkedin.com/in/homen-shum/';
const repos = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/repos.json'), 'utf8'));
const profile = JSON.parse(fs.readFileSync(path.join(root, 'tools/brand/profile.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(root, 'tools/site/meta.json'), 'utf8'));

const GROUPS = [
  ['Rooms and products', 'Where people and agents work on the same state.', ['NodeRoom', 'NodeBenchAI', 'NodeSlide', 'NodeVideo', 'NodeVoice']],
  ['Agent runtime and memory', 'What an agent reads, remembers and records.', ['NodeAgent', 'NodeMem', 'NodeGraph', 'NodeTrace', 'NodeRL']],
  ['Proof and quality', 'Checks, task corpora and protocols for reviewing agent work.', ['NodeProof', 'agentic-ui-qa', 'NodeTasks', 'FeatureClipStudio', 'BetterPRHandoff', 'parity-studio']],
  ['Build kits and specs', 'Starting points for the next agent application.', ['NodeKit', 'NodeAgentSpec', 'NodeBenchBoilerplate']],
];
const grouped = GROUPS.flatMap(g => g[2]);
const missing = repos.map(r => r.repo).filter(r => !grouped.includes(r));
if (missing.length) throw new Error(`repos without a group: ${missing}`);

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = r => r.repo.toLowerCase();
const nameOf = r => r.name || r.repo;
// Long camel-case names (NodeBenchBoilerplate) may wrap at word joins instead of overflowing a phone.
const wbr = s => esc(s).replace(/([a-z])([A-Z])/g, "$1<wbr>$2");
const byRepo = Object.fromEntries(repos.map(r => [r.repo, r]));
const isLive = u => u && !/^https:\/\/(github\.com|homenshum\.github\.io)\//.test(u); // not GitHub, not this site
const liveUrl = r => isLive(meta[r.repo].homepage) ? meta[r.repo].homepage : (r.live || null);
const month = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const CSS = `
@font-face{font-family:Inter;src:url(/assets/inter.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"JetBrains Mono";src:url(/assets/mono.woff2) format("woff2");font-weight:500;font-display:swap}
:root{color-scheme:light dark;--bg:#fafafa;--panel:#fff;--ink:#111418;--muted:#4b5563;--faint:#636c77;--line:#e2e5e9;--wire:#c3c8cf;--accent:#D97757;--accent-ink:#9c4f37;
--wash:#fbebe5;--r-control:8px;--r-panel:12px;--r-shell:14px;--ease:cubic-bezier(.2,.7,.2,1);--fast:180ms;--pulse:400ms;--hop:260ms;--t0:250ms;
--shadow-rest:0 0 0 1px rgba(0,0,0,.03),0 1px 2px rgba(0,0,0,.05);--shadow-lift:0 1px 2px rgba(0,0,0,.04),0 14px 34px -14px rgba(17,20,24,.22);
--ui:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#101317;--panel:#171b20;--ink:#f3f4f6;--muted:#a7afb9;--faint:#8d96a1;--line:#262c33;--wire:#3a424c;--accent-ink:#EC9C82;--wash:#2b1d18;
--shadow-rest:0 0 0 1px rgba(255,255,255,.045);--shadow-lift:0 0 0 1px rgba(255,255,255,.08),0 28px 80px -26px rgba(0,0,0,.85)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/1.6 var(--ui);-webkit-font-smoothing:antialiased;
background-image:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--ink) 7%,transparent) 1px,transparent 0);background-size:24px 24px}
a{color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.skip{position:absolute;left:-999px;top:8px;background:var(--panel);padding:8px 12px;border-radius:var(--r-control);z-index:9}
.skip:focus{left:16px}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0}
.brand{display:inline-flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.01em;text-decoration:none}
.mark{width:12px;height:12px;border-radius:3px;background:var(--accent)}
.top nav{display:flex;gap:4px;flex-wrap:wrap}
.top nav a{font-size:14px;color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:var(--r-control);transition:color var(--fast) var(--ease),background var(--fast) var(--ease)}
.top nav a:hover{color:var(--ink);background:color-mix(in srgb,var(--ink) 6%,transparent)}
.eyebrow{display:flex;align-items:center;gap:10px;margin:0;font:500 12.5px/1.4 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.eyebrow::before{content:"";width:9px;height:9px;border-radius:2px;background:var(--accent);flex:none}
.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:48px;align-items:center;padding:72px 0 88px}
.hero h1{margin:16px 0 0;font-weight:800;font-size:clamp(34px,5.2vw,60px);line-height:1.04;letter-spacing:-.035em;text-wrap:balance}
.lede{margin:20px 0 0;max-width:38rem;font-size:clamp(17px,1.6vw,20px);line-height:1.55;color:var(--muted);text-wrap:pretty}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:var(--r-control);border:1px solid var(--line);background:var(--panel);
font-weight:600;font-size:15px;text-decoration:none;box-shadow:var(--shadow-rest);transition:transform var(--fast) var(--ease),box-shadow var(--fast) var(--ease),border-color var(--fast) var(--ease)}
.btn:hover{transform:translateY(-1px);box-shadow:var(--shadow-lift);border-color:var(--wire)}
.btn.primary{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.stair{list-style:none;margin:0;padding:0;font:500 15px/1 var(--mono);--dx:clamp(28px,4.2vw,64px);--gap:18px}
.stair li{position:relative;display:flex;align-items:center;gap:12px;width:max-content;max-width:calc(100% - var(--i)*var(--dx));height:42px;padding:0 16px;margin:0 0 var(--gap) calc(var(--i)*var(--dx));
background:var(--panel);border:1px solid var(--line);border-radius:var(--r-control);box-shadow:var(--shadow-rest);animation:pulse var(--pulse) var(--ease);animation-delay:calc(var(--t0) + var(--i)*var(--hop) - 40ms)}
.stair li span{color:var(--faint);font-size:12px}
.stair li:last-child{border-color:var(--accent);color:var(--accent-ink);margin-bottom:0}
.stair li:last-child span{color:var(--accent-ink)}
.stair li+li::before{content:"";position:absolute;left:calc(22px - var(--dx));top:calc(-1*var(--gap) - 1px);width:calc(var(--dx) - 22px);height:calc(var(--gap) + 21px);
border-left:1.5px solid var(--wire);border-bottom:1.5px solid var(--wire);border-bottom-left-radius:8px;animation:signal var(--pulse) var(--ease);animation-delay:calc(var(--t0) + var(--i)*var(--hop) - 300ms)}
.stair li:last-child::after{content:"";position:absolute;inset:-1px;border:1.5px solid var(--accent);border-radius:inherit;opacity:0;pointer-events:none;animation:halo var(--pulse) var(--ease);animation-delay:calc(var(--t0) + var(--i)*var(--hop) + 120ms)}
@keyframes pulse{45%{border-color:var(--accent);background:var(--wash)}}
@keyframes signal{40%{border-color:var(--accent)}}
@keyframes halo{from{opacity:.8}to{opacity:0;transform:scale(1.08,1.5)}}
section.group{padding:8px 0 56px}
.group header{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;padding-bottom:18px;margin-bottom:22px;border-bottom:1px solid var(--line)}
.group h2{margin:0;font-size:24px;letter-spacing:-.02em}
.group header p{margin:0;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:16px;list-style:none;margin:0;padding:0}
.card{display:flex;flex-direction:column;gap:10px;height:100%;padding:22px;border-radius:var(--r-panel);border:1px solid var(--line);background:var(--panel);box-shadow:var(--shadow-rest);
text-decoration:none;transition:transform var(--fast) var(--ease),box-shadow var(--fast) var(--ease),border-color var(--fast) var(--ease)}
.card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lift);border-color:var(--wire)}
.card h3{margin:2px 0 0;font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.card .tag{margin:0;color:var(--muted);text-wrap:pretty}
.chain{display:flex;flex-wrap:wrap;gap:4px 0;list-style:none;margin:auto 0 0;padding:6px 0 0;font:500 12.5px/1.6 var(--mono);color:var(--ink)}
.chain li:not(:last-child)::after{content:"›";color:var(--faint);padding:0 8px}
.chain li:last-child{color:var(--accent-ink)}
.meta{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--faint)}
.meta li{padding:2px 8px;border:1px solid var(--line);border-radius:999px}
.crumbs{font-size:14px;color:var(--faint);padding-top:8px}
.crumbs a{color:var(--muted)}
.project .hero{padding:48px 0 64px}
.project .hero h1{font-size:clamp(44px,7vw,84px)}
.facts{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.7fr);gap:40px;padding:8px 0 64px;border-top:1px solid var(--line)}
.facts h2{font-size:15px;letter-spacing:.02em;text-transform:uppercase;font-family:var(--mono);font-weight:500;color:var(--faint);margin:32px 0 12px}
.facts p{margin:0;color:var(--muted);font-size:17px}
.links{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0}
.links a{display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:0 14px;border:1px solid var(--line);border-radius:var(--r-control);background:var(--panel);text-decoration:none;font-weight:600;
transition:border-color var(--fast) var(--ease),transform var(--fast) var(--ease)}
.links a:hover{border-color:var(--accent);transform:translateX(2px)}
.links a span{color:var(--faint);font:500 12px var(--mono)}
.demo{padding:0 0 64px}.demo h2{font:500 15px/1.4 var(--mono);letter-spacing:.02em;text-transform:uppercase;color:var(--faint);margin:0 0 16px}.demo figure{margin:0}
.demo img{display:block;max-width:100%;height:auto;border:1px solid var(--line);border-radius:var(--r-panel);background:var(--panel);box-shadow:var(--shadow-rest)}
.demo figcaption{margin-top:12px;font:500 12.5px/1.6 var(--mono);color:var(--faint)}.demo figcaption a{color:var(--muted)}
.demo .still{display:none;margin:0;padding:18px;border:1px dashed var(--wire);border-radius:var(--r-panel);color:var(--muted)}
@media (prefers-reduced-motion:reduce){.demo img.anim{display:none}.demo .still{display:block}}
.topics{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0;padding:0}
.topics li{font:500 12.5px/1 var(--mono);padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 10%,transparent);color:var(--accent-ink)}
footer{border-top:1px solid var(--line);padding:28px 0 48px;color:var(--faint);font-size:14px}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
footer a{color:var(--muted)}
@media (max-width:820px){.hero,.facts{grid-template-columns:1fr;gap:36px}.hero{padding:40px 0 56px}.stair{--dx:22px}}
@media (max-width:480px){.wrap{padding:0 16px}.top nav a{padding:6px 8px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`.replace(/\n/g, '');

const stair = steps => `<ol class="stair" aria-label="How it works">${steps.map((s, i) => `<li style="--i:${i}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(s)}</li>`).join('')}</ol>`;

function page({ urlPath, title, description, image, jsonld, body, main = "" }) {
  const url = SITE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101317" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Homen Shum">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="640">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/inter.woff2" as="font" type="font/woff2" crossorigin>
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
<header class="top"><a class="brand" href="/"><span class="mark" aria-hidden="true"></span>Homen Shum</a>
<nav aria-label="Primary"><a href="/#projects">Projects</a><a href="${GH}">GitHub</a><a href="${LINKEDIN}">LinkedIn</a></nav></header>
<main id="main"${main ? ` class="${main}"` : ""}>
${body}
</main>
</div>
<footer><div class="wrap"><span>Homen Shum · built from <a href="${GH}/HomenShum.github.io">source</a>, no client JavaScript</span><span><a href="${GH}">github.com/HomenShum</a></span></div></footer>
</body>
</html>
`;
}

const person = { '@type': 'Person', name: 'Homen Shum', url: `${SITE}/`, sameAs: [GH, LINKEDIN] };

function card(r) {
  const m = meta[r.repo];
  const facts = [m.language, m.license, liveUrl(r) && (r.liveLabel || 'Live demo')].filter(Boolean);
  return `<li><a class="card" href="/${slug(r)}/">
<p class="eyebrow">${esc(r.eyebrow)}</p>
<h3>${wbr(nameOf(r))}</h3>
<p class="tag">${esc(r.tagline)}</p>
<ol class="chain" aria-label="Workflow">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
<ul class="meta" aria-label="Facts">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
</a></li>`;
}

function home() {
  const body = `<section class="hero">
<div>
<p class="eyebrow">${esc(profile.eyebrow)} · human and agent collaboration</p>
<h1>${esc(profile.tagline)}</h1>
<p class="lede">I build tools that make agent work inspectable: shared rooms where people and agents edit the same state, runtimes that record receipts, and configurable gates that check declared completion criteria.</p>
<div class="cta"><a class="btn primary" href="#projects">Browse ${repos.length} projects</a><a class="btn" href="${GH}">GitHub profile</a></div>
</div>
${stair(profile.steps)}
</section>
<div id="projects">
${GROUPS.map(([title, sub, list]) => `<section class="group" aria-labelledby="g-${slug({ repo: title.replace(/\W+/g, '-') })}">
<header><h2 id="g-${slug({ repo: title.replace(/\W+/g, '-') })}">${esc(title)}</h2><p>${esc(sub)}</p></header>
<ul class="grid">${list.map(n => card(byRepo[n])).join('')}</ul>
</section>`).join('\n')}
</div>`;
  return page({
    urlPath: '/', title: 'Homen Shum: agent reliability and human-agent collaboration',
    description: `${profile.tagline} ${repos.length} public repositories for shared agent rooms, agent runtimes, memory, traces and proof gates.`,
    image: '/brand/HomenShum/social.png',
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { ...person, '@id': `${SITE}/#person`, description: profile.tagline },
      { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Homen Shum', author: { '@id': `${SITE}/#person` } },
      { '@type': 'ItemList', itemListElement: grouped.map((n, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/${slug(byRepo[n])}/`, name: nameOf(byRepo[n]) })) },
    ] },
    body,
  });
}

// The README's first raster media (fetch.mjs), below the facts and lazy so it is never part of the first paint.
// The page adds no animation; an animated image (classified by its bytes in fetch.mjs, not its extension) plays itself, so under prefers-reduced-motion it is hidden (no JS) and linked instead.
// No media (none in the README, or over the byte cap) renders nothing.
const demo = (r, m, repoUrl, gif = !!m.media?.animated, alt = m.media?.alt ?? `${nameOf(r)} demo from the README`) => !m.media ? '' : `<section class="demo" aria-labelledby="demo"><h2 id="demo">From the README</h2>
<figure><img src="${esc(m.media.url)}" alt="${esc(alt)}" width="${m.media.width}" height="${m.media.height}" loading="lazy" decoding="async"${gif ? ' class="anim"' : ''}>${gif ? `<p class="still">${alt ? `${esc(alt)}${/[.!?]$/.test(alt) ? '' : '.'} ` : ''}Animated demo hidden because your device asks for reduced motion. <a href="${esc(m.media.url)}">Open the animation</a>.</p>` : ''}
<figcaption><code>${esc(r.repo)}/${esc(m.media.path)}</code> · ${m.media.width}×${m.media.height}, ${(m.media.bytes / 1048576).toFixed(1)} MB · <a href="${repoUrl}#readme">in the README</a></figcaption></figure></section>`;

function project(r) {
  const m = meta[r.repo], repoUrl = `${GH}/${r.repo}`, live = liveUrl(r);
  const blob = f => `${repoUrl}/blob/${m.branch}/${f}`;
  const links = [
    ['Source on GitHub', repoUrl, 'github'],
    live && [r.liveLabel || 'Live demo', live, new URL(live).host],
    m.startHere && ['Code walkthrough', blob('docs/START_HERE.md'), 'START_HERE.md'],
    m.handoff && ['Developer handoff', blob('HANDOFF.md'), 'HANDOFF.md'],
  ].filter(Boolean);
  const group = GROUPS.find(g => g[2].includes(r.repo));
  const related = group[2].filter(n => n !== r.repo).map(n => byRepo[n]);
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Homen Shum</a> / ${esc(group[0])} / ${esc(nameOf(r))}</nav>
<section class="hero">
<div>
<p class="eyebrow">${esc(r.eyebrow)}</p>
<h1>${wbr(nameOf(r))}</h1>
<p class="lede">${esc(r.tagline)}</p>
<div class="cta"><a class="btn primary" href="${repoUrl}">View source</a>${live ? `<a class="btn" href="${esc(live)}">${esc(r.liveLabel || 'Open live demo')}</a>` : ''}</div>
</div>
${stair(r.steps)}
</section>
<section class="facts">
<div>
<h2>What it is</h2>
<p>${esc(m.description)}</p>
${m.topics.length ? `<h2>Topics</h2><ul class="topics">${m.topics.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
</div>
<div>
<h2>Start here</h2>
<ul class="links">${links.map(([label, href, hint]) => `<li><a href="${esc(href)}">${esc(label)}<span>${esc(hint)}</span></a></li>`).join('')}</ul>
<h2>Facts</h2>
<ul class="meta">${[m.language, m.license && `${m.license} license`, `Updated ${month(m.pushedAt)}`].filter(Boolean).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
</div>
</section>
${demo(r, m, repoUrl)}
<section class="group" aria-labelledby="related">
<header><h2 id="related">More in ${esc(group[0].toLowerCase())}</h2><p>${esc(group[1])}</p></header>
<ul class="grid">${related.map(card).join('')}</ul>
</section>`;
  return page({
    main: "project", urlPath: `/${slug(r)}/`, title: `${nameOf(r)}: ${r.tagline}`, description: `${r.tagline} ${m.description}`.slice(0, 300),
    image: `/brand/${r.repo}/social.png`,
    jsonld: { '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: nameOf(r), description: m.description, url: `${SITE}/${slug(r)}/`,
      codeRepository: repoUrl, programmingLanguage: m.language || undefined, license: m.license ? `https://spdx.org/licenses/${m.license}.html` : undefined,
      keywords: m.topics.join(', '), dateModified: m.pushedAt, dateCreated: m.createdAt, author: person, ...(live ? { sameAs: [live] } : {}) },
    body,
  });
}

fs.rmSync(out, { recursive: true, force: true });
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(out, p)), { recursive: true }); fs.writeFileSync(path.join(out, p), s); };
write('index.html', home());
for (const r of repos) write(`${slug(r)}/index.html`, project(r));
write('404.html', page({ urlPath: '/404.html', title: 'Not found · Homen Shum', description: 'This page does not exist.', image: '/brand/HomenShum/social.png', jsonld: { '@context': 'https://schema.org', ...person },
  body: `<section class="hero"><div><p class="eyebrow">404</p><h1>That page does not exist.</h1><div class="cta"><a class="btn primary" href="/">Back to all projects</a></div></div></section>` }));
write('.nojekyll', '');
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
const newest = Object.values(meta).map(m => m.pushedAt).sort().at(-1);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${SITE}/</loc><lastmod>${newest.slice(0, 10)}</lastmod></url>\n${repos.map(r => `<url><loc>${SITE}/${slug(r)}/</loc><lastmod>${meta[r.repo].pushedAt.slice(0, 10)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('assets/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#101317"/><rect x="10" y="10" width="12" height="12" rx="3" fill="#D97757"/></svg>`);
fs.copyFileSync(path.join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'), path.join(out, 'assets/inter.woff2'));
fs.copyFileSync(path.join(root, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2'), path.join(out, 'assets/mono.woff2'));
for (const r of [...repos, profile]) {
  fs.mkdirSync(path.join(out, 'brand', r.repo), { recursive: true });
  fs.copyFileSync(path.join(root, 'brand', r.repo, 'social.png'), path.join(out, 'brand', r.repo, 'social.png')); // og:image
}
const size = p => fs.statSync(path.join(out, p)).size;
console.log(`docs/: index ${(size('index.html') / 1024).toFixed(1)}KB, ${repos.length} project pages, sitemap ${repos.length + 1} urls`);
