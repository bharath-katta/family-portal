/**
 * Family Portal — access-log Worker.
 *
 * This Worker can ENCRYPT a visit event but can never DECRYPT one — it only
 * ever holds the RSA *public* key (below, via env.PUBLIC_KEY_SPKI). The
 * matching private key lives only on the site owner's own Mac, in
 * src/log-key.json, itself locked behind a separate log password. Even a
 * full compromise of this Worker or its D1 database exposes nothing but
 * ciphertext and one-way fingerprints.
 *
 * POST /log     — public, write-only. Every visitor's browser calls this
 *                 before any login, so it is intentionally unauthenticated.
 *                 There is no read path here; the only thing an abuser can
 *                 do is write junk rows, never see existing ones.
 * GET  /export  — bearer-token gated. Dumps all rows (still ciphertext) so
 *                 view-log.js (run locally, by the site owner) can decrypt
 *                 them. Not reachable without env.EXPORT_TOKEN.
 */

const SITE_ORIGIN = 'https://zerostress.in';
const VALID_EVENTS = new Set(['page_load', 'login_success', 'login_failed', 'section_open', 'item_open']);
const VALID_KINDS = new Set(['file', 'link']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsPreflight();
    if (request.method === 'POST' && url.pathname === '/log') return handleIngest(request, env);
    if (request.method === 'GET' && url.pathname === '/export') return handleExport(request, env);

    return new Response('Not found', { status: 404 });
  },
};

function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': SITE_ORIGIN,
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function handleIngest(request, env) {
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return badRequest();
  }
  if (typeof body !== 'object' || body === null) return badRequest();

  const event = String(body.event || '');
  if (!VALID_EVENTS.has(event)) return badRequest();

  const allowed = safeParseJson(env.ALLOWED_GROUPS) || {};
  if (body.group !== undefined) {
    if (typeof body.group !== 'string' || !Object.prototype.hasOwnProperty.call(allowed, body.group)) return badRequest();
  }
  if (body.section !== undefined) {
    if (!body.group || typeof body.section !== 'string' || !(allowed[body.group] || []).includes(body.section)) return badRequest();
  }
  if (body.kind !== undefined && !VALID_KINDS.has(body.kind)) return badRequest();

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const cf = request.cf || {};

  const payloadObj = { event, ip, country: cf.country || '', region: cf.region || '', city: cf.city || '' };
  if (body.group) payloadObj.group = body.group;
  if (body.section) payloadObj.section = body.section;
  if (body.kind) payloadObj.kind = body.kind;

  let fingerprint, ciphertext;
  try {
    fingerprint = await hmacHex(env.FINGERPRINT_SECRET, ip);
    ciphertext = await sealPayload(JSON.stringify(payloadObj), env.PUBLIC_KEY_SPKI);
  } catch {
    // Misconfigured secrets/key shouldn't surface details to a public endpoint.
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  await env.DB.prepare('INSERT INTO visits (ts, ip_fingerprint, payload) VALUES (?, ?, ?)')
    .bind(new Date().toISOString(), fingerprint, ciphertext)
    .run();

  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function handleExport(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!env.EXPORT_TOKEN || auth !== `Bearer ${env.EXPORT_TOKEN}`) {
    return new Response('Forbidden', { status: 403 });
  }
  const { results } = await env.DB.prepare('SELECT id, ts, ip_fingerprint, payload FROM visits ORDER BY ts ASC').all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
}

function badRequest() {
  return new Response('Bad request', { status: 400, headers: corsHeaders() });
}
function corsHeaders() {
  return { 'Access-Control-Allow-Origin': SITE_ORIGIN };
}
function safeParseJson(s) {
  try { return JSON.parse(s || ''); } catch { return null; }
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sealPayload(json, publicKeySpkiB64) {
  const spki = base64ToBytes(publicKeySpkiB64);
  const key = await crypto.subtle.importKey('spki', spki, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, new TextEncoder().encode(json));
  return bytesToBase64(new Uint8Array(encrypted));
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
