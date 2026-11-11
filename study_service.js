// ============================================================================
// AXOM STUDY SUBSYSTEM (Google NotebookLM & Open-Notebook Architecture)
// Zero External Dependencies: Pure Node.js (SQLite, fs, path, http, https)
// Notebooks, Sources, Document Insights, Grounded Study Chat, Notes & Podcasts
// ============================================================================

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const fileService = require('./file_service');
const browserService = require('./browser_service');

const OLLAMA_BASE = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'axom:1.1';
const DB_PATH = path.join(__dirname, 'data', 'axom_memory.db');

const USER_DOCUMENTS = path.join(process.env.USERPROFILE || 'C:\\Users\\abira', 'Documents');
const OBSIDIAN_STUDY_PATH = path.join(USER_DOCUMENTS, 'Axom_Brain', 'Study');

let db = null;

/**
 * Initialize Study SQLite Tables
 */
function initStudyDatabase(databaseInstance) {
  if (databaseInstance) {
    db = databaseInstance;
  } else if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(DB_PATH);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS study_notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS study_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT,
      file_path TEXT,
      raw_text TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_source_links (
      notebook_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      in_context INTEGER DEFAULT 1,
      context_level TEXT DEFAULT 'full',
      created_at TEXT NOT NULL,
      PRIMARY KEY (notebook_id, source_id)
    );

    CREATE TABLE IF NOT EXISTS study_insights (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      transformation_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_notes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_type TEXT DEFAULT 'human',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_podcasts (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      title TEXT NOT NULL,
      style TEXT DEFAULT 'deep_dive',
      speakers TEXT NOT NULL,
      outline TEXT NOT NULL,
      transcript TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_study_sources_type ON study_sources(type);
    CREATE INDEX IF NOT EXISTS idx_study_links_nb ON study_source_links(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_study_insights_src ON study_insights(source_id);
    CREATE INDEX IF NOT EXISTS idx_study_notes_nb ON study_notes(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_study_podcasts_nb ON study_podcasts(notebook_id);
  `);

  // Ensure Obsidian Study directory exists
  try {
    if (!fs.existsSync(OBSIDIAN_STUDY_PATH)) {
      fs.mkdirSync(OBSIDIAN_STUDY_PATH, { recursive: true });
    }
  } catch (e) {
    console.warn('[STUDY] Obsidian Study directory init notice:', e.message);
  }

  // Seed initial welcome notebook if table is completely empty
  const countRow = db.prepare('SELECT COUNT(*) as c FROM study_notebooks').get();
  if (!countRow || countRow.c === 0) {
    seedInitialNotebook();
  }
}

/**
 * Seed foundational notebook
 */
function seedInitialNotebook() {
  const nbId = 'nb_foundational';
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO study_notebooks (id, name, description, created_at, updated_at, archived)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(nbId, 'AI Systems & Agentic Architecture', 'Research notebook exploring autonomous agents, multi-model workflows, and cognitive second brain architectures.', now, now);

  const srcId = 'src_agentic_foundations';
  const text = `# Foundations of Agentic AI & Cognitive Computing
Autonomous AI agents represent an architectural evolution beyond single-turn conversational chatbots. 
An agentic system combines:
1. Perception & Context Management: Ingesting heterogeneous inputs (PDFs, code, web search, real-time news) into bounded memory contexts.
2. Cognitive Second Brain: Maintaining long-term semantic persistence through knowledge graphs, Markdown vaults (such as Obsidian), and structured relational stores.
3. Tool Execution Loop: Autonomous multi-turn reasoning where the agent plans, calls functions, observes tool outputs, and synthesizes answers with source citations.
4. Studio & Transformations: Distilling raw knowledge into structured outlines, multi-speaker conversational podcasts, and study guides.

Grounded reasoning prevents hallucination by enforcing verifiable claim-evidence linkages directly to ingested sources.`;

  db.prepare(`
    INSERT INTO study_sources (id, title, type, url, file_path, raw_text, word_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(srcId, 'Foundations of Agentic AI (Overview)', 'text', null, null, text, text.split(/\s+/).length, now);

  db.prepare(`
    INSERT INTO study_source_links (notebook_id, source_id, in_context, context_level, created_at)
    VALUES (?, ?, 1, 'full', ?)
  `).run(nbId, srcId, now);

  db.prepare(`
    INSERT INTO study_insights (id, source_id, transformation_type, title, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('ins_summary_1', srcId, 'summary', 'Dense Architectural Summary', 'Autonomous agentic AI transitions conversational models into multi-turn reasoning engines capable of planning, executing tools, managing long-term memory via Obsidian second brains, and producing verifiable citations.', now);

  db.prepare(`
    INSERT INTO study_notes (id, notebook_id, title, content, source_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('note_1', nbId, 'Key Principles for AXOM Study', '- All study answers must link to verifiable sources.\n- Support multi-speaker audio podcasts with alternating host and expert voices.\n- Synchronize notes bi-directionally with Obsidian.', 'human', now, now);

  syncNotebookToObsidian(nbId);
}

/**
 * Sync Notebook to Obsidian Second Brain Vault
 */
function syncNotebookToObsidian(notebookId) {
  try {
    const nb = db.prepare('SELECT * FROM study_notebooks WHERE id = ?').get(notebookId);
    if (!nb) return;

    const safeName = nb.name.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const nbFolder = path.join(OBSIDIAN_STUDY_PATH, safeName);
    if (!fs.existsSync(nbFolder)) fs.mkdirSync(nbFolder, { recursive: true });

    // Overview note
    const overviewContent = `---
type: study-notebook
id: ${nb.id}
created: ${nb.created_at}
updated: ${nb.updated_at}
tags:
  - axom-study
  - notebook
---

# ${nb.name}

> ${nb.description || 'No description provided.'}

## Sources Linked
${getSourcesForNotebook(notebookId).map(s => `- [[${s.title}]] (${s.type}, ${s.word_count} words)`).join('\n') || '*No sources linked yet.*'}

## Notebook Notes
${getNotesForNotebook(notebookId).map(n => `- [[${n.title}]] (${n.source_type})`).join('\n') || '*No notes created yet.*'}
`;
    fs.writeFileSync(path.join(nbFolder, 'README.md'), overviewContent, 'utf8');

    // Sync sources
    const sourcesDir = path.join(nbFolder, 'Sources');
    if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true });
    for (const src of getSourcesForNotebook(notebookId)) {
      const srcFile = path.join(sourcesDir, `${src.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`);
      const srcContent = `---
source_id: ${src.id}
type: ${src.type}
url: ${src.url || ''}
words: ${src.word_count}
date: ${src.created_at}
tags:
  - axom-source
---

# ${src.title}

${src.raw_text}
`;
      fs.writeFileSync(srcFile, srcContent, 'utf8');
    }

    // Sync notes
    const notesDir = path.join(nbFolder, 'Notes');
    if (!fs.existsSync(notesDir)) fs.mkdirSync(notesDir, { recursive: true });
    for (const note of getNotesForNotebook(notebookId)) {
      const noteFile = path.join(notesDir, `${note.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`);
      const noteContent = `---
note_id: ${note.id}
author: ${note.source_type}
created: ${note.created_at}
tags:
  - axom-note
---

# ${note.title}

${note.content}
`;
      fs.writeFileSync(noteFile, noteContent, 'utf8');
    }
  } catch (err) {
    console.warn('[STUDY] Obsidian mirror error:', err.message);
  }
}

// ==========================================
// NOTEBOOK CRUD
// ==========================================

function getAllNotebooks(includeArchived = false) {
  const sql = includeArchived
    ? 'SELECT * FROM study_notebooks ORDER BY updated_at DESC'
    : 'SELECT * FROM study_notebooks WHERE archived = 0 ORDER BY updated_at DESC';
  const rows = db.prepare(sql).all();

  return rows.map(r => {
    const sourcesCount = db.prepare('SELECT COUNT(*) as c FROM study_source_links WHERE notebook_id = ?').get(r.id)?.c || 0;
    const notesCount = db.prepare('SELECT COUNT(*) as c FROM study_notes WHERE notebook_id = ?').get(r.id)?.c || 0;
    const podcastsCount = db.prepare('SELECT COUNT(*) as c FROM study_podcasts WHERE notebook_id = ?').get(r.id)?.c || 0;
    return {
      ...r,
      sources_count: sourcesCount,
      notes_count: notesCount,
      podcasts_count: podcastsCount
    };
  });
}

function getNotebook(id) {
  const nb = db.prepare('SELECT * FROM study_notebooks WHERE id = ?').get(id);
  if (!nb) return null;

  const sources = getSourcesForNotebook(id);
  const notes = getNotesForNotebook(id);
  const podcasts = getPodcastsForNotebook(id);

  return {
    ...nb,
    sources,
    notes,
    podcasts
  };
}

function createNotebook(name, description = '') {
  const id = 'nb_' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO study_notebooks (id, name, description, created_at, updated_at, archived)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, name.trim(), description.trim(), now, now);

  syncNotebookToObsidian(id);
  return getNotebook(id);
}

function updateNotebook(id, { name, description, archived }) {
  const now = new Date().toISOString();
  const current = db.prepare('SELECT * FROM study_notebooks WHERE id = ?').get(id);
  if (!current) return null;

  const newName = typeof name === 'string' ? name.trim() : current.name;
  const newDesc = typeof description === 'string' ? description.trim() : current.description;
  const newArchived = typeof archived === 'number' ? archived : current.archived;

  db.prepare(`
    UPDATE study_notebooks
    SET name = ?, description = ?, archived = ?, updated_at = ?
    WHERE id = ?
  `).run(newName, newDesc, newArchived, now, id);

  syncNotebookToObsidian(id);
  return getNotebook(id);
}

function deleteNotebook(id) {
  db.prepare('DELETE FROM study_source_links WHERE notebook_id = ?').run(id);
  db.prepare('DELETE FROM study_notes WHERE notebook_id = ?').run(id);
  db.prepare('DELETE FROM study_podcasts WHERE notebook_id = ?').run(id);
  db.prepare('DELETE FROM study_notebooks WHERE id = ?').run(id);
  return { success: true, deleted_id: id };
}

// ==========================================
// SOURCE INGESTION & MANAGEMENT
// ==========================================

function getSourcesForNotebook(notebookId) {
  const rows = db.prepare(`
    SELECT s.*, l.in_context, l.context_level
    FROM study_sources s
    JOIN study_source_links l ON s.id = l.source_id
    WHERE l.notebook_id = ?
    ORDER BY s.created_at DESC
  `).all(notebookId);

  return rows.map(r => ({
    ...r,
    in_context: Boolean(r.in_context),
    insights: getInsightsForSource(r.id)
  }));
}

function getAllLibrarySources() {
  const rows = db.prepare('SELECT * FROM study_sources ORDER BY created_at DESC').all();
  return rows.map(r => ({
    ...r,
    insights: getInsightsForSource(r.id)
  }));
}

function getSource(sourceId) {
  const src = db.prepare('SELECT * FROM study_sources WHERE id = ?').get(sourceId);
  if (!src) return null;
  return {
    ...src,
    insights: getInsightsForSource(sourceId)
  };
}

async function addSource({ notebookId, title, type, url, rawText, fileBuffer, fileName }) {
  const sourceId = 'src_' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  let extractedText = rawText || '';

  // Process Document File (PDF, DOCX, TXT)
  if (fileBuffer) {
    const ext = path.extname(fileName || '').toLowerCase();
    if (ext === '.pdf') {
      try {
        const pdfData = fileService.parsePdf(fileBuffer);
        extractedText = pdfData.text || '';
        if (!title && pdfData.metadata?.title) title = pdfData.metadata.title;
      } catch (err) {
        console.warn('[STUDY] PDF extraction error:', err.message);
        extractedText = fileBuffer.toString('utf8');
      }
    } else if (ext === '.docx') {
      try {
        const docxData = fileService.parseDocx(fileBuffer);
        extractedText = docxData.text || '';
      } catch (err) {
        extractedText = fileBuffer.toString('utf8');
      }
    } else {
      extractedText = fileBuffer.toString('utf8');
    }
  } else if (url && (!extractedText || !extractedText.trim())) {
    // Process Web URL via fetch + browser_service.extractReadableText
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (res.ok) {
        const html = await res.text();
        extractedText = browserService.extractReadableText ? browserService.extractReadableText(html, 15000) : html.replace(/<[^>]+>/g, ' ');
      }
    } catch (err) {
      console.warn('[STUDY] Web URL fetch error:', err.message);
      extractedText = `Content from ${url}`;
    }
  }

  const cleanTitle = (title || fileName || url || 'Untitled Source').trim();
  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;

  db.prepare(`
    INSERT INTO study_sources (id, title, type, url, file_path, raw_text, word_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sourceId, cleanTitle, type || 'text', url || null, fileName || null, extractedText, wordCount, now);

  if (notebookId) {
    db.prepare(`
      INSERT OR REPLACE INTO study_source_links (notebook_id, source_id, in_context, context_level, created_at)
      VALUES (?, ?, 1, 'full', ?)
    `).run(notebookId, sourceId, now);

    db.prepare('UPDATE study_notebooks SET updated_at = ? WHERE id = ?').run(now, notebookId);
    syncNotebookToObsidian(notebookId);
  }

  return getSource(sourceId);
}

function toggleSourceContext(notebookId, sourceId, inContext, contextLevel = 'full') {
  db.prepare(`
    UPDATE study_source_links
    SET in_context = ?, context_level = ?
    WHERE notebook_id = ? AND source_id = ?
  `).run(inContext ? 1 : 0, contextLevel, notebookId, sourceId);

  return { success: true, notebookId, sourceId, inContext, contextLevel };
}

function unlinkSourceFromNotebook(notebookId, sourceId) {
  db.prepare('DELETE FROM study_source_links WHERE notebook_id = ? AND source_id = ?').run(notebookId, sourceId);
  syncNotebookToObsidian(notebookId);
  return { success: true };
}

function deleteSource(sourceId) {
  db.prepare('DELETE FROM study_source_links WHERE source_id = ?').run(sourceId);
  db.prepare('DELETE FROM study_insights WHERE source_id = ?').run(sourceId);
  db.prepare('DELETE FROM study_sources WHERE id = ?').run(sourceId);
  return { success: true, deleted_id: sourceId };
}

// ==========================================
// INSIGHTS & TRANSFORMATIONS
// ==========================================

function getInsightsForSource(sourceId) {
  return db.prepare('SELECT * FROM study_insights WHERE source_id = ? ORDER BY created_at DESC').all(sourceId);
}

const TRANSFORMATION_PROMPTS = {
  summary: 'Generate a comprehensive, high-density structured summary covering the core thesis, methodology, key findings, and implications. Format with clear markdown sections.',
  key_points: 'Extract the top 5 to 8 most crucial takeaways, breakthrough concepts, and quantitative figures from this source. Use bullet points.',
  study_guide: 'Create a structured study guide including: 1. Core Concepts, 2. Vocabulary & Definitions, 3. Review Questions with Answers, 4. Critical Themes.',
  faq: 'Construct a list of 5 to 7 Frequently Asked Questions (FAQ) and thorough answers based strictly on the provided content.',
  timeline: 'Extract a chronological timeline or structured progression of events, milestones, and development stages presented in this material.',
  critique: 'Provide a rigorous scientific critique evaluating strengths, potential limitations, hidden assumptions, and open research questions.'
};

async function generateTransformation({ sourceId, transformationType = 'summary', customPrompt = '', model = DEFAULT_MODEL }) {
  const src = db.prepare('SELECT * FROM study_sources WHERE id = ?').get(sourceId);
  if (!src) throw new Error('Source not found');

  const instruction = customPrompt || TRANSFORMATION_PROMPTS[transformationType] || TRANSFORMATION_PROMPTS.summary;
  const prompt = `You are an expert cognitive study assistant. Analyze the source below and execute the requested transformation.
STRICT RULES:
1. Ground your response strictly on the source text. Do not invent facts or extrapolate beyond provided evidence.
2. Maintain an intelligent, mature tone.
3. Zero decorative emojis.
4. Output clean, readable GitHub-flavored markdown.

# SOURCE TITLE: ${src.title}
# SOURCE TYPE: ${src.type}

# SOURCE CONTENT:
${src.raw_text.slice(0, 10000)}

# TRANSFORMATION DIRECTIVE:
${instruction}`;

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: { temperature: 0.3, num_predict: 2048 }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama failed with status ${res.status}`);
  }

  const data = await res.json();
  let content = data.message?.content || '';
  content = content.replace(/^<\/think>\s*/i, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

  const insightId = 'ins_' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  const title = `${transformationType.toUpperCase().replace('_', ' ')}: ${src.title}`;

  db.prepare(`
    INSERT INTO study_insights (id, source_id, transformation_type, title, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(insightId, sourceId, transformationType, title, content, now);

  return {
    id: insightId,
    source_id: sourceId,
    transformation_type: transformationType,
    title,
    content,
    created_at: now
  };
}

// ==========================================
// NOTES MANAGEMENT
// ==========================================

function getNotesForNotebook(notebookId) {
  return db.prepare('SELECT * FROM study_notes WHERE notebook_id = ? ORDER BY created_at DESC').all(notebookId);
}

function createNote({ notebookId, title, content, sourceType = 'human' }) {
  const id = 'note_' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO study_notes (id, notebook_id, title, content, source_type, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, notebookId, title.trim(), content.trim(), sourceType, now, now);

  db.prepare('UPDATE study_notebooks SET updated_at = ? WHERE id = ?').run(now, notebookId);
  syncNotebookToObsidian(notebookId);

  return db.prepare('SELECT * FROM study_notes WHERE id = ?').get(id);
}

function updateNote(noteId, { title, content }) {
  const now = new Date().toISOString();
  const cur = db.prepare('SELECT * FROM study_notes WHERE id = ?').get(noteId);
  if (!cur) return null;

  const newTitle = typeof title === 'string' ? title.trim() : cur.title;
  const newContent = typeof content === 'string' ? content.trim() : cur.content;

  db.prepare(`
    UPDATE study_notes
    SET title = ?, content = ?, updated_at = ?
    WHERE id = ?
  `).run(newTitle, newContent, now, noteId);

  syncNotebookToObsidian(cur.notebook_id);
  return db.prepare('SELECT * FROM study_notes WHERE id = ?').get(noteId);
}

function deleteNote(noteId) {
  const cur = db.prepare('SELECT * FROM study_notes WHERE id = ?').get(noteId);
  if (!cur) return { success: false };

  db.prepare('DELETE FROM study_notes WHERE id = ?').run(noteId);
  syncNotebookToObsidian(cur.notebook_id);
  return { success: true, deleted_id: noteId };
}

// ==========================================
// NOTEBOOK-GROUNDED STUDY CHAT (WITH CITATIONS)
// ==========================================

async function notebookChat({ notebookId, messages = [], model = DEFAULT_MODEL }) {
  const nb = getNotebook(notebookId);
  if (!nb) throw new Error('Notebook not found');

  // Gather active sources
  const activeSources = (nb.sources || []).filter(s => s.in_context);
  const activeNotes = nb.notes || [];

  // Build Context Blocks
  let contextBlock = '';
  const citationIndex = [];

  for (let i = 0; i < activeSources.length; i++) {
    const s = activeSources[i];
    const refTag = `source:${s.id}`;
    citationIndex.push({ tag: refTag, id: s.id, type: 'source', title: s.title });

    if (s.context_level === 'insights_only') {
      const insightsText = (s.insights || []).map(ins => `[${ins.transformation_type.toUpperCase()}]: ${ins.content}`).join('\n\n');
      contextBlock += `\n<document id="${refTag}">\n# TITLE: ${s.title} (Type: ${s.type}, Level: Insights Only)\n${insightsText || 'No insights generated yet.'}\n</document>\n`;
    } else {
      contextBlock += `\n<document id="${refTag}">\n# TITLE: ${s.title} (Type: ${s.type})\n${s.raw_text.slice(0, 8000)}\n</document>\n`;
    }
  }

  for (let i = 0; i < activeNotes.length; i++) {
    const n = activeNotes[i];
    const refTag = `note:${n.id}`;
    citationIndex.push({ tag: refTag, id: n.id, type: 'note', title: n.title });
    contextBlock += `\n<document id="${refTag}">\n# NOTE: ${n.title} (Author: ${n.source_type})\n${n.content.slice(0, 4000)}\n</document>\n`;
  }

  const systemPrompt = `# SYSTEM ROLE
You are Axom Study, an intelligent cognitive study assistant inspired by Google NotebookLM and Open-Notebook.
You help users research, understand, and learn by engaging in focused discussions about documents in their current notebook workspace.

# NOTEBOOK WORKSPACE
Name: ${nb.name}
Description: ${nb.description || 'General study project'}

# CONTEXT (ACTIVE DOCUMENTS & NOTES)
${contextBlock || 'No sources or notes currently in context. Inform the user to add or enable sources.'}

# CITATION INSTRUCTIONS:
1. Whenever your response is based on any document in the context, cite it by placing its exact tag in brackets, for example [source:src_xxx] or [note:note_xxx].
2. Place citations naturally at the end of key factual assertions, claims, or data points.
3. Only cite documents that actually appear in the CONTEXT above. Do not invent document tags.
4. When math is required, render KaTeX formulas using $...$ for inline or $$...$$ for display equations.
5. Strict zero-emoji policy in all assistant turns. Output clean, beautiful, structured markdown.`;

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.slice(-8)
  ];

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      stream: false,
      options: { temperature: 0.4, num_predict: 2048 }
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama chat failed with status ${res.status}`);
  }

  const data = await res.json();
  let reply = data.message?.content || '';
  reply = reply.replace(/^<\/think>\s*/i, '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

  return {
    role: 'assistant',
    content: reply,
    citations: citationIndex,
    sources_in_context: activeSources.length,
    notes_in_context: activeNotes.length
  };
}

// ==========================================
// STUDIO: AUDIO OVERVIEW (PODCAST DEEP DIVE)
// ==========================================

function getPodcastsForNotebook(notebookId) {
  const rows = db.prepare('SELECT * FROM study_podcasts WHERE notebook_id = ? ORDER BY created_at DESC').all(notebookId);
  return rows.map(r => ({
    ...r,
    speakers: JSON.parse(r.speakers || '[]'),
    outline: JSON.parse(r.outline || '[]'),
    transcript: JSON.parse(r.transcript || '[]')
  }));
}

async function generatePodcast({ notebookId, title, style = 'deep_dive', instructions = '', model = DEFAULT_MODEL }) {
  const nb = getNotebook(notebookId);
  if (!nb) throw new Error('Notebook not found');

  const activeSources = (nb.sources || []).filter(s => s.in_context);
  const activeNotes = nb.notes || [];

  if (activeSources.length === 0 && activeNotes.length === 0) {
    throw new Error('Please add and enable at least one source or note in this notebook before generating an audio overview.');
  }

  let contentSummary = activeSources.map(s => `--- SOURCE: ${s.title} ---\n${s.raw_text.slice(0, 4000)}`).join('\n\n');
  contentSummary += '\n\n' + activeNotes.map(n => `--- NOTE: ${n.title} ---\n${n.content.slice(0, 1500)}`).join('\n\n');

  const speakers = [
    {
      name: 'Alex',
      role: 'Host',
      voice_id: 'host',
      pitch: 1.05,
      rate: 1.0,
      personality: 'Curious, approachable host who asks clarifying questions, uses analogies, and ensures complex topics remain engaging.'
    },
    {
      name: 'Jordan',
      role: 'Expert',
      voice_id: 'expert',
      pitch: 0.92,
      rate: 0.95,
      personality: 'Deep domain analyst who explains core mechanisms, highlights trade-offs, and breaks down the evidence.'
    }
  ];

  // Step 1: Generate Outline
  const outlinePrompt = `You are a podcast producer creating a NotebookLM-style "Deep Dive" audio overview outline.
Briefing: Create a 4-segment conversational podcast outline exploring "${nb.name}".
Additional user instructions: ${instructions || 'Engaging, insightful, conversational tone.'}

Content Context:
${contentSummary.slice(0, 6000)}

Return ONLY a valid JSON array of 4 segments: [{"name": "Segment Title", "description": "What is discussed"}]. No commentary, no markdown codeblocks, only raw JSON.`;

  let outline = [];
  try {
    const outRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: outlinePrompt }],
        stream: false,
        options: { temperature: 0.4 }
      })
    });
    const outData = await outRes.json();
    let outText = (outData.message?.content || '').replace(/```json|```/g, '').trim();
    const jsonStart = outText.indexOf('[');
    const jsonEnd = outText.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      outline = JSON.parse(outText.slice(jsonStart, jsonEnd + 1));
    }
  } catch (e) {
    console.warn('[STUDY] Podcast outline parse fallback:', e.message);
    outline = [
      { name: 'Introduction & Context', description: 'Welcoming listeners and introducing the core topic.' },
      { name: 'Key Mechanisms & Findings', description: 'Breaking down the critical insights from the sources.' },
      { name: 'Practical Implications & Trade-offs', description: 'Discussing what this means in practice.' },
      { name: 'Conclusion & Key Takeaways', description: 'Summary thoughts and closing remarks.' }
    ];
  }

  // Step 2: Generate Dialogue Script
  const transcriptPrompt = `You are writing a natural, educational two-speaker podcast dialogue in the style of Google NotebookLM Deep Dive.
Speakers:
1. Alex (Host): Curious, relatable, asks thoughtful questions, uses analogies.
2. Jordan (Expert): Knowledgeable, friendly, breaks down the technical evidence with enthusiasm.

Notebook: ${nb.name}
Outline Segments:
${outline.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n')}

Content to cover:
${contentSummary.slice(0, 6000)}

RULES:
- Alternate speakers naturally (Alex, Jordan, Alex, Jordan...).
- Write spoken, conversational dialogue (e.g. "That's fascinating", "Exactly", "Think of it this way...").
- Keep total turns between 8 and 14 lines so it's punchy and educational.
- Zero decorative emojis.
- Return ONLY a valid JSON array of dialogue turns: [{"speaker": "Alex", "text": "..."}, {"speaker": "Jordan", "text": "..."}]. No markdown code blocks, only raw JSON.`;

  let transcript = [];
  try {
    const transRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: transcriptPrompt }],
        stream: false,
        options: { temperature: 0.6 }
      })
    });
    const transData = await transRes.json();
    let transText = (transData.message?.content || '').replace(/```json|```/g, '').trim();
    const jStart = transText.indexOf('[');
    const jEnd = transText.lastIndexOf(']');
    if (jStart !== -1 && jEnd !== -1) {
      transcript = JSON.parse(transText.slice(jStart, jEnd + 1));
    }
  } catch (e) {
    console.warn('[STUDY] Podcast transcript parse fallback:', e.message);
    transcript = [
      { speaker: 'Alex', text: `Welcome back to our deep dive session! Today we are exploring ${nb.name}. Jordan, where should we start?` },
      { speaker: 'Jordan', text: 'Thanks Alex! The most exciting takeaway from these documents is how structured context transforms reasoning.' },
      { speaker: 'Alex', text: 'Right, instead of generic answers, everything is grounded directly in verifiable sources.' },
      { speaker: 'Jordan', text: 'Exactly. It creates complete transparency so you can trace every single claim right back to the original text.' }
    ];
  }

  const podcastId = 'pod_' + Math.random().toString(36).slice(2, 10);
  const now = new Date().toISOString();
  const epTitle = (title || `${nb.name} - Deep Dive Audio Overview`).trim();

  db.prepare(`
    INSERT INTO study_podcasts (id, notebook_id, title, style, speakers, outline, transcript, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(podcastId, notebookId, epTitle, style, JSON.stringify(speakers), JSON.stringify(outline), JSON.stringify(transcript), now);

  syncNotebookToObsidian(notebookId);

  return {
    id: podcastId,
    notebook_id: notebookId,
    title: epTitle,
    style,
    speakers,
    outline,
    transcript,
    created_at: now
  };
}

module.exports = {
  initStudyDatabase,
  getAllNotebooks,
  getNotebook,
  createNotebook,
  updateNotebook,
  deleteNotebook,
  addSource,
  getSource,
  getAllLibrarySources,
  toggleSourceContext,
  unlinkSourceFromNotebook,
  deleteSource,
  generateTransformation,
  getInsightsForSource,
  createNote,
  updateNote,
  deleteNote,
  getNotesForNotebook,
  notebookChat,
  generatePodcast,
  getPodcastsForNotebook,
  syncNotebookToObsidian,
  TRANSFORMATION_PROMPTS
};
