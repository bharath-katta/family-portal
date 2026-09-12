#!/usr/bin/env node
/**
 * Family Portal — Build Script
 *
 * Reads src/config.json (an array of "groups" — family or trip sections),
 * encrypts each group's catalog with its own password (AES-256-GCM,
 * PBKDF2 600k iterations), stamps the encrypted catalogs into
 * src/template.html, and writes dist/index.html.
 *
 * Document files themselves are NOT touched here — they are encrypted
 * once, at upload time, by admin.js, and live as opaque blobs under
 * dist/files/. This script only re-encrypts the small catalog (titles,
 * descriptions, structure, and each file's already-generated key), so a
 * password change never requires re-uploading anything.
 *
 * Usage:  node build.js
 * Needs:  Node.js 16+ (no npm packages required — uses built-ins only)
 */

'use strict';
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const rl     = require('readline');
const { encryptJsonWithPassword } = require('./lib/crypto');
const { ICONS } = require('./lib/icons');

const ROOT    = __dirname;
const DIST    = path.join(ROOT, 'dist');
const FILES   = path.join(DIST, 'files');
const TMPL    = path.join(ROOT, 'src', 'template.html');
const CFG     = path.join(ROOT, 'src', 'config.json');
const LOG_CFG = path.join(ROOT, 'src', 'log-worker-config.json');
const PHOTOS  = path.join(ROOT, 'src', 'photos');
const OUT     = path.join(DIST, 'index.html');

const FILES_WARN_BYTES = 700 * 1024 * 1024; // GitHub Pages is comfortable to ~1GB

// ── Colours for terminal output ──
const G  = s => `\x1b[32m${s}\x1b[0m`;   // green
const Y  = s => `\x1b[33m${s}\x1b[0m`;   // yellow
const R  = s => `\x1b[31m${s}\x1b[0m`;   // red
const B  = s => `\x1b[1m${s}\x1b[0m`;    // bold
const DM = s => `\x1b[2m${s}\x1b[0m`;    // dim

// ── Read a password from stdin (hidden — shows * per char) ──
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
      } else if (char === '') {   // backspace
        if (pw.length) { pw = pw.slice(0, -1); process.stdout.write('\b \b'); }
      } else if (char === '') {   // ctrl-c
        process.stdout.write('\n'); process.exit(0);
      } else {
        pw += char; process.stdout.write('*');
      }
    };
    process.stdin.on('data', handler);
  });
}

// ── Convert a photo file to a base64 data-URL ──
function photoToDataUrl(relPath) {
  if (!relPath) return null;
  const full = path.join(PHOTOS, path.basename(relPath));
  if (!fs.existsSync(full)) {
    console.warn(Y(`  ⚠  Photo not found: ${path.basename(relPath)} — using initials`));
    return null;
  }
  const ext  = path.extname(full).toLowerCase();
  const mime = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' }[ext] || 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(full).toString('base64')}`;
}

function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSizeBytes(full) : fs.statSync(full).size;
  }
  return total;
}

