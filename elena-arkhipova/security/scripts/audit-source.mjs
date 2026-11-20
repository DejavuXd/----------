import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}/;
const paths = execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n');
const findings = [];
for (const file of paths) {
  try { if(secret.test(await readFile(resolve(file),'utf8')))findings.push(file); } catch {}
}
// Capture internally; never print potential secret contents or diffs.
const history = execFileSync('git',['log','--all','-p','--format=commit:%h'],{encoding:'utf8',maxBuffer:32*1024*1024});
if(secret.test(history)) findings.push('git history: credential-like pattern detected');
const html = await readFile('index.html','utf8');
const remoteScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)/gi)].map(m=>m[1]);
console.log(JSON.stringify({filesChecked:paths.length,credentialPatternFindings:findings,remoteScripts,limitations:'Pattern scan only; not proof that every possible secret is absent.'},null,2));
if(findings.length)process.exitCode=1;
