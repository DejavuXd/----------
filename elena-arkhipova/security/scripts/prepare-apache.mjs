import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const directory = resolve(process.argv[2] || 'dist');
const hashes = new Set();
for (const page of ['index.html', '404.html', 'thanks.html', 'privacy.html', 'consent.html']) {
  const html = await readFile(resolve(directory, page), 'utf8');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    // HTML parsing normalizes CRLF/CR to LF before CSP hashes are checked.
    if (!/\bsrc\s*=/i.test(match[1]) && match[2]) hashes.add(`'sha256-${createHash('sha256').update(match[2].replace(/\r\n?/g, '\n')).digest('base64')}'`);
  }
}
const template = await readFile(new URL('../server/.htaccess.example', import.meta.url), 'utf8');
const output = resolve('security/.generated/.htaccess');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, template.replace('@@SCRIPT_HASHES@@', [...hashes].join(' ')));
console.log(`Prepared ${output} with ${hashes.size} inline-script hashes. HTTPS and HSTS remain disabled pending hosting checks.`);
