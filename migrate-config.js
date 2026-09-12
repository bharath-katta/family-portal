#!/usr/bin/env node
/**
 * One-shot migration: old {primaryFamily, secondaryFamily} config.json
 * shape -> the new generic {groups:[...]} shape used by the rebuilt
 * build.js / template.html.
 *
 * Prints only counts — never names, links, or any other real content —
 * so this is safe to run with Claude Code (or anyone) watching the
 * terminal output.
 *
 * Usage: node migrate-config.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CFG = path.join(ROOT, 'src', 'config.json');
const BACKUP = path.join(ROOT, 'src', 'config.backup.json');

const G = s => `\x1b[32m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const R = s => `\x1b[31m${s}\x1b[0m`;
const B = s => `\x1b[1m${s}\x1b[0m`;

function mapDocuments(documents) {
  return (documents || []).map(d => {
    const hasUrl = d.url && d.url !== 'PASTE_LINK_HERE';
    if (hasUrl) {
      return { kind: 'link', title: d.name, description: '', icon: d.icon || 'generic', url: d.url };
    }
    return { kind: 'pending', title: d.name, description: '', icon: d.icon || 'generic' };
  });
}

function mapFamily(family, id, theme) {
  return {
    id,
    label: family.familyName,
    layout: 'people',
    theme,
    sections: (family.members || []).map((m, i) => ({
      id: `${id}-member-${i}`,
      label: m.name,
      avatar: m.photo || null,
      items: mapDocuments(m.documents),
    })),
  };
}

function keralaGroup() {
  const cats = [
    { id: 'bookings', label: 'Hotel Bookings', icon: 'hotel' },
    { id: 'flights', label: 'Flight Tickets', icon: 'flight' },
    { id: 'itinerary', label: 'Itinerary', icon: 'itinerary' },
    { id: 'menu', label: 'Menu Options', icon: 'menu' },
    { id: 'drinks', label: 'Drink Options', icon: 'drink' },
    { id: 'videos', label: 'Videos', icon: 'video' },
  ];
  return {
    id: 'kerala2026',
    label: 'Kerala Trip 2026',
    layout: 'categories',
    theme: 'teal',
    sections: cats.map(c => ({ id: c.id, label: c.label, icon: c.icon, items: [] })),
  };
}

function main() {
  console.log('\n' + B('━━━ Config Migration: families → groups ━━━') + '\n');

  if (!fs.existsSync(CFG)) {
    console.error(R('✖  src/config.json not found.'));
    process.exit(1);
  }

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CFG, 'utf8'));
  } catch (e) {
    console.error(R(`✖  config.json parse error: ${e.message}`));
    process.exit(1);
  }

  if (Array.isArray(cfg.groups)) {
    console.log(Y('⚠  config.json already has a "groups" array — already migrated.'));
    console.log(Y('   No changes made. Delete the "groups" key first if you want to re-run this.\n'));
    return;
  }

  if (!cfg.primaryFamily || !cfg.secondaryFamily) {
    console.error(R('✖  Expected "primaryFamily" and "secondaryFamily" in config.json — nothing to migrate.'));
    process.exit(1);
  }

  // Back up the original untouched, exact bytes.
  fs.copyFileSync(CFG, BACKUP);
  console.log(G(`✔  Backed up original to src/config.backup.json`));

  const primary = mapFamily(cfg.primaryFamily, 'primary', 'blue');
  const secondary = mapFamily(cfg.secondaryFamily, 'secondary', 'coral');
  const kerala = keralaGroup();

  const newCfg = { groups: [primary, secondary, kerala] };

  fs.writeFileSync(CFG, JSON.stringify(newCfg, null, 2) + '\n', 'utf8');

  const docCount = g => g.sections.reduce((n, s) => n + s.items.length, 0);

  console.log(G('✔  Migrated to new schema\n'));
  console.log(`   Group 1 (primary)   — ${primary.sections.length} member(s), ${docCount(primary)} document(s)`);
  console.log(`   Group 2 (secondary) — ${secondary.sections.length} member(s), ${docCount(secondary)} document(s)`);
  console.log(`   Group 3 (Kerala Trip 2026) — ${kerala.sections.length} categories, added empty (ready for uploads)\n`);
  console.log(B('Next steps:'));
  console.log('   1. Run ./admin.sh to set a password for Kerala Trip 2026 and start uploading');
  console.log('   2. Or run ./build.sh directly — it will now prompt for one password per group\n');
}

main();
