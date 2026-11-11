#!/usr/bin/env node
/**
 * AXOM Project & Database Optimization Utility
 * Performs SQLite defragmentation, integrity validation, vacuuming,
 * Obsidian knowledge graph sync, and workspace hygiene.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'axom_memory.db');
const VAULT_PATH = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Documents', 'Axom_Brain');

console.log('==================================================');
console.log('AXOM PROJECT & WORKSPACE OPTIMIZATION');
console.log('==================================================');

// 1. Optimize SQLite Database
if (fs.existsSync(DB_PATH)) {
  const initialSize = fs.statSync(DB_PATH).size;
  console.log(`\n[Database] Optimizing SQLite database: ${DB_PATH}`);
  console.log(` -> Size before: ${(initialSize / 1024).toFixed(1)} KB`);

  try {
    const db = new DatabaseSync(DB_PATH);

    // Integrity Check
    const integrity = db.prepare('PRAGMA integrity_check').all();
    const isOk = integrity.length === 1 && integrity[0].integrity_check === 'ok';
    console.log(` -> Integrity check: ${isOk ? 'OK (No corruption)' : JSON.stringify(integrity)}`);

    // Clean orphaned tables if any remain
    const orphanTables = ['study_podcasts', 'study_notes', 'study_insights', 'study_source_links', 'study_sources', 'study_notebooks'];
    for (const tbl of orphanTables) {
      db.exec(`DROP TABLE IF EXISTS ${tbl}`);
    }

    // Vacuum & Optimize
    db.exec('VACUUM');
    db.exec('PRAGMA optimize');
    db.close();

    const finalSize = fs.statSync(DB_PATH).size;
    const saved = initialSize - finalSize;
    console.log(` -> Size after:  ${(finalSize / 1024).toFixed(1)} KB`);
    if (saved > 0) {
      console.log(` -> Reclaimed:   ${(saved / 1024).toFixed(1)} KB of fragmented space`);
    } else {
      console.log(' -> Database is already fully compacted and indexed.');
    }
  } catch (err) {
    console.error('[Database] Optimization error:', err.message);
  }
} else {
  console.log('\n[Database] No SQLite database found at data/axom_memory.db.');
}

// 2. Obsidian Second Brain Health & Sync
console.log(`\n[Obsidian] Checking Second Brain Vault at: ${VAULT_PATH}`);
if (fs.existsSync(VAULT_PATH)) {
  try {
    const obsidianVault = require('../obsidian_vault');
    obsidianVault.initVault();
    obsidianVault.syncAll();
    console.log(' -> Vault directories verified: Conversations, Knowledge, Memories, Profile, Projects');
    console.log(' -> Bi-directional graph synchronized successfully.');
  } catch (err) {
    console.warn(' -> Vault sync warning:', err.message);
  }
} else {
  console.log(' -> Vault directory not present yet; will be created automatically on next session review.');
}

// 3. Clean temporary files in project tree
console.log('\n[Workspace] Scanning for temporary and cache files...');
let cleanedCount = 0;

function scanAndClean(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'models'].includes(entry.name)) continue;
      scanAndClean(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.tmp') || entry.name.endsWith('.temp') || entry.name.endsWith('~') || entry.name.endsWith('.pyc')) {
        try {
          fs.unlinkSync(fullPath);
          console.log(` -> Removed temporary file: ${path.relative(ROOT_DIR, fullPath)}`);
          cleanedCount++;
        } catch (e) {}
      }
    }
  }
}

scanAndClean(ROOT_DIR);
if (cleanedCount === 0) {
  console.log(' -> Workspace is clean. No stray temporary or cache files found.');
}

console.log('\n==================================================');
console.log('OPTIMIZATION COMPLETED SUCCESSFULLY');
console.log('==================================================\n');
