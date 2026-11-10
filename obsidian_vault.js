const fs = require('node:fs');
const path = require('node:path');
const { exec, spawn } = require('node:child_process');
const db = require('./db');

const USER_DOCUMENTS = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Documents');
const VAULT_NAME = 'Axom_Brain';
const VAULT_PATH = path.join(USER_DOCUMENTS, VAULT_NAME);

/**
 * Locate Obsidian executable if installed on Windows
 */
function findObsidianExecutable() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Obsidian', 'Obsidian.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Obsidian', 'Obsidian.exe')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Initialize the Obsidian Vault structure and default configurations
 */
function initVault() {
  const dirs = [
    VAULT_PATH,
    path.join(VAULT_PATH, '.obsidian'),
    path.join(VAULT_PATH, 'Profile'),
    path.join(VAULT_PATH, 'Memories'),
    path.join(VAULT_PATH, 'Conversations'),
    path.join(VAULT_PATH, 'Knowledge'),
    path.join(VAULT_PATH, 'Projects')
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Obsidian Vault Configuration files (.obsidian/app.json, appearance.json, core-plugins.json)
  const appJsonPath = path.join(VAULT_PATH, '.obsidian', 'app.json');
  if (!fs.existsSync(appJsonPath)) {
    fs.writeFileSync(appJsonPath, JSON.stringify({
      useMarkdownLinks: false,
      livePreview: true,
      newFileLocation: "root",
      promptDelete: false,
      theme: "obsidian",
      attachmentFolderPath: "Knowledge/Attachments"
    }, null, 2), 'utf8');
  }

  const appearanceJsonPath = path.join(VAULT_PATH, '.obsidian', 'appearance.json');
  if (!fs.existsSync(appearanceJsonPath)) {
    fs.writeFileSync(appearanceJsonPath, JSON.stringify({
      baseFontSize: 16,
      theme: "moonstone",
      accentColor: "#ff512f"
    }, null, 2), 'utf8');
  }

  const pluginsJsonPath = path.join(VAULT_PATH, '.obsidian', 'core-plugins.json');
  if (!fs.existsSync(pluginsJsonPath)) {
    fs.writeFileSync(pluginsJsonPath, JSON.stringify([
      "file-explorer",
      "global-search",
      "switcher",
      "graph",
      "backlink",
      "canvas",
      "outgoing-link",
      "tag-pane",
      "page-preview",
      "daily-notes",
      "templates",
      "note-composer",
      "command-palette",
      "markdown-importer",
      "word-count",
      "outline"
    ], null, 2), 'utf8');
  }

  // Create initial Starter Notes if absent
  createInitialNotes();
}

/**
 * Create initial knowledge and project notes in the vault
 */
function createInitialNotes() {
  const homePath = path.join(VAULT_PATH, 'Home.md');
  if (!fs.existsSync(homePath)) {
    const homeContent = `---
title: "AXOM Second Brain"
tags:
  - axom/brain
  - map-of-content
created: "${new Date().toISOString()}"
---

# 🧠 AXOM Second Brain

Welcome to the external memory and neural knowledge graph of **AXOM**.
This vault is continuously synchronized with AXOM's SQLite memory core and active LLM context.

## 📂 Core Navigation
- 👤 [[Profile/Developer Profile|Developer Profile (Abiral)]]
- ⚙️ [[Profile/System & Hardware|System & Hardware Specifications]]
- 🎨 [[Profile/Preferences|User Preferences & Style Directives]]
- 🗃️ [[Memories/Index|Long-Term Memories Index]]
- 💬 [[Conversations/Index|Conversation Logs & Executive Summaries]]
- 💡 [[Knowledge/Index|External Knowledge & Notes]]
- 🚀 [[Projects/AXOM Core|Active Projects]]

## 🌐 Dynamic Neural Integration
- Notes added to \`Knowledge/\` or \`Projects/\` are automatically digested into AXOM's prompt context during relevant conversations.
- Every chat turn and reviewed insight is distilled into permanent interlinked markdown notes.

---
*Synchronized in real-time by AXOM Living Brain Architecture.*
`;
    fs.writeFileSync(homePath, homeContent, 'utf8');
  }

  const projPath = path.join(VAULT_PATH, 'Projects', 'AXOM Core.md');
  if (!fs.existsSync(projPath)) {
    const projContent = `---
project: "AXOM Core"
status: "active"
creator: "Abiral"
tags:
  - project/axom
  - ai/companion
---

# 🚀 AXOM Core Architecture

AXOM is an autonomous, agentic companion and coding assistant powered by **Qwen 3.5 4B Uncensored** (\`axom:1.1\`) with multi-modal tools, web browsing, living memory, and deep Obsidian vault integration.

## 🛠️ Key Capabilities
- **Local Neural Engine**: Ollama backend running on dedicated RTX 5060 GPU with 8GB VRAM.
- **Living Brain**: SQLite dual-state memory architecture with autonomous background reviewing.
- **Obsidian Second Brain**: Bi-directional Markdown sync for permanent, visual knowledge graphing.
- **In-App Web Browser**: Chrome-like live web browsing with real-time proxying.
- **Agentic Workflows**: Autonomous search, document parsing, and file management.

---
*Reference: [[Home|Return to Vault Home]]*
`;
    fs.writeFileSync(projPath, projContent, 'utf8');
  }

  const knowPath = path.join(VAULT_PATH, 'Knowledge', 'Index.md');
  if (!fs.existsSync(knowPath)) {
    const knowContent = `---
title: "Knowledge Base"
tags:
  - axom/knowledge
---

# 💡 AXOM Knowledge Base

Any Markdown note placed in this directory will be indexed by AXOM and made available as active reference knowledge during conversations.

## 📌 Topics
- [[Knowledge/AI Best Practices|AI Best Practices]]
- [[Projects/AXOM Core|AXOM System Design]]
`;
    fs.writeFileSync(knowPath, knowContent, 'utf8');
  }
}

/**
 * Sync all user profile memory facts from SQLite into Obsidian Markdown files
 */
function syncProfileMemories() {
  initVault();
  const rows = db.getAllProfileMemory();

  // 1. Group facts by category
  const categorized = {};
  for (const r of rows) {
    const cat = r.category || 'general_fact';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push(r);
  }

  // 2. Write Profile/Developer Profile.md
  const devRows = rows.filter(r => r.key.includes('creator') || r.key.includes('developer') || r.category === 'personal_detail');
  const devMd = `---
title: "Developer Profile"
tags:
  - profile/developer
updated: "${new Date().toISOString()}"
---

# 👤 Developer Profile: Abiral

Abiral is the creator and lead engineer of **AXOM**.

## 📌 Extracted Facts
${devRows.map(r => `- **${r.key.replace(/_/g, ' ').toUpperCase()}**: ${r.value}\n  *(Confidence: ${r.confidence_score}, Reason: ${r.reasoning || 'system baseline'})*`).join('\n\n')}

---
*Linked to: [[Home|Vault Home]] · [[Profile/Preferences|User Preferences]]*
`;
  fs.writeFileSync(path.join(VAULT_PATH, 'Profile', 'Developer Profile.md'), devMd, 'utf8');

  // 3. Write Profile/System & Hardware.md
  const sysRows = rows.filter(r => r.category === 'technical_stack' || r.key.includes('hardware') || r.key.includes('system') || r.key.includes('model'));
  const sysMd = `---
title: "System & Hardware Specifications"
tags:
  - profile/hardware
  - profile/specs
updated: "${new Date().toISOString()}"
---

# ⚙️ System & Hardware Specifications

Hardware profile and execution environment for AXOM.

## 📌 Hardware Details
${sysRows.map(r => `- **${r.key.replace(/_/g, ' ').toUpperCase()}**: ${r.value}\n  *(Updated: ${r.updated_at})*`).join('\n\n')}

---
*Linked to: [[Home|Vault Home]]*
`;
  fs.writeFileSync(path.join(VAULT_PATH, 'Profile', 'System & Hardware.md'), sysMd, 'utf8');

  // 4. Write Profile/Preferences.md
  const prefRows = rows.filter(r => r.category === 'user_preference' || r.key.includes('preference') || r.key.includes('style'));
  const prefMd = `---
title: "User Preferences & Style Directives"
tags:
  - profile/preferences
updated: "${new Date().toISOString()}"
---

# 🎨 User Preferences & Style Directives

Style choices, structural defaults, and operational guidelines established by Abiral.

## 📌 Active Directives
${prefRows.map(r => `- **${r.key.replace(/_/g, ' ').toUpperCase()}**: ${r.value}`).join('\n\n')}

---
*Linked to: [[Home|Vault Home]]*
`;
  fs.writeFileSync(path.join(VAULT_PATH, 'Profile', 'Preferences.md'), prefMd, 'utf8');

  // 5. Write Memories/<category>.md for all categories
  for (const [cat, items] of Object.entries(categorized)) {
    const catFile = path.join(VAULT_PATH, 'Memories', `${cat}.md`);
    const catMd = `---
category: "${cat}"
count: ${items.length}
updated: "${new Date().toISOString()}"
tags:
  - memory/${cat}
---

# 🗃️ Memory Category: ${cat.replace(/_/g, ' ').toUpperCase()}

${items.map(i => `### \`${i.key}\`
- **Value**: ${i.value}
- **Confidence**: ${i.confidence_score}
- **Reasoning**: ${i.reasoning || 'Extracted from conversation history'}
- **Last Updated**: ${i.updated_at}
`).join('\n')}

---
*Back to: [[Memories/Index|Memories Index]] · [[Home|Vault Home]]*
`;
    fs.writeFileSync(catFile, catMd, 'utf8');
  }

  // 6. Write Memories/Index.md
  const memIndexMd = `---
title: "Long-Term Memories Index"
total_memories: ${rows.length}
updated: "${new Date().toISOString()}"
tags:
  - memory/index
---

# 🗃️ Long-Term Memories Index

Total Active Memories in SQLite: **${rows.length}**

## 📂 Memory Categories
${Object.keys(categorized).map(cat => `- [[Memories/${cat}|${cat.replace(/_/g, ' ').toUpperCase()}]] (${categorized[cat].length} facts)`).join('\n')}

---
*Linked to: [[Home|Vault Home]]*
`;
  fs.writeFileSync(path.join(VAULT_PATH, 'Memories', 'Index.md'), memIndexMd, 'utf8');
}

/**
 * Sync all conversation transcripts from SQLite into Obsidian Markdown files
 */
function syncConversations() {
  initVault();
  const sessions = db.getAllSessions();

  for (const s of sessions) {
    const transcript = db.getSessionTranscript(s.session_id);
    const sessionFile = path.join(VAULT_PATH, 'Conversations', `${s.session_id.replace(/[^\w-]/g, '_')}.md`);

    const mdContent = `---
session_id: "${s.session_id}"
start_time: "${s.start_time}"
end_time: "${s.end_time}"
message_count: ${s.message_count}
status: "${s.status}"
tags:
  - axom/conversation
---

# 💬 Chat Session: ${s.session_id}

> **Executive Summary**: ${s.summary || 'Session active or pending review.'}
> **Turns**: ${transcript.length} messages | **Recorded**: ${s.start_time}

---

## 📜 Full Transcript
${transcript.map(t => `### **${t.role.toUpperCase()}** *(at ${t.timestamp})*\n\n${t.content}\n`).join('\n---\n\n')}

---
*Back to: [[Conversations/Index|Conversations Index]] · [[Home|Vault Home]]*
`;
    fs.writeFileSync(sessionFile, mdContent, 'utf8');
  }

  // Write Conversations/Index.md
  const convIndex = `---
title: "Conversations Index"
total_sessions: ${sessions.length}
updated: "${new Date().toISOString()}"
tags:
  - axom/conversations
---

# 💬 Conversations Index

Total Archived Sessions: **${sessions.length}**

## 📂 Logged Sessions
${sessions.map(s => `- [[Conversations/${s.session_id.replace(/[^\w-]/g, '_')}|Session ${s.session_id}]] (${s.message_count} msgs, *${s.summary || 'active'}*)`).join('\n')}

---
*Back to: [[Home|Vault Home]]*
`;
  fs.writeFileSync(path.join(VAULT_PATH, 'Conversations', 'Index.md'), convIndex, 'utf8');
}

/**
 * Full bi-directional sync
 */
function syncAll() {
  initVault();
  syncProfileMemories();
  syncConversations();
  return {
    vaultPath: VAULT_PATH,
    vaultName: VAULT_NAME,
    timestamp: new Date().toISOString()
  };
}

/**
 * Read custom knowledge notes from the Obsidian Vault to inject into LLM Context
 */
function readVaultKnowledge(maxChars = 4000) {
  if (!fs.existsSync(VAULT_PATH)) return '';

  const knowledgeDir = path.join(VAULT_PATH, 'Knowledge');
  const projectsDir = path.join(VAULT_PATH, 'Projects');

  const snippets = [];

  function collectNotes(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isFile() && ent.name.endsWith('.md') && ent.name !== 'Index.md') {
        try {
          const filePath = path.join(dir, ent.name);
          const raw = fs.readFileSync(filePath, 'utf8');
          // Strip YAML frontmatter
          const clean = raw.replace(/^---[\s\S]*?---\s*/, '').trim();
          snippets.push(`### [Obsidian Note: ${prefix}/${ent.name.replace(/\.md$/, '')}]\n${clean.slice(0, 1000)}`);
        } catch (e) {}
      }
    }
  }

  collectNotes(knowledgeDir, 'Knowledge');
  collectNotes(projectsDir, 'Projects');

  if (snippets.length === 0) return '';

  let combined = '# [OBSIDIAN SECOND BRAIN KNOWLEDGE]\n' + snippets.join('\n\n') + '\n# [END OBSIDIAN KNOWLEDGE]\n';
  if (combined.length > maxChars) {
    combined = combined.slice(0, maxChars) + '\n... [Knowledge truncated]\n';
  }
  return combined;
}

