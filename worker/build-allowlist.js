#!/usr/bin/env node
'use strict';
/**
 * Prints the ALLOWED_GROUPS value for worker/wrangler.toml.
 *
 * Run this yourself — it reads your local src/config.json (group and
 * section IDs only, never labels or documents) so Claude never has to.
 * Paste the printed line into wrangler.toml, then redeploy the Worker.
 *
 * Usage: node worker/build-allowlist.js
 */
const fs = require('fs');
const path = require('path');

const CFG = path.join(__dirname, '..', 'src', 'config.json');

if (!fs.existsSync(CFG)) {
  console.error('src/config.json not found — run this from the family-portal directory.');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
const allowed = {};
for (const g of cfg.groups || []) {
  allowed[g.id] = (g.sections || []).map(s => s.id);
}

console.log('\nPaste this into worker/wrangler.toml as the ALLOWED_GROUPS value:\n');
console.log('ALLOWED_GROUPS = ' + JSON.stringify(JSON.stringify(allowed)));
console.log('');
