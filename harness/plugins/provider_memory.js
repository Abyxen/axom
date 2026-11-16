/**
 * DSH Plugin: Living Brain Memory Provider
 * Bridges SQLite persistent profile facts and Obsidian Markdown vault knowledge.
 */

const { SEAMS } = require('../seams');

const MemoryPlugin = {
  name: 'dsh-provider-memory',
  version: '1.2.0',
  category: 'Knowledge',
  description: 'Dual-state memory bridge for SQLite persistent facts and Obsidian knowledge vault.',

  apply(ctx) {
    const db = require('../../db');
    const obsidian = require('../../obsidian_vault');

    const memoryService = {
      async getProfile() {
        return db.getProfileMemory();
      },

      async formatProfileContext() {
        return db.formatProfileContext();
      },

      async getVaultKnowledge() {
        try {
          return obsidian.readVaultKnowledge();
        } catch (e) {
          return '';
        }
      },

      async syncObsidian() {
        return obsidian.syncVault();
      },

      async saveMessage(sessionId, role, content) {
        return db.logChatMessage(sessionId, role, content);
      },

      async upsertFact(key, value, category = 'user_preference') {
        return db.upsertProfileFact(key, value, category);
      },

      async deleteFact(key) {
        return db.deleteProfileFact(key);
      }
    };

    SEAMS.MEMORY.validateProvider(memoryService);
    ctx.provide('memory', memoryService);
  }
};

module.exports = MemoryPlugin;
