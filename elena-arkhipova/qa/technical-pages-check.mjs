// node qa/technical-pages-check.mjs <node_modules> <browser.exe> [site-url] [test-form-url]
// The form-test Vite process must use VITE_CONTACT_ENDPOINT=/api/contact-test
// and VITE_CONTACT_LEGAL_READY=true. Browser routes intercept every test POST.
// Also set VITE_PRIVACY_URL and VITE_CONSENT_URL to same-origin test documents.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(join(resolve(process.argv[2]), 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const site = process.argv[4] || 'http://127.0.0.1:5173/';
const formSite = process.argv[5] || 'http://127.0.0.1:5175/';
const output = resolve('qa/mobile-check/technical');
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const widths = [320, 360, 375, 390, 414, 428, 495, 600, 768, 820, 1024, 1200, 1440, 1920];
const results = [];
async function ready() {
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode())]));
}
try {
  await mkdir(output, { recursive: true });
  for (const name of ['404', 'thanks']) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1200 ? 588 : 883 });
      const response = await page.goto(new URL(`${name}.html`, site).href);
      assert.equal(response.status(), 200);
      await ready();
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('footer#contacts').count(), 1);
      assert.equal(await page.locator('.footer-brand').getAttribute('href'), `${new URL(site).pathname}#home`);
      assert.equal(await page.locator('.golden-intro').count(), 0, 'Reduced-motion skips preloader');
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.equal(await page.locator('.technical-back').getAttribute('href'), new URL(site).pathname);
      const geometry = await page.evaluate(() => {
        const main = document.querySelector('main').getBoundingClientRect();
        const button = document.querySelector('.technical-back').getBoundingClientRect();
        return { buttonHeight: button.height, mainBottom: main.bottom, buttonBottom: button.bottom };
      });
      assert.ok(geometry.buttonHeight >= 39 && geometry.buttonHeight <= 65, `Button stretched at ${width}`);
      assert.ok(geometry.buttonBottom <= geometry.mainBottom + 1);
      results.push({ name, width, status: 'passed' });
      await page.screenshot({ path: join(output, `${name}-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 360, height: 754 });
    await page.getByRole('button', { name: 'Открыть меню' }).click();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#navigation').classList.contains('is-open'));
    assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle');
    await page.locator('.technical-back').click();
    await page.waitForURL(new URL(site).href);
  }
  const missing = await page.goto(new URL('missing/deep/page', site).href);
  assert.equal(missing.status(), 404);
  await ready();
  assert.match(await page.title(), /Страница не найдена/);
  assert.equal(await page.locator('.technical-back').getAttribute('href'), new URL(site).pathname);

  let scenario = 'refused';
  let requests = 0;
  await page.route('**/api/contact-test', async route => {
    requests++;
    if (scenario === 'network') return route.abort('failed');
    if (scenario === 'html') return route.fulfill({ contentType: 'text/html', body: '<html>not an acknowledgement</html>' });
    return route.fulfill({ status: scenario === 'server' ? 500 : 200, contentType: 'application/json', body: JSON.stringify({ ok: scenario === 'success' }) });
  });
  const outcomes = [];
  for (scenario of ['refused', 'server', 'network', 'html', 'success']) {
    await page.goto(formSite);
    await page.locator('.submit-button').click();
    assert.equal(await page.locator('#name').getAttribute('aria-invalid'), 'true');
    await page.locator('#name').fill('Тестовая Проверка');
    await page.locator('#phone').fill('+7 (900) 000-00-00');
    await page.locator('#email').fill('qa@example.invalid');
    await page.locator('#consent').check();
    await page.evaluate(() => document.addEventListener('elena:form-success', () => sessionStorage.setItem('qa-form-success', '1'), { once: true }));
    await page.locator('.submit-button').click();
    if (scenario === 'success') {
      await page.waitForURL(new URL('thanks.html', formSite).href);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('qa-form-success')), '1');
      await page.evaluate(() => sessionStorage.removeItem('qa-form-success'));
      assert.match(await page.locator('h1').textContent(), /Спасибо/);
    } else {
      await page.waitForFunction(() => document.querySelector('#form-status')?.dataset.state === 'error');
      assert.equal(page.url(), formSite);
    }
    outcomes.push({ scenario, status: 'passed' });
  }
  assert.equal(requests, 5, 'Only valid submissions produce intercepted test requests');
  assert.deepEqual(errors, []);
  const result = { site, formSite, widths: results, missingPage: 'HTTP 404', menu: 'passed', homeLinks: 'passed', form: outcomes, realDelivery: 'not tested; requests intercepted', pageErrors: errors };
  await writeFile(join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ pagesAndWidths: results.length, missingPage: result.missingPage, menu: result.menu, form: outcomes, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