async function promptGroupPassword(label) {
  const pw = await promptPassword(`🔑 Password for "${label}" : `);
  if (pw.length < 6) { console.error(R('\n✖  Password must be at least 6 characters.')); process.exit(1); }
  const pwc = await promptPassword(`   Confirm password${' '.repeat(Math.max(0, label.length - 8))}: `);
  if (pw !== pwc) { console.error(R('\n✖  Passwords do not match.')); process.exit(1); }
  return pw;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + B('━━━ Family Portal — Build & Encrypt ━━━') + '\n');

  if (!fs.existsSync(TMPL)) {
    console.error(R('✖  src/template.html not found. Run from the family-portal directory.')); process.exit(1);
  }
  if (!fs.existsSync(CFG)) {
    console.error(R('✖  src/config.json not found.')); process.exit(1);
  }
  fs.mkdirSync(DIST, { recursive: true });
  fs.mkdirSync(FILES, { recursive: true });

  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); }
  catch (e) { console.error(R(`✖  config.json parse error: ${e.message}`)); process.exit(1); }

  if (!Array.isArray(cfg.groups) || cfg.groups.length === 0) {
    console.error(R('✖  config.json must have a non-empty "groups" array.'));
    console.error(Y('   Run `node migrate-config.js` first if this is an old-style config.json.'));
    process.exit(1);
  }

  for (const g of cfg.groups) {
    if (!g.id || !g.label || !g.layout || !g.theme || !Array.isArray(g.sections)) {
      console.error(R(`✖  Group "${g.id || '?'}" is missing one of: id, label, layout, theme, sections.`));
      process.exit(1);
    }
  }

  console.log(DM(`  Groups found: ${cfg.groups.map(g => `${g.label} (${g.sections.length})`).join(', ')}\n`));

  // Resolve avatars (people-layout groups only) — everything else passes through untouched.
  const groupsData = cfg.groups.map(g => ({
    id: g.id,
    label: g.label,
    layout: g.layout,
    theme: g.theme,
    sections: g.sections.map(s => ({
      ...s,
      avatar: g.layout === 'people' ? photoToDataUrl(s.avatar) : undefined,
    })),
  }));

  // Passwords, one per group.
  const encryptedGroups = [];
  for (const g of groupsData) {
    const pw = await promptGroupPassword(g.label);
    process.stdout.write(`  Encrypting "${g.label}" … `);
    const enc = await encryptJsonWithPassword(g, pw);
    console.log(G('done'));
    encryptedGroups.push({ id: g.id, label: g.label, theme: g.theme, layout: g.layout, ...enc });
  }
  console.log('');

  // Access-log endpoint — optional. Until the Worker is deployed and this
  // file exists, the site simply logs nothing (logBeacon() is a no-op with
  // an empty LOG_ENDPOINT), so this never blocks a build.
  let logEndpoint = '';
  let logConnectSrc = '';
  if (fs.existsSync(LOG_CFG)) {
    try {
      const logCfg = JSON.parse(fs.readFileSync(LOG_CFG, 'utf8'));
      if (logCfg.workerUrl) {
        logEndpoint = new URL('/log', logCfg.workerUrl).toString();
        logConnectSrc = ' ' + new URL(logCfg.workerUrl).origin;
      }
    } catch (e) {
      console.warn(Y(`  ⚠  Could not read src/log-worker-config.json (${e.message}) — access log disabled for this build.`));
    }
  }

  // Stamp template.
  process.stdout.write('  Building dist/index.html    … ');
  let html = fs.readFileSync(TMPL, 'utf8');

  const before = html;
  html = html.replace('__GROUPS__', JSON.stringify(encryptedGroups));
  html = html.replace('__ICONS__', JSON.stringify(ICONS));
  html = html.replace('__LOG_ENDPOINT__', logEndpoint);
  html = html.replace('__LOG_CONNECT_SRC__', logConnectSrc);
  if (html === before) {
    console.log('');
    console.error(R('✖  Placeholders "__GROUPS__"/"__ICONS__" not found in template.html.'));
    process.exit(1);
  }

  const missing = html.match(/__[A-Z0-9_]+__/g);
  if (missing) {
    console.log('');
    console.error(R(`✖  Unfilled placeholders: ${missing.join(', ')}`));
    process.exit(1);
  }

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(G('done'));

  // Summary + size warning.
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  const filesBytes = dirSizeBytes(FILES);
  const filesMB = (filesBytes / (1024 * 1024)).toFixed(1);

  console.log('\n' + G('✔  Build complete!'));
  console.log(`   Catalog : dist/index.html (${kb} KB)`);
  console.log(`   Files   : dist/files/ (${filesMB} MB)\n`);

  if (filesBytes > FILES_WARN_BYTES) {
    console.log(Y(`⚠  dist/files/ is over 700MB. GitHub Pages gets uncomfortable past ~1GB —`));
    console.log(Y(`   consider moving to external storage soon.\n`));
  }

  console.log(B('Next steps:'));
  console.log('   1. Open dist/index.html in your browser to verify it works (serve over http://, not file://)');
  console.log('   2. git add dist && git commit -m "Update portal" && git push');
  console.log('\n' + Y('⚠  Security reminder:'));
  console.log('   • Do NOT commit src/config.json or src/photos/ to GitHub');
  console.log('   • The .gitignore already excludes them');
  console.log('   • Keep your passwords stored safely — they cannot be recovered\n');
}

main().catch(e => { console.error(R(`\n✖  ${e.message}`)); process.exit(1); });
