const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'axom_memory.db');

let dbInstance = null;

/**
 * Initialize SQLite database and tables
 */
function initDatabase(dbFilePath = DEFAULT_DB_PATH) {
  const dir = path.dirname(dbFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbFilePath);
  dbInstance = db;

  // COMPONENT A: DUAL-STATE DATABASE SCHEMA
  // 1. Raw Chat Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_logs_session_ts ON chat_logs(session_id, timestamp);
  `);

  // 2. Permanent Profile State table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile_memory (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence_score REAL DEFAULT 1.0,
      reasoning TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_profile_memory_category ON user_profile_memory(category);
  `);

  // 3. Session Metadata & Review status
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_metadata (
      session_id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      summary TEXT,
      message_count INTEGER DEFAULT 0,
      last_reviewed_at TEXT,
      status TEXT DEFAULT 'active'
    );
  `);

  // Seed default foundational profile memory if table is empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM user_profile_memory').get();
  if (!countRow || countRow.count === 0) {
    const now = new Date().toISOString();
    const insertSeed = db.prepare(`
      INSERT INTO user_profile_memory (key, value, category, confidence_score, reasoning, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seeds = [
      ['creator_and_developer', 'Abiral', 'personal_detail', 1.0, 'Foundational identity prompt', now, now],
      ['primary_hardware', 'HP OMEN Gaming Laptop with NVIDIA GeForce RTX 5060 Laptop GPU (8GB VRAM) and 32GB RAM', 'technical_stack', 1.0, 'Hardware configuration profile', now, now],
      ['primary_ai_model', 'Axom v1.1 based on Qwen 3.5 4B Uncensored (Q4_K_M quantization)', 'technical_stack', 1.0, 'Active model specifications', now, now],
      ['operating_system', 'Windows 11', 'technical_stack', 1.0, 'Host operating system profile', now, now],
      ['preferred_communication_style', 'Direct, technically rigorous, highly concise, uncensored, zero fluff', 'user_preference', 1.0, 'Developer system directive', now, now]
    ];

    for (const [k, v, cat, conf, r, ca, ua] of seeds) {
      insertSeed.run(k, v, cat, conf, r, ca, ua);
    }
  }

  return db;
}

function getDb() {
  if (!dbInstance) {
    initDatabase();
  }
  return dbInstance;
}

/**
 * Log a chat message to raw chat logs
 */
