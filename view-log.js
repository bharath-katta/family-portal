#!/usr/bin/env node
'use strict';
/**
 * Family Portal — Access Log Viewer
 *
 * Fetches the encrypted visit log from the Cloudflare Worker, decrypts it
 * locally with a password-protected private key, and opens a one-time,
 * fully offline summary page. The temp file is deleted from disk within a
 * few seconds of opening — nothing persists after the browser tab is
 * closed, and none of this ever touches the git repo or GitHub.
 *
 * First run (no src/log-key.json yet): generates the RSA keypair and sets
 * the log password. Every run after that: enter the password to view.
 *
 * Usage: node view-log.js   (or ./view-log.sh)
 * Needs: Node.js 18+ (uses built-in Web Crypto — no npm packages required)
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const rl = require('readline');
const https = require('https');
const { execFile } = require('child_process');
const logCrypto = require('./lib/log-crypto');

const ROOT = __dirname;
const KEY_FILE = path.join(ROOT, 'src', 'log-key.json');
const WORKER_CFG_FILE = path.join(ROOT, 'src', 'log-worker-config.json');
const SUMMARY_TEMPLATE = path.join(ROOT, 'src', 'log-summary-template.html');
const DELETE_DELAY_MS = 2500;

const G = s => `\x1b[32m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;
const DM = s => `\x1b[2m${s}\x1b[0m`;

// ── Read a password from stdin (hidden — shows * per char). Same recipe as build.js. ──
function promptPassword(question) {
  return new Promise(resolve => {
    if (!process.stdin.isTTY) {
      const iface = rl.createInterface({ input: process.stdin });
      iface.once('line', ans => { iface.close(); resolve(ans.trim()); });
      return;
    }
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let pw = '';
    const handler = char => {
      if (char === '\r' || char === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(pw);
      } else if (char === '') { // backspace
        if (pw.length) { pw = pw.slice(0, -1); process.stdout.write('\b \b'); }
      } else if (char === '') { // ctrl-c
        process.stdout.write('\n'); process.exit(0);
      } else {
        pw += char; process.stdout.write('*');
      }
    };
    process.stdin.on('data', handler);
  });
}

async function promptNewPassword() {
  const pw = await promptPassword('🔑 Choose a log password: ');
  if (pw.length < 6) { console.error(R('\n✖  Password must be at least 6 characters.')); process.exit(1); }
  const pwc = await promptPassword('   Confirm password       : ');
  if (pw !== pwc) { console.error(R('\n✖  Passwords do not match.')); process.exit(1); }
  return pw;
}

async function firstRunSetup() {
  console.log('\n' + B('━━━ Family Portal — Access Log: first-time setup ━━━') + '\n');
  console.log('This generates a keypair for the encrypted access log.');
  console.log('The private key is stored locally, locked behind a password you choose now —');
  console.log(DM('separate from any group password, and needed every time you want to view the log.\n'));

  const pw = await promptNewPassword();
  const { publicKeySpki, privateKeyJwk } = await logCrypto.generateKeyPair();
  const keyFile = await logCrypto.buildKeyFile(publicKeySpki, privateKeyJwk, pw);
  fs.writeFileSync(KEY_FILE, JSON.stringify(keyFile, null, 2));

  console.log(G(`\n✔  Saved ${KEY_FILE}`));
  console.log(Y('   This file is gitignored and never leaves your Mac. Losing it or the password'));
  console.log(Y('   makes the log permanently unreadable — back it up somewhere safe.\n'));
  console.log(B('Paste this public key into worker/wrangler.toml as PUBLIC_KEY_SPKI:') + '\n');
  console.log(publicKeySpki);
  console.log('\nThen finish the Worker setup steps in GUIDE.md before running this again.\n');
}

function loadWorkerConfig() {
  if (!fs.existsSync(WORKER_CFG_FILE)) {
    console.log(Y('\n⚠  src/log-worker-config.json not found.'));
    console.log('Create it once the Worker is deployed — see GUIDE.md. Shape:\n');
    console.log(DM('  { "workerUrl": "https://zerostress-log.<you>.workers.dev",'));
    console.log(DM('    "exportToken": "<the same value you set via wrangler secret put EXPORT_TOKEN>" }\n'));
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WORKER_CFG_FILE, 'utf8'));
}

function fetchExport(workerUrl, exportToken) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL('/export', workerUrl); } catch (e) { return reject(e); }
    const req = https.request(url, { method: 'GET', headers: { Authorization: `Bearer ${exportToken}` } }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`Worker returned HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function perDayUniqueCounts(rows) {
  const byDay = new Map();
  for (const r of rows) {
    const day = r.ts.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(r.ip_fingerprint);
  }
  return [...byDay.entries()]
    .map(([day, set]) => ({ day, unique: set.size }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

// Best-effort: open in a private/incognito window so the browser doesn't
// retain history/cache for the temp file. Falls back to a normal window.
function openSummary(filePath) {
  const fileUrl = 'file://' + filePath;
  const candidates = [
    { app: 'Google Chrome', flag: '--incognito' },
    { app: 'Brave Browser', flag: '--incognito' },
    { app: 'Microsoft Edge', flag: '--inprivate' },
    { app: 'Firefox', flag: '--private-window' },
  ];
  for (const c of candidates) {
    if (fs.existsSync(`/Applications/${c.app}.app`)) {
      try {
        execFile('open', ['-na', c.app, '--args', c.flag, fileUrl]);
        return true;
      } catch { /* try the next candidate */ }
    }
  }
  execFile('open', [filePath]);
  return false;
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    await firstRunSetup();
    return;
  }

  const workerCfg = loadWorkerConfig();
  const keyFile = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));

  console.log('\n' + B('━━━ Family Portal — Access Log ━━━') + '\n');
  const pw = await promptPassword('🔑 Log password: ');

  let privateKey;
  try {
    privateKey = await logCrypto.unlockPrivateKey(keyFile, pw);
  } catch {
    console.error(R('\n✖  Incorrect password, or the key file is corrupt.'));
    process.exit(1);
  }

  console.log(DM('\nFetching from the Worker…'));
  let rows;
  try {
    rows = await fetchExport(workerCfg.workerUrl, workerCfg.exportToken);
  } catch (e) {
    console.error(R(`\n✖  Could not reach the Worker: ${e.message}`));
    process.exit(1);
  }

  console.log(DM(`Decrypting ${rows.length} event${rows.length === 1 ? '' : 's'}…`));
  const events = [];
  for (const row of rows) {
    try {
      const payload = await logCrypto.decryptPayload(row.payload, privateKey);
      events.push({ id: row.id, ts: row.ts, ...payload });
    } catch {
      // Sealed with a different/older key — skip rather than fail the whole view.
    }
  }

  const perDay = perDayUniqueCounts(rows);
  const allTimeUnique = new Set(rows.map(r => r.ip_fingerprint)).size;

  if (!fs.existsSync(SUMMARY_TEMPLATE)) {
    console.error(R(`\n✖  ${SUMMARY_TEMPLATE} not found.`));
    process.exit(1);
  }
  const template = fs.readFileSync(SUMMARY_TEMPLATE, 'utf8');
  const data = { generatedAt: new Date().toISOString(), events, perDay, allTimeUnique };
  const json = JSON.stringify(data).replace(/</g, '\\u003c'); // defang </script>
  const html = template.replace('__LOG_DATA__', json);

  const tmpFile = path.join(os.tmpdir(), `zerostress-log-${crypto.randomBytes(6).toString('hex')}.html`);
  fs.writeFileSync(tmpFile, html);

  const openedPrivate = openSummary(tmpFile);
  if (openedPrivate) {
    console.log(G('\n✔  Opened in a private window.'));
  } else {
    console.log(Y('\n⚠  Opened in a normal window (no supported private-browsing browser found) —'));
    console.log(Y('   the browser may remember this file\'s name and title in its own history.'));
  }

  setTimeout(() => {
    try { fs.unlinkSync(tmpFile); } catch { /* already gone */ }
  }, DELETE_DELAY_MS);

  console.log(DM('\nThe temporary file is deleted from disk in a few seconds — the open tab keeps'));
  console.log(DM('working from what it already loaded. Close it when you\'re done; nothing persists.\n'));
}

main();
