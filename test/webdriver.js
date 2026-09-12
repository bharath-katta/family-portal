'use strict';
/**
 * Minimal W3C WebDriver HTTP client — zero dependencies, built-in `http` only.
 * Talks to `safaridriver` (real Safari, built into macOS) so the smoke test
 * exercises the actual engine that every bug this project has hit came from,
 * not a Chromium stand-in.
 *
 * All page interaction goes through executeScript() rather than native
 * WebDriver element-click/send-keys endpoints — a JS-triggered .click()
 * fires the same handlers a real click would, and this sidesteps any
 * per-implementation quirks in the native interaction endpoints.
 */
const http = require('http');

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      { host: '127.0.0.1', port, path, method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      res => {
        let chunks = '';
        res.on('data', c => { chunks += c; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(chunks); } catch { parsed = { raw: chunks }; }
          if (res.statusCode >= 400) return reject(new Error(`WebDriver ${method} ${path} -> ${res.statusCode}: ${chunks}`));
          resolve(parsed.value !== undefined ? parsed.value : parsed);
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

class SafariSession {
  constructor(port) { this.port = port; this.sessionId = null; }

  async start() {
    const value = await request(this.port, 'POST', '/session', { capabilities: { alwaysMatch: { browserName: 'Safari' } } });
    this.sessionId = value.sessionId;
  }

  async navigateTo(url) {
    await request(this.port, 'POST', `/session/${this.sessionId}/url`, { url });
  }

  // script runs as the body of a function; return its result.
  async executeScript(script, args = []) {
    return request(this.port, 'POST', `/session/${this.sessionId}/execute/sync`, { script, args });
  }

  async quit() {
    if (!this.sessionId) return;
    try { await request(this.port, 'DELETE', `/session/${this.sessionId}`); } catch { /* best effort */ }
  }
}

module.exports = { SafariSession };
