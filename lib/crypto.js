'use strict';
/**
 * Shared AES-256-GCM / PBKDF2 crypto helpers (Node side).
 * Single source of truth — build.js and admin.js both require this,
 * so the recipe used to encrypt a group's catalog and the recipe used
 * to encrypt a document blob never drift apart.
 *
 * Wire format for both catalogs and file blobs: ciphertext with the
 * 16-byte GCM auth tag appended, salt/iv/key as base64 — this is what
 * the browser's Web Crypto AES-GCM decrypt expects.
 */
const crypto = require('crypto');

const PBKDF2_ITERATIONS = 600000;
const PBKDF2_HASH = 'sha256';
const KEY_BYTES = 32;   // AES-256
const SALT_BYTES = 16;
const IV_BYTES = 12;    // 96-bit GCM standard

function deriveKeyFromPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_BYTES, PBKDF2_HASH, (err, key) => {
      if (err) reject(err); else resolve(key);
    });
  });
}

// Encrypt a JSON-serializable value with a password (used for group catalogs).
async function encryptJsonWithPassword(data, password) {
  const json = JSON.stringify(data);
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = await deriveKeyFromPassword(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, tag]);

  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

// Decrypt a group catalog with its password. Throws on wrong password / tampering.
async function decryptJsonWithPassword(encObj, password) {
  const salt = Buffer.from(encObj.salt, 'base64');
  const iv = Buffer.from(encObj.iv, 'base64');
  const raw = Buffer.from(encObj.data, 'base64');
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(0, raw.length - 16);

  const key = await deriveKeyFromPassword(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// Generate a fresh random 256-bit key for a single document blob.
function generateFileKey() {
  return crypto.randomBytes(KEY_BYTES);
}

// Encrypt an arbitrary file buffer with its own raw key (not password-derived).
function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([encrypted, tag]), // written to disk as-is
  };
}

function decryptBuffer(ciphertextWithTag, key, ivBase64) {
  const iv = Buffer.from(ivBase64, 'base64');
  const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
  const body = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

module.exports = {
  PBKDF2_ITERATIONS,
  encryptJsonWithPassword,
  decryptJsonWithPassword,
  generateFileKey,
  encryptBuffer,
  decryptBuffer,
};
