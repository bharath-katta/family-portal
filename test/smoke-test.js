#!/usr/bin/env node
'use strict';
/**
 * Family Portal — Safari smoke test.
 *
 * Drives real Safari (via safaridriver, built into macOS) through the
 * site's core flows against a disposable, dummy-data test build — never
 * touches real config.json/dist/. This exists because every regression this
 * project has hit (popup-blocker, blob-across-windows, the hidden-overlay
 * CSS bug) was a real-Safari behavior a Chromium-only or code-reading check
 * would have missed.
 *
 * One-time setup required (not run by this script — needs an admin
 * password, which nothing automated should be typing):
 *   sudo safaridriver --enable
 *
 * Usage: node test/smoke-test.js   (or ./test.sh)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { SafariSession } = require('./webdriver');
const { buildTestSite, TEST_PASSWORD } = require('./build-test-site');

const DRIVER_PORT = 9321;
const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const mark = pass ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m';
  console.log(`  ${mark} ${name}${detail ? ' — ' + detail : ''}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitFor(fn, timeoutMs = 5000, intervalMs = 150) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

function startStaticServer(rootDir) {
  const MIME = { '.html': 'text/html', '.bin': 'application/octet-stream' };
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(rootDir, reqPath === '/' ? 'index.html' : reqPath);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zerostress-smoketest-'));
  console.log(`\nBuilding test site in ${tmpDir} …`);
  await buildTestSite(tmpDir);

  const { server, port } = await startStaticServer(tmpDir);
  const driver = spawn('safaridriver', ['-p', String(DRIVER_PORT)]);
  driver.stderr.on('data', () => {}); // safaridriver logs to stderr even on success — ignore

  const session = new SafariSession(DRIVER_PORT);
  let exitCode = 0;

  try {
    await sleep(800); // let safaridriver finish starting
    await session.start();
    await session.navigateTo(`http://127.0.0.1:${port}/index.html`);
    await sleep(500);

    console.log('\nRunning checks:');

    // Spy on download clicks so we can verify both routing (which items
    // download vs. view inline) and the extension-aware filename fix.
    await session.executeScript(`
      window.__downloads = [];
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) window.__downloads.push(this.download);
        return orig.call(this);
      };
    `);

    // 1. Regression guard for the exact bug just fixed: overlay must not
    // cover the page (or block clicks) before any file has been opened.
    const overlayDisplay = await session.executeScript(`return getComputedStyle(document.getElementById('file-viewer')).display;`);
    record('file-viewer is not visible on initial load', overlayDisplay === 'none', `display=${overlayDisplay}`);

    const hasGroupCard = await session.executeScript(`return !!document.querySelector('.group-card');`);
    record('welcome screen renders a group card', hasGroupCard === true);

    // 2. Unlock flow: wrong password, then lockout, then correct password.
    await session.executeScript(`selectGroup('testgroup');`);
    record('selecting a group shows the password screen',
      await waitFor(() => session.executeScript(`return document.getElementById('screen-password').classList.contains('active');`)));

    for (let i = 0; i < 3; i++) {
      await session.executeScript(`document.getElementById('pw-input').value = 'wrongpassword'; tryUnlock();`);
      await sleep(700); // PBKDF2 + wrong-password path
    }
    const lockedOut = await session.executeScript(`return document.getElementById('pw-lockout').classList.contains('show');`);
    record('3 wrong attempts trigger the lockout', lockedOut === true);

    // Reset lockout state for the rest of the run rather than waiting out the real 30s.
    await session.executeScript(`lockoutUntil = 0; failCount = 0; hideLockout();`);
    await session.executeScript(`document.getElementById('pw-input').value = ${JSON.stringify(TEST_PASSWORD)}; tryUnlock();`);
    record('correct password unlocks the family screen',
      await waitFor(() => session.executeScript(`return document.getElementById('screen-family').classList.contains('active');`), 8000));

    // 3. Section rendering.
    const memberCount = await session.executeScript(`return document.querySelectorAll('.member-btn').length;`);
    record('family screen shows the one test section', memberCount === 1, `count=${memberCount}`);

    await session.executeScript(`document.querySelector('.member-btn').click();`);
    record('opening the section shows the items screen',
      await waitFor(() => session.executeScript(`return document.getElementById('screen-person').classList.contains('active');`)));

    const itemCount = await session.executeScript(`return document.querySelectorAll('.doc-btn').length;`);
    record('section shows all 6 test items', itemCount === 6, `count=${itemCount}`);

    // 4. Image under the size cap opens the in-page viewer.
    await session.executeScript(`[...document.querySelectorAll('.doc-btn')].find(b => b.textContent.includes('Small Image')).click();`);
    const viewerOpened = await waitFor(() => session.executeScript(`return getComputedStyle(document.getElementById('file-viewer')).display !== 'none';`), 8000);
    const hasImg = viewerOpened && await session.executeScript(`return !!document.querySelector('#fv-body img');`);
    record('small image opens the in-page viewer', hasImg === true);
    await session.executeScript(`closeFileViewer();`);
    record('closing the viewer hides it again',
      await waitFor(() => session.executeScript(`return getComputedStyle(document.getElementById('file-viewer')).display === 'none';`)));

    // 5. Oversized image (>15MB metadata) falls through to download, with the right extension.
    await session.executeScript(`[...document.querySelectorAll('.doc-btn')].find(b => b.textContent.includes('Big Image')).click();`);
    await sleep(1200);
    const bigImageDownload = await session.executeScript(`return window.__downloads.includes('Big Image.png');`);
    const viewerStillHidden1 = await session.executeScript(`return getComputedStyle(document.getElementById('file-viewer')).display === 'none';`);
    record('oversized image downloads instead of opening the viewer', bigImageDownload === true && viewerStillHidden1 === true);

    // 6. PDF downloads directly (no inline iframe attempt) with a .pdf extension.
    await session.executeScript(`[...document.querySelectorAll('.doc-btn')].find(b => b.textContent.includes('Sample Document')).click();`);
    await sleep(1200);
    const pdfDownload = await session.executeScript(`return window.__downloads.includes('Sample Document.pdf');`);
    record('PDF downloads with a .pdf extension', pdfDownload === true);

    // 7. CSV downloads with a .csv extension.
    await session.executeScript(`[...document.querySelectorAll('.doc-btn')].find(b => b.textContent.includes('Sample Sheet')).click();`);
    await sleep(1200);
    const csvDownload = await session.executeScript(`return window.__downloads.includes('Sample Sheet.csv');`);
    record('CSV downloads with a .csv extension', csvDownload === true);

    // 8. Locking clears state and returns to the welcome screen.
    await session.executeScript(`doLock();`);
    record('locking returns to the welcome screen',
      await waitFor(() => session.executeScript(`return document.getElementById('screen-welcome').classList.contains('active');`)));

  } catch (e) {
    console.error('\nTest run crashed:', e.message);
    exitCode = 1;
  } finally {
    await session.quit();
    driver.kill();
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  ✘ ${f.name}`));
    exitCode = 1;
  }
  process.exit(exitCode);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
