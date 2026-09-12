#!/usr/bin/env node
/**
 * Family Portal — Local Admin Server
 *
 * A drag-and-drop tool for adding, replacing, and describing documents
 * without hand-editing config.json or the command line.
 *
 * SECURITY MODEL:
 * - Binds 127.0.0.1 only — never reachable from another device.
 * - Every request must carry a random per-launch token (in the URL you're
 *   given, then as a header on every API call) — a page in another tab
 *   can't blindly poke this server.
 * - Requests carrying a mismatched Origin header are rejected outright.
 * - Group PASSWORDS are never seen by this server or the browser. Each
 *   uploaded file gets its own random encryption key (stored in plaintext
 *   config.json, which never leaves this Mac) — no password needed for
 *   that. The only step that needs a group password is "Publish", and
 *   that runs build.js as a child process attached to THIS terminal, so
 *   you type the password here, in the terminal — exactly like today.
 *
 * Usage: ./admin.sh
 */
'use strict';
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { generateFileKey, encryptBuffer } = require('./lib/crypto');
const { ICONS } = require('./lib/icons');

const ROOT = __dirname;
const CFG = path.join(ROOT, 'src', 'config.json');
const FILES_DIR = path.join(ROOT, 'dist', 'files');
const ADMIN_HTML = path.join(ROOT, 'src', 'admin.html');
const PORT = 7331;
const TOKEN = crypto.randomBytes(24).toString('hex');

fs.mkdirSync(FILES_DIR, { recursive: true });

