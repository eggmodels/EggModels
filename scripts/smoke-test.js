#!/usr/bin/env node
// Serves the production build and loads it in a headless browser to catch a
// blank/gray screen before it reaches deploy - the 2026-11-02 incident this
// guards against was a build that succeeded but rendered nothing in prod.
const path = require('path');
const http = require('http');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const { chromium } = require('playwright');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const PORT = 4173;

function startServer() {
  const serve = serveStatic(BUILD_DIR, { index: ['index.html'] });
  const server = http.createServer((req, res) => {
    serve(req, res, finalhandler(req, res));
  });
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

  const bodyText = await page.evaluate(() => document.body.textContent?.trim() ?? '');
  const rootHasChildren = await page.evaluate(
    () => (document.getElementById('root')?.childElementCount ?? 0) > 0,
  );

  await browser.close();
  server.close();

  const failures = [];
  if (!rootHasChildren || bodyText.length === 0) {
    failures.push('Page rendered with no visible content (blank screen).');
  }
  if (pageErrors.length > 0) {
    failures.push(`Uncaught page error(s): ${pageErrors.join(' | ')}`);
  }
  const fatalConsoleErrors = consoleErrors.filter(
    (text) => !text.includes('Firebase Analytics failed to initialize'),
  );
  if (fatalConsoleErrors.length > 0) {
    failures.push(`Unexpected console error(s): ${fatalConsoleErrors.join(' | ')}`);
  }

  if (failures.length > 0) {
    console.error('Smoke test FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }

  console.log('Smoke test passed: page rendered visible content with no fatal errors.');
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
