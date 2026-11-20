// node security/tests/browser-check.mjs <node_modules with playwright> <browser.exe>
// Test-only static HTTP server; never a production Node backend.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { chromium } = createRequire(join(resolve(process.argv[2]), 'package.json'))('playwright');
const builds = [resolve('dist'), resolve('security/.runtime/client-build')];
const hashes = new Set();
for (const directory of builds) for (const page of ['index.html','404.html','thanks.html']) {
  const html = await readFile(join(directory,page),'utf8');
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if(!/\bsrc\s*=/i.test(m[1])&&m[2]) hashes.add(`'sha256-${createHash('sha256').update(m[2].replace(/\r\n?/g,'\n')).digest('base64')}'`);
}
const template = await readFile('security/server/.htaccess.example','utf8');
const csp = template.match(/^Header always set Content-Security-Policy "([^"]+)"/m)[1].replace('@@SCRIPT_HASHES@@',[...hashes].join(' '));
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const configured=url.pathname.startsWith('/configured/');
  let pathname=configured?url.pathname.slice('/configured'.length):url.pathname;
  if(pathname==='/')pathname='/index.html';
  const file=resolve(builds[Number(configured)],'.'+pathname);
  if(!file.startsWith(builds[Number(configured)]+ '\\')&&!file.startsWith(builds[Number(configured)]+'/')){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Security-Policy',csp);
  res.setHeader('X-Content-Type-Options','nosniff');
  try{
    if(pathname.startsWith('/legal/')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Тестовый документ</title>Только для локальной проверки');return;}
    const content=await readFile(file).catch(()=>readFile(resolve(builds[1],'.'+pathname)));
    res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');
    res.end(content);
  }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
// Configured build asset URLs are root-absolute: route its assets to that build.
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
const page=await browser.newPage({reducedMotion:'reduce'});
const errors=[];const violations=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  window.__csp=[];window.__goals=[];window.elenaAnalyticsConsent=true;
  window.ym=(...args)=>window.__goals.push(args);
  document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective));
});
const output=resolve('security/.runtime/browser');await mkdir(output,{recursive:true});
try{
  for(const name of ['index','404','thanks']) for(const width of [320,390,768,1024,1200,1920]){
    await page.setViewportSize({width,height:883});await page.goto(`${origin}/${name}.html`);
    await page.evaluate(()=>{document.querySelectorAll('img').forEach(i=>i.loading='eager');return Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode())]);});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    assert.equal(await page.locator('footer').count(),1);
    violations.push(...await page.evaluate(()=>window.__csp));
    if([390,1200].includes(width))await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true});
  }
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
  for(const name of ['index','404','thanks']){
    await page.goto(`${origin}/${name}.html`);
    await page.waitForFunction(()=>window.goldenIntro?.started,{},{timeout:5000}).catch(async()=>{throw new Error(JSON.stringify({name,state:await page.evaluate(()=>({intro:!!window.goldenIntro,started:window.goldenIntro?.started,overlay:!!document.querySelector('.golden-intro'),violations:window.__csp,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches})),errors}));});
    await page.locator('.golden-intro').waitFor({state:'detached'});
    await page.waitForFunction(()=>!document.querySelector('.site').inert);
    await page.getByRole('button',{name:'Открыть меню'}).click();await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('#navigation').classList.contains('is-open'));
    violations.push(...await page.evaluate(()=>window.__csp));
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  let posts=0;let outcome='refused';
  await page.route('**/api/contact.php',route=>{
    posts++;const data=route.request().postDataJSON();
    assert.deepEqual(Object.keys(data).sort(),['consent','email','name','phone','website']);
    return route.fulfill({status:outcome==='limited'?429:200,contentType:'application/json',body:JSON.stringify({ok:outcome==='success'})});
  });
  await page.goto(origin);
  await page.locator('#name').fill('Тестовый Пользователь');await page.locator('#phone').fill('+79000000000');await page.locator('#consent').check();
  await page.locator('.submit-button').click();assert.equal(posts,0,'Unconfigured stays closed');
  for(const scenario of ['refused','limited','success']){
    outcome=scenario;await page.goto(origin+'/configured/');
    assert.equal(await page.locator('.consent a').count(),2);
    assert.notEqual(await page.locator('#email').getAttribute('required'),null);
    await page.locator('#name').fill('<script>alert(1)</script>');await page.locator('#phone').fill('+79000000000');await page.locator('#consent').check();
    await page.locator('.submit-button').click();assert.equal(await page.locator('#name').getAttribute('aria-invalid'),'true');
    await page.locator('#name').fill('Тестовый Пользователь');
    await page.locator('.submit-button').click();
    assert.equal(await page.locator('#email').getAttribute('aria-invalid'),'true');
    await page.locator('#email').fill('qa@example.invalid');
    await page.locator('.submit-button').click();
    if(scenario==='success')await page.waitForURL(origin+'/thanks.html');
    else {await page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='error');assert.equal(page.url(),origin+'/configured/');}
    violations.push(...await page.evaluate(()=>window.__csp));
    assert.deepEqual(await page.evaluate(()=>window.__goals),[],'No analytics counter configured');
  }
  assert.equal(posts,3);assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
  const result={pagesAndWidths:18,preloaderAndMenu:'passed',CSP:'no violations',form:'required email, legal links, XSS, unavailable/429/success passed',realMailSent:false,pageErrors:errors};
  await writeFile(join(output,'results.json'),JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();await new Promise(r=>server.close(r));}
