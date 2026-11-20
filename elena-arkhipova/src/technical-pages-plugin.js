import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// GitHub Pages consumes dist/404.html natively. These middlewares provide the
// same HTTP-404 behaviour for local dev and preview, including nested URLs.
function notFound(render, base) {
  const entries = new Set(['/', '/index.html', '/thanks', '/thanks.html', '/404', '/404.html', '/privacy', '/privacy.html', '/consent', '/consent.html']);
  return async (request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method) || !request.headers.accept?.includes('text/html')) return next();
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const local = base !== '/' && pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
    if (entries.has(local)) return next();
    try {
      const html = await render();
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : html);
    } catch (error) { next(error); }
  };
}

export function technicalPagesPlugin() {
  let config;
  return {
    name: 'technical-pages',
    configResolved(resolved) { config = resolved; },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        if (!html.includes('<!-- technical-header -->')) return html;
        const home = await readFile(resolve(config.root, 'index.html'), 'utf8');
        const shared = pattern => {
          const match = home.match(pattern);
          if (!match) throw new Error('Missing shared markup in index.html');
          return match[1];
        };
        const homeLinks = markup => markup.replace(/href="#(?!main\b)([^"]+)"/g, 'href="%BASE_URL%#$1"');
        const header = homeLinks(shared(/(<header class="header">[\s\S]*?<\/header>)/))
          .replace('class="header"', 'class="header technical-header"');
        const footer = homeLinks(shared(/(<footer class="footer"[\s\S]*?<\/footer>)/));
        const socials = shared(/(<div class="footer-socials"[\s\S]*?<\/div>)/).replace('class="footer-socials"', 'class="technical-socials"');
        const preloader = shared(/<body>\s*(<script>[\s\S]*?<\/script>)/);
        return html.replace('<!-- technical-header -->', '<a class="skip-link" href="#main">Перейти к содержанию</a>\n' + header)
          .replace('<!-- technical-footer -->', footer)
          .replace('<!-- technical-social-links -->', socials)
          .replace('<!-- technical-preloader -->', preloader);
      },
    },
    configureServer(server) {
      return () => server.middlewares.use(notFound(async () => {
        const template = await readFile(resolve(config.root, '404.html'), 'utf8');
        return server.transformIndexHtml('/404.html', template);
      }, config.base));
    },
    configurePreviewServer(server) {
      return () => server.middlewares.use(notFound(() => readFile(resolve(config.root, config.build.outDir, '404.html'), 'utf8'), config.base));
    },
  };
}
