import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { checkPublic } from '../scripts/check-public.mjs';

const events = new Map(), goals = [];
const context = { document: { addEventListener: (event, listener) => events.set(event, listener) }, window: { ym: (...args) => goals.push(args) } };
const source = (await readFile('src/js/analytics.js','utf8')).replace('export function setupAnalytics', 'function setupAnalytics').replace('import.meta.env.VITE_METRIKA_ID', '"12345"');
vm.runInNewContext(source + '\nsetupAnalytics();', context);
events.get('elena:form-success')({ name:'Тестовый Пользователь', phone:'+79000000000' });
assert.equal(goals.length,0,'No analytics before consent');
context.window.elenaAnalyticsConsent = true;
events.get('elena:form-success')({ name:'Тестовый Пользователь', phone:'+79000000000' });
events.get('click')({ target: { closest: () => ({ protocol:'mailto:', href:'mailto:qa@example.invalid' }) } });
assert.deepEqual(goals.map(g=>Array.from(g)),[[12345,'reachGoal','form_success'],[12345,'reachGoal','email_click']]);
assert.ok(!JSON.stringify(goals).includes('example.invalid')&&!JSON.stringify(goals).includes('79000000000'));

const cases = [ ['.env','SMTP_PASSWORD=synthetic'], ['api/contact.php','<?php'], ['assets/main.js.map','{}'], ['src/test.js','export default 1'], ['assets/leak.js',`const token='${'ghp_'+'x'.repeat(36)}'`] ];
for(let i=0;i<cases.length;i++){
  const directory=resolve(`security/.runtime/negative-build-${i}`);
  const [filename,content]=cases[i];
  await mkdir(resolve(directory,filename,'..'),{recursive:true});
  await writeFile(resolve(directory,filename),content);
  await assert.rejects(checkPublic(directory));
}
console.log('Analytics: consent required, only fixed goal names and no contact values. Public build guard rejected 5 unsafe artifacts.');
