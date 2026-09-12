'use strict';
/**
 * Builds a disposable, dummy-data test site for the smoke test — never
 * touches the real src/config.json or dist/. Reuses the same crypto helpers
 * (lib/crypto.js) and icon set (lib/icons.js) build.js uses, so the test
 * site is stamped exactly the way the real one is.
 */
const fs = require('fs');
const path = require('path');
const cryptoLib = require('../lib/crypto');
const { ICONS } = require('../lib/icons');

const TEST_PASSWORD = 'testpass123';

// Smallest possible valid 1x1 transparent PNG.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

async function makeFileItem(filesDir, { title, mime, size, content }) {
  const key = cryptoLib.generateFileKey();
  const buf = content || TINY_PNG;
  const { iv, ciphertext } = cryptoLib.encryptBuffer(buf, key);
  const blob = `${title.replace(/\W+/g, '_')}.bin`;
  fs.writeFileSync(path.join(filesDir, blob), ciphertext);
  return {
    kind: 'file', title, description: 'Test fixture', icon: 'generic',
    blob, key: key.toString('base64'), iv, mime,
    size: size !== undefined ? size : buf.length,
    updatedAt: new Date().toISOString(),
  };
}

async function buildTestSite(outDir) {
  const filesDir = path.join(outDir, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  const items = [
    await makeFileItem(filesDir, { title: 'Small Image', mime: 'image/png' }),
    // Metadata says 20MB (real bytes on disk are tiny) — exercises the
    // >15MB "fall through to download" gate without needing a real fixture.
    await makeFileItem(filesDir, { title: 'Big Image', mime: 'image/png', size: 20 * 1024 * 1024 }),
    await makeFileItem(filesDir, { title: 'Sample Document', mime: 'application/pdf', content: Buffer.from('%PDF-1.4 test') }),
    await makeFileItem(filesDir, { title: 'Sample Sheet', mime: 'text/csv', content: Buffer.from('a,b,c\n1,2,3') }),
    { kind: 'link', title: 'External Link', description: 'Test fixture', icon: 'generic', url: 'https://example.com/' },
    { kind: 'pending', title: 'Not Added Yet', description: 'Test fixture', icon: 'generic' },
  ];

  const group = {
    id: 'testgroup', label: 'Test Group', layout: 'people', theme: 'blue',
    sections: [{ id: 'person1', label: 'Test Person', items }],
  };

  const enc = await cryptoLib.encryptJsonWithPassword(group, TEST_PASSWORD);
  const encryptedGroup = { id: group.id, label: group.label, theme: group.theme, layout: group.layout, ...enc };

  let html = fs.readFileSync(path.join(__dirname, '..', 'src', 'template.html'), 'utf8');
  html = html.replace('__GROUPS__', JSON.stringify([encryptedGroup]));
  html = html.replace('__ICONS__', JSON.stringify(ICONS));
  html = html.replace('__LOG_ENDPOINT__', '');
  html = html.replace('__LOG_CONNECT_SRC__', '');
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  return { password: TEST_PASSWORD, groupId: group.id };
}

module.exports = { buildTestSite, TEST_PASSWORD };
