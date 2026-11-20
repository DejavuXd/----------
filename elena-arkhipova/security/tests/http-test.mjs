// Local PHP server only. Synthetic addresses; SMTP points to closed loopback:465.
import { spawn } from 'node:child_process';
import { cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const php = resolve(process.argv[2]), extensionDir = resolve(process.argv[3]);
const run = resolve(`security/.runtime/http-${Date.now()}`);
const web = run + '/web', privateDir = run + '/private';
await mkdir(web + '/api', { recursive: true });
await mkdir(privateDir + '/runtime', { recursive: true });
await cp('security/php/contact.php', web + '/api/contact.php');
await cp('security/php/App.php', privateDir + '/App.php');
await cp('security/vendor', privateDir + '/vendor', { recursive: true });
await writeFile(privateDir + '/config.php', `<?php return [
 'enabled'=>true,'legal_ready'=>true,'origin'=>'https://example.test','rate_key'=>'${'test-only-'.repeat(8)}',
 'rate_db'=>__DIR__.'/runtime/quota.sqlite','smtp'=>['host'=>'127.0.0.1','port'=>465,'encryption'=>'smtps',
 'username'=>'sender@example.test','from'=>'sender@example.test','to'=>'qa@example.test','password'=>'test-only-not-real']];`);
const server = spawn(php, ['-n', '-d', `extension_dir=${extensionDir}`, '-d', 'extension=mbstring', '-d', 'extension=pdo_sqlite', '-d', 'extension=openssl', '-d', 'display_errors=0', '-S', '127.0.0.1:8099', '-t', web], { env: { ...process.env, ELENA_CONTACT_PRIVATE_DIR: privateDir } });
let logs = '';
server.stdout.on('data', d => logs += d);
server.stderr.on('data', d => logs += d);
const url = 'http://127.0.0.1:8099/api/contact.php';
const headers = { Origin: 'https://example.test', 'Content-Type': 'application/json' };
const body = JSON.stringify({ name: 'Тестовый Пользователь', phone: '+79000000000', email: 'qa@example.invalid', consent: true, website: '' });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { await fetch(url); ready = true; break; } catch { await new Promise(r => setTimeout(r, 50)); } }
  assert.ok(ready, 'PHP server started');
  async function expect(status, options) {
    const response = await fetch(url, options);
    assert.ok((Array.isArray(status) ? status : [status]).includes(response.status), `Unexpected HTTP ${response.status}`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(response.headers.get('x-powered-by'), null);
    const text = await response.text();
    assert.equal(JSON.parse(text).ok, false);
    assert.ok(!/password|stack|runtime|SMTP|example\.test/i.test(text));
    return response;
  }
  await expect(405, { method: 'GET' });
  await expect(405, { method: 'OPTIONS' });
  await expect(415, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body });
  await expect(413, { method: 'POST', headers, body: ' '.repeat(4097) });
  await expect(403, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body });
  await expect(403, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  await expect(400, { method: 'POST', headers, body: '{invalid' });
  await expect(422, { method: 'POST', headers, body: JSON.stringify({ ...JSON.parse(body), website: 'bot' }) });
  await expect(503, { method: 'POST', headers, body }); // Real PHPMailer: local connection refused, never success.
  await expect(422, { method: 'POST', headers, body: '{}' });
  await expect(422, { method: 'POST', headers, body: '{}' });
  // A fixed-minute boundary can occur during this test. Repeat only invalid
  // requests (no SMTP) and allow at most two windows, instead of assuming time.
  let limited;
  for (let i = 0; i < 11; i++) {
    const response = await expect([422, 429], { method: 'POST', headers, body: '{}' });
    if (response.status === 429) { limited = response; break; }
  }
  assert.ok(limited && Number(limited.headers.get('retry-after')) > 0);
  for (const token of ['Тестовый Пользователь', '+79000000000', 'qa@example.invalid', 'test-only-not-real']) assert.ok(!logs.includes(token), 'No contact content/secrets in PHP test logs');
  const state = await readFile(privateDir + '/runtime/quota.sqlite');
  assert.ok(!state.includes(Buffer.from('qa@example.invalid')) && !state.includes(Buffer.from('127.0.0.1')), 'Only keyed counters in database');
  console.log('HTTP: methods, types, size, Origin, JSON, honeypot, SMTP refusal, quotas, safe responses/logs passed. No external SMTP.');
} finally { server.kill(); }
