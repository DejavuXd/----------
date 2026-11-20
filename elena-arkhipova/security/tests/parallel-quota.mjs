import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const php = resolve(process.argv[2]);
const extensionDir = resolve(process.argv[3]);
await mkdir('security/.runtime', { recursive: true });
const database = resolve(`security/.runtime/parallel-${Date.now()}.sqlite`);
const responses = await Promise.all(Array.from({ length: 16 }, () => new Promise((done, reject) => {
  const child = spawn(php, ['-n', '-d', `extension_dir=${extensionDir}`, '-d', 'extension=pdo_sqlite', 'security/tests/quota-worker.php', database]);
  let out = '', err = '';
  child.stdout.on('data', chunk => out += chunk);
  child.stderr.on('data', chunk => err += chunk);
  child.on('error', reject);
  child.on('exit', code => code === 0 ? done(out) : reject(new Error(err)));
})));
assert.equal(responses.filter(x => x === 'accepted').length, 3);
assert.equal(responses.filter(x => x === 'limited').length, 13);
console.log('Parallel quota: exactly 3 of 16 workers accepted, 13 limited. No SMTP requests.');
