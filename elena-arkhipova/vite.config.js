import { defineConfig, loadEnv } from 'vite';
import { slides } from './src/js/practice-data.js';

const esc = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let site = '';
  if (env.SITE_URL?.trim()) {
    const url = new URL(env.SITE_URL.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('SITE_URL must be HTTPS without credentials, query or hash.');
    site = url.href.replace(/\/?$/, '/');
  }
  const articles = slides.map((s, i) => `<article class="practice-content" data-practice="${i}"><div class="practice-media"><p class="slide-number">${esc(s.label)}</p><img src="/images/${s.image}.webp" width="221" height="294" alt="${esc(s.alt)}" loading="lazy" decoding="async"></div><div class="practice-copy"><h3>${esc(s.title)}</h3><p class="practice-description">${esc(s.description)}</p><ul class="practice-list">${s.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div></article>`).join('\n');
  return { plugins: [{
    name: 'static-seo',
    transformIndexHtml: { order: 'pre', handler(html) {
      const person = { '@type': 'Person', name: 'Елена Александровна Архипова', jobTitle: 'Адвокат', telephone: '+79107877342', email: 'lenarxipova@mail.ru', identifier: '67/32' };
      const website = { '@type': 'WebSite', name: 'Елена Архипова — адвокат', inLanguage: 'ru-RU' };
      if (site) { person.url = site; website.url = site; }
      const title = html.match(/<title>(.*?)<\/title>/)[1];
      const description = html.match(/<meta name="description" content="(.*?)">/)[1];
      const tags = [
        '<meta property="og:type" content="website">', '<meta property="og:locale" content="ru_RU">',
        '<meta property="og:site_name" content="Елена Архипова — адвокат">',
        `<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${description}">`,
      ];
      if (site) tags.push(`<link rel="canonical" href="${esc(site)}">`, `<meta property="og:url" content="${esc(site)}">`,
        `<meta property="og:image" content="${esc(new URL('images/elena-hero.webp', site).href)}">`,
        '<meta property="og:image:width" content="1920">', '<meta property="og:image:height" content="1080">',
        '<meta property="og:image:alt" content="Адвокат Елена Архипова, портрет">', '<meta name="twitter:card" content="summary_large_image">');
      tags.push(`<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [person, website] }).replace(/</g, '\\u003c')}</script>`);
      return html.replace('</head>', `${tags.join('\n')}\n</head>`).replace(/<article class="practice-content">[\s\S]*?<\/article>/, articles);
    } },
    generateBundle() {
      if (!site) this.warn('SITE_URL is empty: canonical, absolute OG image and sitemap omitted until the final domain is known.');
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${new URL('sitemap.xml', site).href}\n` : ''}` });
      if (site) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${esc(site)}</loc></url></urlset>\n` });
    },
  }] };
});
