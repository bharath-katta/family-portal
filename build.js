#!/usr/bin/env node
/**
 * Family Portal — Build Script
 *
 * Reads src/config.json, encrypts each family's data with its own
 * password (AES-256-GCM, PBKDF2 600k iterations), stamps the
 * encrypted blobs into src/template.html, and writes dist/index.html.
 *
 * Usage:  node build.js
 * Needs:  Node.js 16+ (no npm packages required — uses built-ins only)
 */

'use strict';
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const rl     = require('readline');

const ROOT    = __dirname;
const DIST    = path.join(ROOT, 'dist');
const TMPL    = path.join(ROOT, 'src', 'template.html');
const CFG     = path.join(ROOT, 'src', 'config.json');
const PHOTOS  = path.join(ROOT, 'src', 'photos');
const OUT     = path.join(DIST, 'index.html');

// ── Colours for terminal output ──
const G  = s => `\x1b[32m${s}\x1b[0m`;   // green
const Y  = s => `\x1b[33m${s}\x1b[0m`;   // yellow
const R  = s => `\x1b[31m${s}\x1b[0m`;   // red
const B  = s => `\x1b[1m${s}\x1b[0m`;    // bold
const DM = s => `\x1b[2m${s}\x1b[0m`;    // dim

// ── Read a line from stdin (visible) ──
function prompt(question) {
  return new Promise(resolve => {
    const iface = rl.createInterface({ input: process.stdin, output: process.stdout });
    iface.question(question, ans => { iface.close(); resolve(ans.trim()); });
  });
}

// ── Read a password from stdin (hidden — shows * per char) ──
function promptPassword(question) {
  return new Promise(resolve => {
    if (!process.stdin.isTTY) {
      // Non-interactive (e.g. piped) — read normally
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

// ── AES-256-GCM encrypt with PBKDF2 key derivation ──
async function encryptJson(data, password) {
  const json = JSON.stringify(data);
  const salt = crypto.randomBytes(16);
  const iv   = crypto.randomBytes(12);

  const key = await new Promise((ok, fail) =>
    crypto.pbkdf2(password, salt, 600000, 32, 'sha256', (err, k) => err ? fail(err) : ok(k))
  );

  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag       = cipher.getAuthTag();                       // 16 bytes
  const ciphertext = Buffer.concat([encrypted, tag]);          // append tag so Web Crypto can verify

  return {
    salt: salt.toString('base64'),
    iv:   iv.toString('base64'),
    data: ciphertext.toString('base64')
  };
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + B('━━━ Family Portal — Build & Encrypt ━━━') + '\n');

  // 1. Check prerequisites
  if (!fs.existsSync(TMPL)) {
    console.error(R('✖  src/template.html not found. Run from the family-portal directory.')); process.exit(1);
  }
  if (!fs.existsSync(CFG)) {
    console.error(R('✖  src/config.json not found.')); process.exit(1);
  }
  fs.mkdirSync(DIST, { recursive: true });

  // 2. Load config
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CFG, 'utf8')); }
  catch (e) { console.error(R(`✖  config.json parse error: ${e.message}`)); process.exit(1); }

  // 3. Validate
  if (!cfg.primaryFamily || !cfg.secondaryFamily) {
    console.error(R('✖  config.json must have "primaryFamily" and "secondaryFamily".')); process.exit(1);
  }

  // 4. Process photos into base64
  function processMembers(members) {
    return members.map(m => ({ ...m, photo: photoToDataUrl(m.photo) }));
  }

  const primaryData   = { ...cfg.primaryFamily,   members: processMembers(cfg.primaryFamily.members) };
  const secondaryData = { ...cfg.secondaryFamily,  members: processMembers(cfg.secondaryFamily.members) };

  console.log(DM(`  Primary family   : ${primaryData.members.length} member(s)`));
  console.log(DM(`  Secondary family : ${secondaryData.members.length} member(s)\n`));

  // 5. Get passwords
  const pw1 = await promptPassword(`🔑 Password for "${primaryData.familyName}" family : `);
  if (pw1.length < 6) { console.error(R('\n✖  Password must be at least 6 characters.')); process.exit(1); }
  const pw1c = await promptPassword(`   Confirm password                         : `);
  if (pw1 !== pw1c)   { console.error(R('\n✖  Passwords do not match.')); process.exit(1); }

  console.log('');

  const pw2 = await promptPassword(`🔑 Password for "${secondaryData.familyName}" family : `);
  if (pw2.length < 6) { console.error(R('\n✖  Password must be at least 6 characters.')); process.exit(1); }
  const pw2c = await promptPassword(`   Confirm password                           : `);
  if (pw2 !== pw2c)   { console.error(R('\n✖  Passwords do not match.')); process.exit(1); }

  console.log('');

  // 6. Encrypt
  process.stdout.write('  Encrypting Primary family   … ');
  const enc1 = await encryptJson(primaryData, pw1);
  console.log(G('done'));

  process.stdout.write('  Encrypting Secondary family … ');
  const enc2 = await encryptJson(secondaryData, pw2);
  console.log(G('done'));

  // 7. Stamp template
  process.stdout.write('  Building dist/index.html    … ');
  let html = fs.readFileSync(TMPL, 'utf8');

  html = html
    .replace('"__PRIMARY_LABEL__"',   JSON.stringify(primaryData.familyName))
    .replace('"__SECONDARY_LABEL__"', JSON.stringify(secondaryData.familyName))
    .replace('"__PRIMARY_SALT__"',    JSON.stringify(enc1.salt))
    .replace('"__PRIMARY_IV__"',      JSON.stringify(enc1.iv))
    .replace('"__PRIMARY_DATA__"',    JSON.stringify(enc1.data))
    .replace('"__SECONDARY_SALT__"',  JSON.stringify(enc2.salt))
    .replace('"__SECONDARY_IV__"',    JSON.stringify(enc2.iv))
    .replace('"__SECONDARY_DATA__"',  JSON.stringify(enc2.data));

  // Verify all placeholders were replaced
  const missing = html.match(/"__[A-Z_]+__"/g);
  if (missing) {
    console.log('');
    console.error(R(`✖  Unfilled placeholders: ${missing.join(', ')}`));
    process.exit(1);
  }

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(G('done'));

  // 8. Summary
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log('\n' + G('✔  Build complete!'));
  console.log(`   Output : dist/index.html (${kb} KB)\n`);
  console.log(B('Next steps:'));
  console.log('   1. Open dist/index.html in your browser to verify it works');
  console.log('   2. git add dist/index.html && git commit -m "Update portal"');
  console.log('   3. git push');
  console.log('\n' + Y('⚠  Security reminder:'));
  console.log('   • Do NOT commit src/config.json or src/photos/ to GitHub');
  console.log('   • The .gitignore already excludes them');
  console.log('   • Keep your passwords stored safely — they cannot be recovered\n');
}

main().catch(e => { console.error(R(`\n✖  ${e.message}`)); process.exit(1); });