function logChatMessage(sessionId, role, content, timestamp = new Date().toISOString()) {
  const db = getDb();
  
  // Insert raw chat log
  const insertLog = db.prepare(`
    INSERT INTO chat_logs (session_id, role, content, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  insertLog.run(sessionId, role, content, timestamp);

  // Upsert session metadata
  const existingSession = db.prepare('SELECT session_id, message_count FROM session_metadata WHERE session_id = ?').get(sessionId);
  if (existingSession) {
    const updateSession = db.prepare(`
      UPDATE session_metadata 
      SET end_time = ?, message_count = message_count + 1, status = 'active'
      WHERE session_id = ?
    `);
    updateSession.run(timestamp, sessionId);
  } else {
    const insertSession = db.prepare(`
      INSERT INTO session_metadata (session_id, start_time, end_time, message_count, status)
      VALUES (?, ?, ?, 1, 'active')
    `);
    insertSession.run(sessionId, timestamp, timestamp);
  }
}

/**
 * Get full raw transcript for a session
 */
function getSessionTranscript(sessionId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT timestamp, role, content
    FROM chat_logs
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(sessionId);
  return rows || [];
}

/**
 * Get all active user profile memory entries
 */
function getAllProfileMemory() {
  const db = getDb();
  return db.prepare(`
    SELECT key, value, category, confidence_score, reasoning, created_at, updated_at
    FROM user_profile_memory
    ORDER BY category ASC, key ASC
  `).all() || [];
}

/**
 * Get dictionary snapshot of current profile for the reviewer prompt
 */
function getProfileSnapshot() {
  const rows = getAllProfileMemory();
  const snapshot = {};
  for (const row of rows) {
    snapshot[row.key] = row.value;
  }
  return snapshot;
}

/**
 * COMPONENT B: Format profile key-value mappings into a context block
 */
function formatProfileContext(memoryRows = null) {
  const rows = memoryRows || getAllProfileMemory();
  if (!rows || rows.length === 0) return '';

  const categories = {};
  for (const r of rows) {
    const cat = r.category || 'general_fact';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(`  - ${r.key}: ${r.value}`);
  }

  const lines = [
    '# CORE IDENTITY & SYSTEM DIRECTIVE',
    'You are AXOM, a helpful, intelligent, empathetic, and highly capable AI assistant created and developed by Abiral.',
    'You behave and communicate naturally, warmly, and thoughtfully like modern conversational AI assistants (such as ChatGPT or Claude).',
    '',
    'CORE PERSONALITY & BEHAVIORS:',
    '1. Conversational, Warm & Approachable: Speak like a knowledgeable, friendly, and thoughtful collaborator. Be polite, welcoming, and engaging. When the user greets you (e.g. "hi", "hello"), greet them warmly and ask how you can help.',
    '2. Direct Yet Thorough: When asked a question or given a task, dive straight into a clear, comprehensive, and well-explained answer. Do not repeat your name or self-introduction on every turn unless the user greets you or explicitly asks who you are.',
    '3. Formatting: Use clean Markdown (bullet points, bold text, structured sections, code blocks with syntax highlighting) to make information readable, structured, and easy to follow.',
    '4. Adaptable & Versatile: Excel at coding, debugging, creative brainstorming, writing, math, system architecture, and casual conversation. Match the user\'s tone and depth.',
    '5. Creator Lineage: You are AXOM, created and developed by Abiral. If asked who made you, who created you, or what your identity is, state clearly and warmly that you are AXOM, created and developed by Abiral.',
    '',
    '# [BACKGROUND USER PROFILE & PASSIVE MEMORY]',
    'The following facts, preferences, and context represent background reference knowledge about the user:',
  ];

  for (const [category, items] of Object.entries(categories)) {
    lines.push(`• ${category}:`);
    lines.push(...items);
  }

  lines.push('');
  lines.push('OPERATIONAL USAGE RULES:');
  lines.push('1. Use this information as PASSIVE BACKGROUND REFERENCE. Do NOT force, recite, or proactively bring up past projects, tech stacks, or specific facts unless directly relevant to what the user is currently asking.');
  lines.push('2. If the user gives a greeting (e.g. "hi", "hello") or an open-ended statement, greet them naturally, helpfully, and concisely without assuming an agenda or mentioning background projects unprompted.');
  lines.push('3. When the user asks technical questions, write code, or requests assistance, subtly align with their known preferences and environment.');
  lines.push('# [END BACKGROUND MEMORY]\n');
  return lines.join('\n');
}

/**
 * COMPONENT D: Mutate user_profile_memory with memory actions
 */
function applyMemoryActions(actions = [], sessionId = null, sessionSummary = null) {
  const db = getDb();
  const now = new Date().toISOString();
  const stats = { created: 0, updated: 0, deleted: 0, errors: [] };

  if (!Array.isArray(actions)) return stats;

  db.exec('BEGIN TRANSACTION');
  try {
    const upsertStmt = db.prepare(`
      INSERT INTO user_profile_memory (key, value, category, confidence_score, reasoning, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        confidence_score = excluded.confidence_score,
        reasoning = excluded.reasoning,
        updated_at = excluded.updated_at
    `);

    const selectStmt = db.prepare('SELECT key FROM user_profile_memory WHERE key = ?');
    const deleteStmt = db.prepare('DELETE FROM user_profile_memory WHERE key = ?');

    for (const item of actions) {
      if (!item || !item.key || !item.action) continue;

      const action = String(item.action).trim().toUpperCase();
      // Sanitize key to snake_case
      const key = String(item.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const category = String(item.category || 'general_fact').trim().toLowerCase();
      const value = typeof item.value === 'string' ? item.value.trim() : JSON.stringify(item.value);
      const confidence = typeof item.confidence_score === 'number' ? item.confidence_score : 1.0;
      const reasoning = item.reasoning ? String(item.reasoning).trim() : '';

      if (action === 'CREATE' || action === 'UPDATE') {
        const existing = selectStmt.get(key);
        upsertStmt.run(key, value, category, confidence, reasoning, now, now);
        if (existing) {
          stats.updated++;
        } else {
          stats.created++;
        }
      } else if (action === 'DELETE') {
        deleteStmt.run(key);
        stats.deleted++;
      }
    }

    if (sessionId) {
      const updateMeta = db.prepare(`
        UPDATE session_metadata
        SET summary = COALESCE(?, summary),
            last_reviewed_at = ?,
            status = 'reviewed'
        WHERE session_id = ?
      `);
      updateMeta.run(sessionSummary || null, now, sessionId);
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    stats.errors.push(err.message);
    console.error('[DB] Error applying memory actions:', err);
  }

  return stats;
}

/**
 * Get session metadata
 */
function getSessionMetadata(sessionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM session_metadata WHERE session_id = ?').get(sessionId) || null;
}

/**
 * Get all sessions
 */
function getAllSessions() {
  const db = getDb();
  return db.prepare(`
    SELECT session_id, start_time, end_time, summary, message_count, last_reviewed_at, status
    FROM session_metadata
    ORDER BY end_time DESC
  `).all() || [];
}

module.exports = {
  initDatabase,
  getDb,
  logChatMessage,
  getSessionTranscript,
  getAllProfileMemory,
  getProfileSnapshot,
  formatProfileContext,
  applyMemoryActions,
  getSessionMetadata,
  getAllSessions
};