const MIME_MAP = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.heic': 'image/heic', '.csv': 'text/csv', '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime',
};
function mimeFromExt(filename) {
  return MIME_MAP[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

// ── config.json read/write (plaintext, local-only, never sent anywhere else) ──
function loadConfig() {
  if (!fs.existsSync(CFG)) return { groups: [] };
  const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  if (!Array.isArray(cfg.groups)) throw new Error('config.json has no "groups" array — run migrate-config.js first.');
  return cfg;
}
function saveConfig(cfg) {
  fs.writeFileSync(CFG, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}
function findGroup(cfg, groupId) {
  const g = cfg.groups.find(g => g.id === groupId);
  if (!g) throw new Error(`Group not found: ${groupId}`);
  return g;
}
function findSection(g, sectionId) {
  const s = g.sections.find(s => s.id === sectionId);
  if (!s) throw new Error(`Section not found: ${sectionId}`);
  return s;
}

function deleteBlobIfExists(blobName) {
  if (!blobName) return;
  const full = path.join(FILES_DIR, blobName);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

// ── auth ──
function timingSafeStrEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
function checkAuth(req, url) {
  const originHeader = req.headers.origin;
  if (originHeader && originHeader !== `http://127.0.0.1:${PORT}`) return false;
  const headerToken = req.headers['x-admin-token'];
  const queryToken = url.searchParams.get('t');
  const supplied = headerToken || queryToken || '';
  return timingSafeStrEqual(supplied, TOKEN);
}

// ── body readers ──
function readRawBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limitBytes) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJsonBody(req) {
  const buf = await readRawBody(req, 5 * 1024 * 1024);
  return buf.length ? JSON.parse(buf.toString('utf8')) : {};
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// ── YouTube thumbnail fetch (server-side, one-time, at admin time only —
//    the published site itself never talks to Google) ──
function extractYouTubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function fetchUrlBuffer(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return resolve(fetchUrlBuffer(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ── file encrypt + write ──
function encryptAndStore(buffer) {
  const key = generateFileKey();
  const { iv, ciphertext } = encryptBuffer(buffer, key);
  const blobName = crypto.randomUUID() + '.bin';
  fs.writeFileSync(path.join(FILES_DIR, blobName), ciphertext);
  return { blob: blobName, key: key.toString('base64'), iv };
}

// ── routes ──
async function handleApi(req, res, url) {
  const p = url.pathname;

  if (p === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, loadConfig());
  }

  if (p === '/api/icons' && req.method === 'GET') {
    return sendJson(res, 200, { icons: Object.keys(ICONS) });
  }

  if (p === '/api/add-group' && req.method === 'POST') {
    const { id, label, layout, theme } = await readJsonBody(req);
    if (!id || !label || !['people', 'categories'].includes(layout) || !['blue', 'coral', 'teal'].includes(theme)) {
      return sendJson(res, 400, { error: 'id, label, layout(people|categories), theme(blue|coral|teal) required' });
    }
    const cfg = loadConfig();
    if (cfg.groups.some(g => g.id === id)) return sendJson(res, 400, { error: 'Group id already exists' });
    cfg.groups.push({ id, label, layout, theme, sections: [] });
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/section' && req.method === 'POST') {
    const { groupId, action, sectionId, label, icon, avatar } = await readJsonBody(req);
    const cfg = loadConfig();
    const g = findGroup(cfg, groupId);
    if (action === 'add') {
      if (g.sections.some(s => s.id === sectionId)) return sendJson(res, 400, { error: 'Section id already exists' });
      g.sections.push({ id: sectionId, label, icon: icon || 'generic', avatar: avatar || null, items: [] });
    } else if (action === 'rename') {
      const s = findSection(g, sectionId);
      if (label) s.label = label;
      if (icon) s.icon = icon;
    } else if (action === 'delete') {
      const s = findSection(g, sectionId);
      s.items.forEach(it => { deleteBlobIfExists(it.blob); if (it.thumb) deleteBlobIfExists(it.thumb.blob); });
      g.sections = g.sections.filter(s => s.id !== sectionId);
    } else {
      return sendJson(res, 400, { error: 'action must be add|rename|delete' });
    }
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/add-link' && req.method === 'POST') {
    const { groupId, sectionId, title, description, icon, url: linkUrl } = await readJsonBody(req);
    if (!title || !linkUrl) return sendJson(res, 400, { error: 'title and url required' });
    const cfg = loadConfig();
    const s = findSection(findGroup(cfg, groupId), sectionId);
    s.items.push({ kind: 'link', title, description: description || '', icon: icon || 'generic', url: linkUrl });
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/add-youtube' && req.method === 'POST') {
    const { groupId, sectionId, title, description, url: videoUrl } = await readJsonBody(req);
    const vid = extractYouTubeId(videoUrl);
    if (!vid) return sendJson(res, 400, { error: 'Could not parse a YouTube video ID from that URL' });
    const cfg = loadConfig();
    const s = findSection(findGroup(cfg, groupId), sectionId);
    let thumb = null;
    try {
      const thumbBuf = await fetchUrlBuffer(`https://img.youtube.com/vi/${vid}/hqdefault.jpg`);
      const stored = encryptAndStore(thumbBuf);
      thumb = { ...stored, mime: 'image/jpeg' };
    } catch { /* thumbnail is optional — link still works without it */ }
    s.items.push({ kind: 'link', title, description: description || '', icon: 'video', url: videoUrl, thumb });
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/upload-file' && req.method === 'POST') {
    const groupId = url.searchParams.get('groupId');
    const sectionId = url.searchParams.get('sectionId');
    const title = url.searchParams.get('title') || 'Untitled';
    const description = url.searchParams.get('description') || '';
    const icon = url.searchParams.get('icon') || 'generic';
    const filename = url.searchParams.get('filename') || 'file';
    const replaceIndex = url.searchParams.get('replaceIndex');

    const buffer = await readRawBody(req, 200 * 1024 * 1024); // 200MB/file ceiling
    const cfg = loadConfig();
    const s = findSection(findGroup(cfg, groupId), sectionId);
    const stored = encryptAndStore(buffer);
    const item = {
      kind: 'file', title, description, icon,
      ...stored, mime: mimeFromExt(filename), size: buffer.length,
      updatedAt: new Date().toISOString(),
    };

    if (replaceIndex !== null && s.items[Number(replaceIndex)]) {
      const old = s.items[Number(replaceIndex)];
      deleteBlobIfExists(old.blob);
      if (old.thumb) deleteBlobIfExists(old.thumb.blob);
      s.items[Number(replaceIndex)] = item;
    } else {
      s.items.push(item);
    }
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/delete-item' && req.method === 'POST') {
    const { groupId, sectionId, itemIndex } = await readJsonBody(req);
    const cfg = loadConfig();
    const s = findSection(findGroup(cfg, groupId), sectionId);
    const item = s.items[itemIndex];
    if (!item) return sendJson(res, 404, { error: 'Item not found' });
    deleteBlobIfExists(item.blob);
    if (item.thumb) deleteBlobIfExists(item.thumb.blob);
    s.items.splice(itemIndex, 1);
    saveConfig(cfg);
    return sendJson(res, 200, cfg);
  }

  if (p === '/api/publish' && req.method === 'POST') {
    console.log('\n\x1b[1m━━━ Publish requested from admin UI ━━━\x1b[0m');
    console.log('Password prompts (if any) will appear right here in this terminal.\n');
    try {
      await runInherited('node', ['build.js'], ROOT);
      await runInherited('git', ['add', 'dist'], ROOT);
      await runInherited('git', ['commit', '-m', 'Update portal via admin tool'], ROOT).catch(e => {
        // "nothing to commit" is not an error condition for us
        if (!/nothing to commit/i.test(e.message)) throw e;
      });
      await runInherited('git', ['push'], ROOT);
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}

function runInherited(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    let out = '';
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

// ── server ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (!checkAuth(req, url)) {
    return sendJson(res, 403, { error: 'Forbidden — missing or invalid admin token' });
  }

  if (url.pathname === '/' && req.method === 'GET') {
    const html = fs.readFileSync(ADMIN_HTML, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      return await handleApi(req, res, url);
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  const launchUrl = `http://127.0.0.1:${PORT}/?t=${TOKEN}`;
  console.log('\n\x1b[1m━━━ Family Portal — Admin Tool ━━━\x1b[0m\n');
  console.log(`  Open: \x1b[36m${launchUrl}\x1b[0m\n`);
  console.log('  This only listens on your Mac (127.0.0.1) — nothing outside can reach it.');
  console.log('  Keep this terminal open. Press Ctrl+C to stop.\n');

  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [launchUrl], { stdio: 'ignore', detached: true }).unref();
});
