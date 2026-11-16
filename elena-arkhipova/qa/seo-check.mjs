import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const directory = resolve(process.argv[2] || 'dist');
const base = process.argv[3] || '/';
const canonical = process.argv[4];
const html = readFileSync(join(directory, 'index.html'), 'utf8');
assert.equal((html.match(/<h1\b/g) || []).length, 1);
assert.equal((html.match(/<title>/g) || []).length, 1);
assert.equal((html.match(/name="description"/g) || []).length, 1);
assert.equal((html.match(/data-practice="/g) || []).length, 4);
for (const title of ['Уголовно-правовая защита', 'Гражданско-правовая практика', 'Помощь бизнесу', 'Консультации и документы']) assert.ok(html.includes(`<h3>${title}</h3>`));
assert.ok(!/noindex/i.test(html));
const schema = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
assert.deepEqual(schema['@graph'].map(item => item['@type']), ['Person', 'WebSite']);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs');
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (/^(?:https?:|tel:|mailto:|#)/.test(url)) continue;
  assert.ok(url.startsWith(base), `Wrong base: ${url}`);
  assert.ok(existsSync(join(directory, url.slice(base.length))), `Missing resource: ${url}`);
}
for (const name of readdirSync(join(directory, 'assets')).filter(name => name.endsWith('.css'))) {
  const css = readFileSync(join(directory, 'assets', name), 'utf8');
  for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
    if (match[1].startsWith('data:')) continue;
    const path = match[1].startsWith(base) ? join(directory, match[1].slice(base.length)) : resolve(directory, 'assets', match[1]);
    assert.ok(existsSync(path), `Missing CSS resource: ${path}`);
  }
}
const robots = readFileSync(join(directory, 'robots.txt'), 'utf8');
assert.ok(robots.includes('Allow: /'));
if (canonical) {
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
  assert.ok(html.includes(new URL('images/elena-hero.webp', canonical).href));
  assert.ok(readFileSync(join(directory, 'sitemap.xml'), 'utf8').includes(`<loc>${canonical}</loc>`));
  assert.ok(robots.includes(new URL('sitemap.xml', canonical).href));
} else {
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(!existsSync(join(directory, 'sitemap.xml')));
}
console.log('SEO checks passed: static services, metadata, JSON-LD, IDs, local assets, CSS URLs, robots and domain configuration.');
