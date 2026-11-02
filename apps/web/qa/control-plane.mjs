// Optional browser smoke checks. Use a locally installed Playwright and loopback Vite.
// Run: BSK_PLAYWRIGHT_MODULE=<absolute module entry> node apps/web/qa/control-plane.mjs
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(pathToFileURL(process.env.BSK_PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({ channel: process.env.BSK_BROWSER_CHANNEL || undefined, headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
});
mkdirSync('.cache/ui-preview', { recursive: true });
try {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5173/');
    const mobile = width <= 700;
    const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    if (mobile) {
      assert.equal(await nav.isVisible(), false);
      await toggle.focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Overview', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Overview', exact: true }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Escape');
      assert.equal(await nav.isVisible(), false);
      assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: 'Close navigation' }).click();
      assert.equal(await nav.isVisible(), false);
    }
    for (const name of ['Projects', 'Environments', 'Services', 'Domains & routes', 'Releases', 'Observability', 'Overview']) {
      if (mobile) { await toggle.focus(); await page.keyboard.press('Enter'); }
      const item = nav.getByRole('button', { name, exact: true });
      await item.focus(); await page.keyboard.press('Enter');
      const heading = page.getByRole('heading', { level: 1 });
      await page.waitForFunction(() => document.activeElement?.tagName === 'H1');
      assert.equal(await heading.innerText(), name === 'Overview' ? 'Platform overview' : name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: ${name} overflow`);
      if (mobile) assert.equal(await nav.isVisible(), false);
      if (name !== 'Overview') assert.equal(await page.getByRole('button', { name: 'Operations unavailable' }).isDisabled(), true);
    }
    await page.screenshot({ path: `.cache/ui-preview/overview-${width}.png`, fullPage: true });
  }
  // Breakpoint focus must not remain on an element that becomes hidden.
  await page.setViewportSize({ width: 390, height: 900 });
  const toggle = page.getByRole('button', { name: 'Open navigation', exact: true });
  await toggle.focus();
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-current') === 'page');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-controls') === 'primary-sidebar');
  assert.equal(await toggle.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('navigation').waitFor();
  const ratios = await page.locator('.brand strong, .brand span, .nav-caption, .nav-item, .sidebar-footer p, .sidebar-footer a, .breadcrumb, .preview-tag, .page-heading p, .notice h2, .notice p, .metric dt, .metric dd, .metric p, .slice-card h3, .slice-card p, .slice-next, .slice-next span, .status, .disclaimer').evaluateAll(elements => {
    function luminance(rgb) {
      const values = rgb.match(/[\d.]+/g).slice(0, 3).map(v => {
        const c = Number(v) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    }
    return elements.map(el => {
      let parent = el;
      while (getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)' && parent.parentElement) parent = parent.parentElement;
      const a = luminance(getComputedStyle(el).color); const b = luminance(getComputedStyle(parent).backgroundColor);
      return { text: el.textContent.slice(0, 40), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  for (const sample of ratios) assert.ok(sample.ratio >= 4.5, `${sample.text}: ${sample.ratio} contrast`);
  assert.deepEqual(errors, []);
  console.log(`Browser smoke passed: four widths, seven views, keyboard/Escape/selection/resize focus, disabled actions, reduced motion, no console errors; ${ratios.length} rendered text contrast samples passed (minimum ${Math.min(...ratios.map(s => s.ratio)).toFixed(2)}:1).`);
} finally { await browser.close(); }
