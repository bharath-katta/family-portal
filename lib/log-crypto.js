'use strict';
/**
 * Access-log crypto (Node side) — RSA-OAEP-4096 keypair handling.
 *
 * The private key can decrypt; the Worker only ever holds the public key,
 * so it can seal a visit event but never read one back. The private key
 * itself is stored locally encrypted with a password, reusing the same
 * PBKDF2/AES-GCM helper (lib/crypto.js) already used for group catalogs.
 */
const crypto = require('crypto');
const { webcrypto } = crypto;
const { encryptJsonWithPassword, decryptJsonWithPassword } = require('./crypto');

const RSA_PARAMS = { name: 'RSA-OAEP', hash: 'SHA-256' };

async function generateKeyPair() {
  const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
    { ...RSA_PARAMS, modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['encrypt', 'decrypt']
  );
  const spki = await webcrypto.subtle.exportKey('spki', publicKey);
  const publicKeySpki = Buffer.from(spki).toString('base64');
  const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', privateKey);
  return { publicKeySpki, privateKeyJwk };
}

// Writes {publicKeySpki, encryptedPrivateKey} — the public key is not secret
// and stays in plaintext; only the private key is password-encrypted.
async function buildKeyFile(publicKeySpki, privateKeyJwk, password) {
  const encryptedPrivateKey = await encryptJsonWithPassword(privateKeyJwk, password);
  return { publicKeySpki, encryptedPrivateKey };
}

// Returns an importable CryptoKey, or throws on wrong password / corrupt file.
async function unlockPrivateKey(keyFile, password) {
  const jwk = await decryptJsonWithPassword(keyFile.encryptedPrivateKey, password);
  return webcrypto.subtle.importKey('jwk', jwk, RSA_PARAMS, false, ['decrypt']);
}

// Decrypts one row's sealed payload (base64 RSA-OAEP ciphertext) back to its JSON object.
async function decryptPayload(base64Ciphertext, privateKey) {
  const ciphertext = Buffer.from(base64Ciphertext, 'base64');
  const raw = await webcrypto.subtle.decrypt(RSA_PARAMS, privateKey, ciphertext);
  return JSON.parse(Buffer.from(raw).toString('utf8'));
}

module.exports = { generateKeyPair, buildKeyFile, unlockPrivateKey, decryptPayload };
