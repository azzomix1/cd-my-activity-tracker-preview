import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:5174/';
const OUTPUT_DIR = path.resolve('artifacts', 'visual-smoke-pass');

const STATES = [
  { name: 'desktop-aurora-calendar', viewport: { width: 1440, height: 1200 }, theme: 'aurora', view: 'calendar' },
  { name: 'desktop-aurora-cabinet', viewport: { width: 1440, height: 1200 }, theme: 'aurora', view: 'cabinet' },
  { name: 'desktop-midnight-calendar', viewport: { width: 1440, height: 1200 }, theme: 'midnight', view: 'calendar' },
  { name: 'desktop-midnight-cabinet', viewport: { width: 1440, height: 1200 }, theme: 'midnight', view: 'cabinet' },
  { name: 'mobile-aurora-calendar', viewport: { width: 390, height: 844 }, theme: 'aurora', view: 'calendar' },
  { name: 'mobile-aurora-cabinet', viewport: { width: 390, height: 844 }, theme: 'aurora', view: 'cabinet' },
  { name: 'mobile-midnight-calendar', viewport: { width: 390, height: 844 }, theme: 'midnight', view: 'calendar' },
  { name: 'mobile-midnight-cabinet', viewport: { width: 390, height: 844 }, theme: 'midnight', view: 'cabinet' },
];

async function ensureTheme(page, theme) {
  const themeButton = page.getByRole('button', { name: /Пресет:/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentTheme = await page.evaluate(() => globalThis.document.body.getAttribute('data-theme'));

    if (currentTheme === theme) {
      return;
    }

    await themeButton.click();
    await page.waitForTimeout(150);
  }

  throw new Error(`Failed to switch theme to ${theme}.`);
}

async function ensureView(page, view) {
  const label = view === 'calendar' ? /Календарь/i : /Кабинет/i;
  await page.getByRole('button', { name: label }).click();
  if (view === 'calendar') {
    await page.locator('.calendar-toolbar').waitFor({ state: 'visible', timeout: 10000 });
    return;
  }

  await page.locator('.cabinet__content').waitFor({ state: 'visible', timeout: 15000 });
}

async function captureState(browser, state) {
  const context = await browser.newContext({
    viewport: state.viewport,
    deviceScaleFactor: 1,
    isMobile: state.viewport.width <= 480,
    hasTouch: state.viewport.width <= 480,
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await ensureTheme(page, state.theme);
  await ensureView(page, state.view);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${state.name}.png`),
    fullPage: true,
  });

  const metrics = await page.evaluate(() => ({
    bodyTheme: globalThis.document.body.getAttribute('data-theme'),
    bodyScrollWidth: globalThis.document.body.scrollWidth,
    bodyClientWidth: globalThis.document.body.clientWidth,
    rootScrollWidth: globalThis.document.documentElement.scrollWidth,
    rootClientWidth: globalThis.document.documentElement.clientWidth,
  }));

  await context.close();
  return { name: state.name, ...metrics };
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  try {
    const results = [];

    for (const state of STATES) {
      results.push(await captureState(browser, state));
    }

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'metrics.json'),
      JSON.stringify(results, null, 2),
      'utf8',
    );

    console.log(`Saved ${results.length} screenshots to ${OUTPUT_DIR}`);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});