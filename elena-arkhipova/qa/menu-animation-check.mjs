// node qa/menu-animation-check.mjs <node_modules containing playwright> <browser.exe> [url]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(join(resolve(process.argv[2]), 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
const page = await browser.newPage({ viewport: { width: 360, height: 754 }, reducedMotion: 'no-preference' });
const url = process.argv[4] || 'http://127.0.0.1:5174/';
const output = resolve('qa/mobile-check/menu-animation');
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const open = () => page.getByRole('button', { name: 'Открыть меню' }).click();
const opened = () => page.waitForFunction(() => document.querySelector('#navigation').dataset.menuState === 'open');
const closed = async () => {
  await page.waitForFunction(() => !document.querySelector('#navigation').classList.contains('is-open'));
  assert.deepEqual(await page.evaluate(() => ({
    locked: document.body.style.position,
    inert: document.querySelector('main').inert,
    clip: getComputedStyle(document.querySelector('#navigation')).clipPath,
    animations: document.querySelector('#navigation').getAnimations({ subtree: true }).length,
  })), { locked: '', inert: false, clip: 'none', animations: 0 });
};
try {
  await mkdir(output, { recursive: true });
  await page.goto(url);
  await page.waitForSelector('.golden-intro', { state: 'detached' });
  await page.evaluate(() => document.fonts.ready);

  // Seek real Web Animations to deterministic points for visual inspection.
  await open();
  for (const time of [0, 180, 360, 540, 760]) {
    await page.evaluate(time => {
      document.querySelector('#navigation').getAnimations({ subtree: true }).forEach(animation => {
        animation.pause();
        animation.currentTime = time;
      });
    }, time);
    await page.screenshot({ path: join(output, `opening-${time}.png`) });
  }
  await page.evaluate(() => document.querySelector('#navigation').getAnimations({ subtree: true }).forEach(animation => animation.finish()));
  await opened();
  assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-close');
  await page.keyboard.press('Escape');
  await closed();
  assert.equal(await page.evaluate(() => document.activeElement.className), 'menu-toggle');

  // Interrupt actual in-flight transitions repeatedly, not just their final states.
  for (let i = 0; i < 4; i++) {
    await open();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await closed();
  }

  await open();
  await page.keyboard.press('Tab');
  await opened();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#practice');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.protocol), 'mailto:');
  await page.locator('#navigation a[href="#about"]').click();
  await closed();
  await page.waitForFunction(() => document.activeElement.id === 'about');

  // Scroll lock restores the original position even for a nonzero scroll offset.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const fixedButton = await page.locator('.menu-toggle').boundingBox();
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
  assert.deepEqual(await page.locator('.menu-toggle').boundingBox(), fixedButton);
  await open();
  await opened();
  await page.locator('.menu-close').click();
  await closed();
  assert.equal(await page.evaluate(() => scrollY), 600);

  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  const footerScroll = await page.evaluate(() => scrollY);
  assert.deepEqual(await page.locator('.menu-toggle').boundingBox(), fixedButton);
  await open();
  await opened();
  await page.locator('.menu-close').click();
  await closed();
  assert.equal(await page.evaluate(() => scrollY), footerScroll);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await open();
  await page.setViewportSize({ width: 1200, height: 900 });
  await closed();
  assert.equal(await page.locator('#navigation').getAttribute('role'), null);
  assert.equal(await page.locator('#navigation').isVisible(), true, 'Desktop navigation is still visible');

  await page.setViewportSize({ width: 360, height: 754 });
  await open();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await opened();
  assert.equal(await page.evaluate(() => document.querySelector('#navigation').getAnimations({ subtree: true }).length), 0);
  await page.locator('.menu-close').click();
  await closed();
  await open();
  await opened();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#navigation')).clipPath), 'none');
  await page.keyboard.press('Escape');
  await closed();

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open();
  await opened();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await closed();

  const widths = [];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const width of [320, 360, 390, 428, 768, 1024]) {
    await page.setViewportSize({ width, height: 754 });
    await open();
    await opened();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#navigation')).clipPath), 'none');
    await page.locator('.menu-close').click();
    await closed();
    widths.push(width);
  }
  assert.deepEqual(errors, []);
  const result = { widths, interruption: 'passed', keyboard: 'passed', anchors: 'passed', scrollRestore: 'passed', fixedButtonAtMiddleAndFooter: 'passed', desktopResize: 'passed', reducedMotion: 'passed', consoleErrors: errors };
  await writeFile(join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
