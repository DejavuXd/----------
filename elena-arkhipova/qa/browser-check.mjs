import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Run: node qa/browser-check.mjs <absolute path to playwright/index.mjs>
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await mkdir('qa/screenshots', { recursive: true });
const sizes = [];
try {
  for (const width of [1920, 1440, 1200, 1024, 768, 480, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    if (dimensions.content > width) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right }))));
    assert.ok(dimensions.content <= width, `Horizontal overflow at ${width}: ${dimensions.content}`);
    sizes.push(dimensions);
    await page.screenshot({ path: `qa/screenshots/${width}.png`, fullPage: true });
  }
  const menu = page.getByRole('button', { name: 'Меню' });
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  await menu.click();
  await page.locator('#navigation').getByRole('link', { name: 'Обо мне' }).click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'about');
  await page.locator('.submit-button').click();
  assert.equal(await page.locator('#name').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#consent').getAttribute('aria-invalid'), 'true');
  await page.locator('#name').fill('Тестовая Проверка');
  await page.locator('#phone').fill('+7 (900) 000-00-00');
  await page.locator('#email').fill('test@example.invalid');
  await page.locator('#consent').check();
  let submitted = false;
  page.on('request', request => { if (request.method() === 'POST') submitted = true; });
  await page.locator('.submit-button').click();
  assert.match(await page.locator('#form-status').textContent(), /Не удалось отправить запрос/);
  assert.equal(submitted, false, 'Unconfigured form must not send personal data');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
  assert.deepEqual(errors, []);
  await writeFile('qa/results.json', JSON.stringify({ sizes, consoleErrors: errors, navigation: 'passed', validation: 'passed', unconfiguredForm: 'no request sent', reducedMotion: 'passed', typography: 'awaiting supplied font', actualDelivery: 'not configured' }, null, 2));
  console.log(JSON.stringify({ sizes, checks: 'passed' }, null, 2));
} finally {
  await browser.close();
}