/**
 * Launch Obsidian pointing to the Axom_Brain vault
 */
function launchObsidian() {
  initVault();
  const exePath = findObsidianExecutable();

  if (exePath && fs.existsSync(exePath)) {
    try {
      exec(`powershell -Command "Start-Process -FilePath '${exePath}'"`);
      return { success: true, method: 'executable', path: exePath, vault: VAULT_PATH };
    } catch (e) {}
  }

  // Windows protocol launcher: obsidian://open?path=...
  const encodedPath = encodeURIComponent(VAULT_PATH);
  exec(`start "" "obsidian://open?path=${encodedPath}"`, (err) => {
    if (err) {
      console.error('[OBSIDIAN] Failed to launch via protocol:', err);
    }
  });

  return { success: true, method: 'protocol', vault: VAULT_PATH };
}

/**
 * Get current Obsidian and Vault status
 */
function getStatus() {
  const exe = findObsidianExecutable();
  const exists = fs.existsSync(VAULT_PATH);

  let noteCount = 0;
  if (exists) {
    function countFiles(dir) {
      let count = 0;
      if (!fs.existsSync(dir)) return 0;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        if (f.isDirectory() && f.name !== '.obsidian') {
          count += countFiles(path.join(dir, f.name));
        } else if (f.isFile() && f.name.endsWith('.md')) {
          count++;
        }
      }
      return count;
    }
    noteCount = countFiles(VAULT_PATH);
  }

  return {
    obsidianInstalled: !!exe,
    obsidianPath: exe,
    vaultName: VAULT_NAME,
    vaultPath: VAULT_PATH,
    vaultExists: exists,
    noteCount
  };
}

module.exports = {
  VAULT_NAME,
  VAULT_PATH,
  initVault,
  syncProfileMemories,
  syncConversations,
  syncAll,
  readVaultKnowledge,
  findObsidianExecutable,
  launchObsidian,
  getStatus
};
