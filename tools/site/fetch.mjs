// Snapshot the live GitHub metadata the site shows (description, homepage, language, topics, license).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const repos = JSON.parse(fs.readFileSync('tools/brand/repos.json', 'utf8'));
const q = `query{ ${repos.map((r, i) => `r${i}: repository(owner:"HomenShum",name:"${r.repo}"){ name description homepageUrl stargazerCount pushedAt createdAt licenseInfo{spdxId} primaryLanguage{name} defaultBranchRef{name} startHere: object(expression:"HEAD:docs/START_HERE.md"){id} handoff: object(expression:"HEAD:HANDOFF.md"){id} readme: object(expression:"HEAD:README.md"){... on Blob{text}} repositoryTopics(first:20){nodes{topic{name}}} }`).join(' ')} }`;
const data = JSON.parse(execFileSync('gh', ['api', 'graphql', '-f', `query=${q}`], { maxBuffer: 1 << 24 })).data;
const meta = Object.fromEntries(Object.values(data).map(r => [r.name, {
  description: r.description, homepage: r.homepageUrl || null, stars: r.stargazerCount, pushedAt: r.pushedAt, createdAt: r.createdAt,
  license: r.licenseInfo?.spdxId || null, language: r.primaryLanguage?.name || null, branch: r.defaultBranchRef.name,
  topics: r.repositoryTopics.nodes.map(n => n.topic.name),
  startHere: !!r.startHere, handoff: !!r.handoff,
  headings: (r.readme?.text || '').split(/\r?\n/).filter(l => /^#{2,3} /.test(l)).map(l => l.replace(/^#+ /, '').trim()),
}]));
fs.writeFileSync('tools/site/meta.json', JSON.stringify(meta, null, 2) + '\n');
console.log(Object.keys(meta).length, 'repos');
