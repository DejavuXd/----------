import { readdir, readFile, lstat } from 'node:fs/promises';
import { resolve, relative, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkPublic(directory) {
  const roots = new Set(['assets', 'fonts', 'icons', 'images', 'mobile', 'technical', 'legal']);
  const entries = new Set(['index.html', '404.html', 'thanks.html', 'privacy.html', 'consent.html', 'robots.txt', 'sitemap.xml']);
  const extensions = new Set(['.html', '.css', '.js', '.woff2', '.woff', '.svg', '.png', '.webp', '.jpg', '.jpeg', '.ico', '.txt', '.xml', '.pdf']);
  let count = 0;
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const file = resolve(current, entry.name);
      const parts = relative(directory, file).split(/[\\/]/);
      if ((await lstat(file)).isSymbolicLink() || parts.some(p => p.startsWith('.'))
          || (parts.length === 1 && !(entry.isDirectory() ? roots : entries).has(entry.name))
          || (parts.length > 1 && !roots.has(parts[0]))) throw new Error(`Non-public build entry: ${parts.join('/')}`);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!extensions.has(extname(file)) || /(?:composer|package)(?:-lock)?\.json|\.map$|\.php|\.log|\.bak/i.test(basename(file))) throw new Error(`Forbidden build file: ${parts.join('/')}`);
      if (['.html', '.js', '.css', '.svg', '.txt', '.xml'].includes(extname(file))) {
        const content = await readFile(file, 'utf8');
        if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|(?:smtp_password|SMTP_PASSWORD)\s*[:=]\s*["'][^"']+["']/.test(content)) throw new Error(`Possible secret in: ${parts.join('/')}`);
      }
      count++;
    }
  }
  await walk(resolve(directory));
  console.log(`Public build check passed: ${count} files; no private paths, source maps or detected secret patterns.`);
  return count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkPublic(resolve(process.argv[2] || 'dist'));
