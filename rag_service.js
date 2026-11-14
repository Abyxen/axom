/**
 * AXOM RAG (Retrieval-Augmented Generation) Service
 * Manages document uploads, LanceDB hybrid vector indexing, and
 * grounded document chat completions.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT_DIR = __dirname;
const DOCS_DIR = path.join(ROOT_DIR, 'data', 'rag_docs');
const META_PATH = path.join(ROOT_DIR, 'data', 'rag_index_meta.json');
const PYTHON_SCRIPT = path.join(ROOT_DIR, 'scripts', 'rag_core.py');

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

/**
 * List all indexed and stored documents
 */
function listDocuments() {
  if (fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      // Verify files still exist on disk
      meta.documents = (meta.documents || []).filter(d => fs.existsSync(path.join(DOCS_DIR, d.filename)));
      meta.total_documents = meta.documents.length;
      return meta;
    } catch (e) {}
  }

  // Fallback scan
  if (!fs.existsSync(DOCS_DIR)) return { total_documents: 0, total_chunks: 0, documents: [] };
  const files = fs.readdirSync(DOCS_DIR).filter(f => fs.statSync(path.join(DOCS_DIR, f)).isFile());
  return {
    total_documents: files.length,
    total_chunks: 0,
    documents: files.map(f => {
      const stat = fs.statSync(path.join(DOCS_DIR, f));
      return {
        filename: f,
        size_bytes: stat.size,
        last_modified: stat.mtimeMs / 1000,
        chunks_count: 0
      };
    })
  };
}

/**
 * Save an uploaded document file to data/rag_docs
 */
function saveUploadedDocument(filename, data) {
  // Sanitize filename
  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const targetPath = path.join(DOCS_DIR, safeName);

  if (typeof data === 'string' && data.startsWith('data:')) {
    const base64Data = data.split(';base64,').pop();
    fs.writeFileSync(targetPath, Buffer.from(base64Data, 'base64'));
  } else if (Buffer.isBuffer(data)) {
    fs.writeFileSync(targetPath, data);
  } else {
    fs.writeFileSync(targetPath, String(data), 'utf8');
  }

  return { success: true, filename: safeName, size: fs.statSync(targetPath).size };
}

/**
 * Delete a document from data/rag_docs
 */
function deleteDocument(filename) {
  const safeName = path.basename(filename);
  const targetPath = path.join(DOCS_DIR, safeName);
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
    return { success: true, deleted: safeName };
  }
  return { error: 'Document not found' };
}

/**
 * Trigger Python ingestion and LanceDB indexing
 */
async function ingestDocuments() {
  return new Promise((resolve) => {
    execFile('python', [PYTHON_SCRIPT, '--ingest'], { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[RAG] Ingestion error:', stderr || err.message);
        return resolve({ error: stderr.trim() || err.message });
      }
      try {
        const out = stdout.trim();
        const jsonStart = out.lastIndexOf('{');
        const jsonStr = jsonStart !== -1 ? out.slice(jsonStart) : out;
        const res = JSON.parse(jsonStr);
        resolve(res);
      } catch (parseErr) {
        resolve({ success: true, output: stdout.trim() });
      }
    });
  });
}

/**
 * Search relevant chunks via LanceDB hybrid search
 */
async function searchChunks(query, topK = 4) {
  if (!query || typeof query !== 'string') return [];

  return new Promise((resolve) => {
    execFile('python', [PYTHON_SCRIPT, '--search', query, '--top-k', String(topK)], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[RAG] Search error:', stderr || err.message);
        return resolve([]);
      }
      try {
        const out = stdout.trim();
        const jsonStart = out.indexOf('[');
        const jsonStr = jsonStart !== -1 ? out.slice(jsonStart) : '[]';
        const results = JSON.parse(jsonStr);
        const rawResults = Array.isArray(results) ? results : [];
        const standardized = rawResults.map(r => ({
          ...r,
          doc: r.filename || r.doc,
          chunk_id: r.chunk_index !== undefined ? r.chunk_index : (r.chunk_id || 0),
          dense_score: r.vector_score !== undefined ? r.vector_score : (r.dense_score || 0)
        }));
        resolve(standardized);
      } catch (parseErr) {
        console.error('[RAG] JSON parse error during search:', parseErr);
        resolve([]);
      }
    });
  });
}

/**
 * Format grounding context block for prompt injection
 */
function formatGroundedContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '# LOCAL KNOWLEDGE BASE (GROUNDING CONTEXT):\nNO RELEVANT LOCAL DOCUMENTS FOUND FOR THIS INQUIRY.';
  }

  const lines = ['# VERIFIED DOCUMENT KNOWLEDGE BASE (GROUNDING CONTEXT):'];
  chunks.forEach((chunk, idx) => {
    const matchPercent = Math.round(chunk.score * 100);
    const pageInfo = chunk.page_number ? ` (Page ${chunk.page_number})` : '';
    lines.push(`--- Source ${idx + 1}: ${chunk.citation_tag}${pageInfo} [Relevance: ${matchPercent}%] ---`);
    lines.push(chunk.text);
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Get Grounded System Directive
 */
function getRagSystemDirective() {
  return `\n\n# HIGH-ACCURACY GROUNDED RAG DIRECTIVE:
You are AXOM's Document Intelligence Specialist. You answer user questions STRICTLY and EXCLUSIVELY based on the verified Document Knowledge Base provided in the context above.

CRITICAL ACCURACY GUIDELINES:
1. ABSOLUTE GROUNDING: Base your answer only on facts, dates, names, numbers, and technical specifications found in the retrieved document text. Never guess, assume, or extrapolate beyond the provided text.
2. CITATION DISCIPLINE: For every fact or claim, cite the source tag exactly as provided in the context headers, e.g. [doc:filename#chunk_index] (for example: [doc:quantum_cryptography_report.md#0]).
3. MISSING FACTS: If the provided documents do not contain the answer, state clearly: "The provided documents do not contain information regarding [topic]." Do NOT attempt to fabricate an answer.
4. TONE & FORMAT: Deliver clean, definitive, and high-density answers using GitHub-flavored Markdown. Bold key terms, use bullet points or tables where appropriate. Strictly zero decorative emojis.`;
}

module.exports = {
  listDocuments,
  saveUploadedDocument,
  deleteDocument,
  ingestDocuments,
  searchChunks,
  formatGroundedContext,
  getRagSystemDirective
};
