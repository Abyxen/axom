const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const reviewer = require('./memory_reviewer');
const browser = require('./browser_service');
const obsidianVault = require('./obsidian_vault');
const fileService = require('./file_service');
const researchSkills = require('./research_skills');
const studyService = require('./study_service');

const PORT = 8000;
const HOST = '127.0.0.1';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const PUBLIC_DIR = __dirname;

// Initialize Component A database & Obsidian Second Brain Vault
db.initDatabase();
try {
  studyService.initStudyDatabase(db.getDb());
} catch (e) {
  studyService.initStudyDatabase();
}
try {
  obsidianVault.initVault();
  obsidianVault.syncAll();
} catch (e) {
  console.warn('[OBSIDIAN] Initial vault sync notice:', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, data) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function pipeOllamaStream(ollamaRes, res, sessionId, requestedModel) {
  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasContent = false;
  let gatheredThinking = '';
  let isFirstChunk = true;
  let fullAssistantReply = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.thinking) {
          gatheredThinking += parsed.message.thinking;
          res.write(`data: ${JSON.stringify({ type: 'think', text: parsed.message.thinking })}\n\n`);
        }
        let textChunk = parsed.message?.content || '';
        if (isFirstChunk && textChunk) {
          textChunk = textChunk.replace(/^<\/think>\s*/i, '');
          if (textChunk) isFirstChunk = false;
        }
        if (textChunk) {
          hasContent = true;
          fullAssistantReply += textChunk;
          res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
        }
        if (parsed.done) {
          if (!hasContent && gatheredThinking) {
            fullAssistantReply = gatheredThinking;
            res.write(`data: ${JSON.stringify({ text: gatheredThinking })}\n\n`);
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        }
      } catch (e) {}
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer);
      if (parsed.message?.thinking) {
        gatheredThinking += parsed.message.thinking;
        res.write(`data: ${JSON.stringify({ type: 'think', text: parsed.message.thinking })}\n\n`);
      }
      let textChunk = parsed.message?.content || '';
      if (isFirstChunk && textChunk) {
        textChunk = textChunk.replace(/^<\/think>\s*/i, '');
        if (textChunk) isFirstChunk = false;
      }
      if (textChunk) {
        hasContent = true;
        fullAssistantReply += textChunk;
        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      }
    } catch (e) {}
  }

  if (!hasContent && gatheredThinking) {
    fullAssistantReply = gatheredThinking;
    res.write(`data: ${JSON.stringify({ text: gatheredThinking })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();

  if (fullAssistantReply) {
    db.logChatMessage(sessionId, 'assistant', fullAssistantReply);
    reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
  }
}

function sendText(res, statusCode, text) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || HOST}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: Health Check ---
  if (req.method === 'GET' && pathname === '/api/health') {
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'AXOM Backend',
          ollama: 'connected',
          database: 'connected (SQLite)'
        });
      } else {
        return sendJson(res, 503, {
          status: 'error',
          service: 'AXOM Backend',
          ollama: 'unhealthy',
          error: `Ollama returned status ${response.status}`
        });
      }
    } catch (err) {
      return sendJson(res, 503, {
        status: 'error',
        service: 'AXOM Backend',
        ollama: 'unreachable',
        error: 'Ollama service is not running on port 11434'
      });
    }
  }

  // --- API: Model Listing ---
  if (req.method === 'GET' && pathname === '/api/models') {
    return sendJson(res, 200, {
      models: ['axom:1.1'],
      data: [{ id: 'axom:1.1', name: 'Axom v1.1' }]
    });
  }

  // --- API: Memories & Permanent Profile State ---
  if (req.method === 'GET' && (pathname === '/api/memories' || pathname === '/api/memory/profile')) {
    const rows = db.getAllProfileMemory();
    if (pathname === '/api/memory/profile') {
      return sendJson(res, 200, {
        count: rows.length,
        profile: rows,
        snapshot: db.getProfileSnapshot(),
        context_block: db.formatProfileContext(rows)
      });
    }

    // Friendly array format for UI
    return sendJson(res, 200, rows.map((r, i) => ({
      id: String(i + 1),
      key: r.key,
      value: r.value,
      category: r.category,
      confidence: r.confidence_score,
      reasoning: r.reasoning,
      text: `[${r.category}] ${r.key}: ${r.value}`
    })));
  }

  // --- API: Manual Memory Mutation ---
  if (req.method === 'POST' && pathname === '/api/memory/actions') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText);
        const actions = Array.isArray(body.actions) ? body.actions : [body];
        const stats = db.applyMemoryActions(actions, body.session_id, body.summary);
        return sendJson(res, 200, { success: true, stats, current_memory: db.getAllProfileMemory() });
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // --- API: Trigger Session Review (Component C) ---
  if (req.method === 'POST' && pathname === '/api/sessions/review') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const sessionId = body.session_id || 'default_session';
        const model = body.model || 'axom:1.1';
        const result = await reviewer.triggerSessionReviewNow(sessionId, model, OLLAMA_BASE);
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // --- API: AI Research Skills Catalog (WenyuChiou/ai-research-skills) ---
  if (req.method === 'GET' && pathname === '/api/skills/research') {
    return sendJson(res, 200, {
      total_skills: researchSkills.RESEARCH_SKILLS.length,
      skills: researchSkills.RESEARCH_SKILLS,
      academic_tools: researchSkills.ACADEMIC_TOOLS,
      stages: [
        '1. Discover literature',
        '2. Organise & compare',
        '3a. Frame the problem',
        '3b. Plan the project',
        '4. Design & build model',
        '5. Run experiments & validate',
        '6. Visualise & interpret',
        '7. Draft manuscript',
        '8. Submit & respond'
      ]
    });
  }

  // --- API: Direct Research Skill Execution ---
  if (req.method === 'POST' && pathname === '/api/skills/research/execute') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const { tool, args } = body;
        if (!tool) {
          return sendJson(res, 400, { error: 'Missing "tool" name in request payload' });
        }
        const result = await researchSkills.executeResearchTool(tool, args || {}, process.cwd());
        return sendJson(res, 200, { tool, result });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // ============================================================================
  // --- AXOM STUDY (NOTEBOOKLM ARCHITECTURE) API ENDPOINTS ---
  // ============================================================================

  // 1. List / Create Notebooks
  if (req.method === 'GET' && pathname === '/api/study/notebooks') {
    const notebooks = studyService.getAllNotebooks();
    return sendJson(res, 200, { notebooks });
  }

  if (req.method === 'POST' && pathname === '/api/study/notebooks') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const nb = studyService.createNotebook(body.name || 'Untitled Notebook', body.description || '');
        return sendJson(res, 201, nb);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // 2. Get / Update / Delete Notebook
  if (req.method === 'GET' && pathname.startsWith('/api/study/notebooks/')) {
    const id = pathname.replace('/api/study/notebooks/', '');
    const nb = studyService.getNotebook(id);
    if (!nb) return sendJson(res, 404, { error: 'Notebook not found' });
    return sendJson(res, 200, nb);
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/study/notebooks/')) {
    const id = pathname.replace('/api/study/notebooks/', '');
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const updated = studyService.updateNotebook(id, body);
        return sendJson(res, 200, updated);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/study/notebooks/')) {
    const id = pathname.replace('/api/study/notebooks/', '');
    const result = studyService.deleteNotebook(id);
    return sendJson(res, 200, result);
  }

  // 3. Sources: List all / Add / Toggle / Unlink / Delete
  if (req.method === 'GET' && pathname === '/api/study/sources') {
    const sources = studyService.getAllLibrarySources();
    return sendJson(res, 200, { sources });
  }

  if (req.method === 'POST' && pathname === '/api/study/sources') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        let fileBuffer = null;
        if (body.file_base64) {
          fileBuffer = Buffer.from(body.file_base64, 'base64');
        }
        const src = await studyService.addSource({
          notebookId: body.notebook_id,
          title: body.title,
          type: body.type,
          url: body.url,
          rawText: body.raw_text,
          fileBuffer,
          fileName: body.file_name
        });
        return sendJson(res, 201, src);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/study/sources/toggle') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const resObj = studyService.toggleSourceContext(body.notebook_id, body.source_id, body.in_context, body.context_level);
        return sendJson(res, 200, resObj);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/study/sources/unlink') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const resObj = studyService.unlinkSourceFromNotebook(body.notebook_id, body.source_id);
        return sendJson(res, 200, resObj);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/study/sources/')) {
    const id = pathname.replace('/api/study/sources/', '');
    const result = studyService.deleteSource(id);
    return sendJson(res, 200, result);
  }

  // 4. Transformations & Insights
  if (req.method === 'POST' && pathname === '/api/study/transformations') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const insight = await studyService.generateTransformation({
          sourceId: body.source_id,
          transformationType: body.transformation_type || 'summary',
          customPrompt: body.custom_prompt,
          model: body.model || 'axom:1.1'
        });
        return sendJson(res, 200, insight);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // 5. Notes CRUD
  if (req.method === 'POST' && pathname === '/api/study/notes') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const note = studyService.createNote({
          notebookId: body.notebook_id,
          title: body.title || 'Untitled Note',
          content: body.content || '',
          sourceType: body.source_type || 'human'
        });
        return sendJson(res, 201, note);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'PUT' && pathname.startsWith('/api/study/notes/')) {
    const id = pathname.replace('/api/study/notes/', '');
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const updated = studyService.updateNote(id, body);
        return sendJson(res, 200, updated);
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/study/notes/')) {
    const id = pathname.replace('/api/study/notes/', '');
    const result = studyService.deleteNote(id);
    return sendJson(res, 200, result);
  }

  // 6. Grounded Study Chat
  if (req.method === 'POST' && pathname === '/api/study/chat') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const messages = Array.isArray(body.messages) && body.messages.length > 0 
          ? body.messages 
          : (body.prompt ? [{ role: 'user', content: body.prompt }] : []);
        const chatResult = await studyService.notebookChat({
          notebookId: body.notebook_id,
          messages,
          model: body.model || 'axom:1.1'
        });
        return sendJson(res, 200, chatResult);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // 7. Studio: Audio Overview / Podcast Deep Dive
  if (req.method === 'POST' && pathname === '/api/study/podcasts') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = bodyText ? JSON.parse(bodyText) : {};
        const ep = await studyService.generatePodcast({
          notebookId: body.notebook_id,
          title: body.title,
          style: body.style,
          instructions: body.instructions,
          model: body.model || 'axom:1.1'
        });
        return sendJson(res, 200, ep);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // --- API: List All Sessions ---
  if (req.method === 'GET' && pathname === '/api/sessions') {
    const sessions = db.getAllSessions();
    return sendJson(res, 200, { count: sessions.length, sessions });
  }

  // --- API: Get Session Transcript ---
  if (req.method === 'GET' && pathname.startsWith('/api/sessions/') && pathname.endsWith('/transcript')) {
    const parts = pathname.split('/');
    const sessId = decodeURIComponent(parts[3]);
    const transcript = db.getSessionTranscript(sessId);
    return sendJson(res, 200, { session_id: sessId, count: transcript.length, transcript });
  }

  // --- API: Training Metrics ---
  if (req.method === 'GET' && pathname === '/api/training/metrics') {
    return sendJson(res, 200, {
      model: 'Axom 1.1 (Qwen 3.5 4B Uncensored Fine-Tuned)',
      dataset_examples: 4364,
      dataset_words: 500490,
      dataset_status: 'Complete (500,490 words generated)',
      step: 264,
      max_steps: 2600,
      loss: '0.7069',
      speed: '~28.5s/step (16 seq/batch)',
      eta: 'Checkpoints saved to Google Drive & Local Storage',
      checkpoints: ['checkpoint-250']
    });
  }

  // --- API: Projects ---
  if (req.method === 'GET' && pathname === '/api/projects') {
    return sendJson(res, 200, [
      { id: '1', name: 'AXOM Core Engine', status: 'Active', model: 'axom:1.1' }
    ]);
  }

  // --- API: Live Web Browser Proxy (Embed and browse real internet websites) ---
  if (req.method === 'GET' && pathname === '/api/browser/proxy') {
    let targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      return sendText(res, 400, 'Missing url query parameter');
    }
    targetUrl = targetUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });

      const contentType = fetchRes.headers.get('content-type') || 'text/html';
      const finalUrl = fetchRes.url || targetUrl;

      if (contentType.includes('text/html')) {
        let html = await fetchRes.text();

        const interceptScript = `
<base href="${finalUrl}">
<script>
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if(a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')){
      e.preventDefault();
      try {
        var dest = new URL(a.getAttribute('href'), "${finalUrl}").href;
        window.parent.postMessage({ act: 'browserNavigated', url: dest }, '*');
        window.location.href = '/api/browser/proxy?url=' + encodeURIComponent(dest);
      } catch(err) {
        window.location.href = a.href;
      }
    }
  }, true);
  document.addEventListener('submit', function(e){
    var form = e.target;
    if(form && (form.method || 'GET').toUpperCase() === 'GET'){
      e.preventDefault();
      try {
        var actionUrl = form.action ? new URL(form.action, "${finalUrl}") : new URL("${finalUrl}");
        var formData = new FormData(form);
        for(var pair of formData.entries()){
          actionUrl.searchParams.set(pair[0], pair[1]);
        }
        var dest = actionUrl.href;
        window.parent.postMessage({ act: 'browserNavigated', url: dest }, '*');
        window.location.href = '/api/browser/proxy?url=' + encodeURIComponent(dest);
      } catch(err){
        form.submit();
      }
    }
  }, true);
  window.addEventListener('load', function(){
    window.parent.postMessage({ act: 'browserLoaded', url: "${finalUrl}", title: document.title }, '*');
  });
})();
<\/script>
`;

        if (html.includes('<head>')) {
          html = html.replace('<head>', '<head>' + interceptScript);
        } else if (html.includes('<html>')) {
          html = html.replace('<html>', '<html><head>' + interceptScript + '</head>');
        } else {
          html = interceptScript + html;
        }

        setCors(res);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        return res.end(html);
      } else {
        const buffer = await fetchRes.arrayBuffer();
        setCors(res);
        res.writeHead(fetchRes.status, {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600'
        });
        return res.end(Buffer.from(buffer));
      }
    } catch (err) {
      setCors(res);
      res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erro de Navega\u00e7\u00e3o</title><style>
body{font-family:-apple-system,sans-serif;padding:32px 24px;color:#f4f4f5;background:#09090b;min-height:100vh;margin:0;box-sizing:border-box}
h2{color:#ff512f;margin-top:0}
p{color:#a1a1aa}
pre{background:#18181b;padding:12px;border-radius:6px;color:#ef4444;border:1px solid #27272a;overflow-x:auto}
button{padding:8px 14px;background:#27272a;color:#fff;border:0;border-radius:5px;cursor:pointer;margin-top:12px}
button:hover{background:#3f3f46}
</style></head><body>
  <h2>N\u00e3o foi poss\u00edvel carregar a p\u00e1gina</h2>
  <p>O endere\u00e7o <code>${targetUrl}</code> n\u00e3o respondeu ou bloqueou o acesso.</p>
  <pre>${err.message}</pre>
  <button onclick="history.back()">Voltar</button>
</body></html>`);
    }
  }

  // --- API: Settings Save ---
  if (req.method === 'POST' && pathname === '/api/settings') {
    return sendJson(res, 200, { status: 'saved' });
  }

  // --- API: Obsidian Second Brain Status, Sync & Launcher ---
  if (req.method === 'GET' && pathname === '/api/obsidian/status') {
    const status = obsidianVault.getStatus();
    return sendJson(res, 200, status);
  }

  if (req.method === 'POST' && pathname === '/api/obsidian/sync') {
    const syncRes = obsidianVault.syncAll();
    const status = obsidianVault.getStatus();
    return sendJson(res, 200, { success: true, ...syncRes, ...status });
  }

  if (req.method === 'POST' && pathname === '/api/obsidian/open') {
    const launchRes = obsidianVault.launchObsidian();
    return sendJson(res, 200, launchRes);
  }

  // --- API: Multi-Modal File Processing (Images, PDFs, Documents, & Workspace) ---
  if (req.method === 'POST' && pathname === '/api/files/parse') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 25 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText);
        const files = Array.isArray(body.files) ? body.files : [];
        const prompt = body.prompt || '';
        const results = [];
        for (const f of files) {
          const processed = await fileService.processUploadedFile(f, prompt);
          results.push(processed);
        }
        return sendJson(res, 200, { success: true, results });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/files/save') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 25 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText);
        if (!body.filename || body.content === undefined) {
          return sendJson(res, 400, { error: 'filename and content required' });
        }
        const saved = fileService.saveWorkspaceFile(body.filename, body.content, body.subfolder);
        return sendJson(res, 200, saved);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/files/workspace') {
    const list = fileService.listWorkspaceFiles();
    return sendJson(res, 200, { files: list });
  }

  // --- API: Chat Completion (Streaming SSE & Non-Streaming JSON) ---
  if (req.method === 'POST' && pathname === '/api/chat') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 10 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText);
        const requestedModel = 'axom:1.1';
        const sessionId = body.session_id || 'default_session';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const params = body.params || {};
        const isStream = params.stream === true;

        // COMPONENT A: Log incoming user message to raw chat logs
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg && lastUserMsg.content) {
          db.logChatMessage(sessionId, 'user', lastUserMsg.content);
        }

        // COMPONENT B: SESSION DATA INJECTION & AGENTIC DIRECTIVE
        // Query user_profile_memory and Obsidian Vault for active knowledge
        const profileContext = db.formatProfileContext();
        let vaultKnowledge = '';
        try {
          vaultKnowledge = obsidianVault.readVaultKnowledge();
        } catch (e) {
          console.warn('[SERVER] Vault read notice:', e.message);
        }
        const fullMemoryContext = vaultKnowledge ? `${profileContext}\n\n${vaultKnowledge}` : profileContext;

        const userMsgObj = messages.filter(m => m.role === 'user').slice(-1)[0];
        const lastUserPrompt = userMsgObj ? (typeof userMsgObj.content === 'string' ? userMsgObj.content : '') : '';
        const autoSearchNeeded = browser.isWebSearchNeeded(lastUserPrompt);
        const autoResearchNeeded = researchSkills.isResearchTask(lastUserPrompt);
        const researchModeEnabled = body.research_mode === true || autoResearchNeeded;
        const webSearchEnabled = body.web_search === true || (body.web_mode !== 'offline' && autoSearchNeeded) || researchModeEnabled;

        const researchDirective = researchModeEnabled ? researchSkills.getResearchDirective() : '';
        const webDirective = (webSearchEnabled || researchModeEnabled)
          ? `\n\n# AUTONOMOUS DEEP INTELLIGENCE & GOOGLE LIVE WEB DIRECTIVE:
You have real-time autonomous access to Google and live internet intelligence via the search_web, browse_page, and open_browser tools.
CRITICAL OPERATIONAL PRINCIPLES:
1. DEEP REASONING & ACCURACY: When presented with current events, weather conditions, live forecasts, temperatures, technical errors, market prices, or complex research questions, ALWAYS actively retrieve live data via search_web or academic_search.
2. SYNTHESIS ARCHITECTURE:
   - Provide direct, definitive answers first.
   - Organize complex findings into high-density structured sections (e.g., Executive Summary, Current Conditions / Findings, Technical Details, Key Sources).
   - If multiple sources provide slight variations, state the consensus range clearly.
3. CITATIONS & VERIFICATION:
   - Reference key sources naturally using markdown links (e.g., [AccuWeather](url), [arXiv](url), [Official Docs](url)).
4. STRICT TONE & STYLE:
   - Maintain a mature, highly intelligent technical tone (comparable to Claude 3.5 Sonnet or Cursor).
   - Zero decorative emojis in all assistant responses.${researchDirective}`
          : (researchDirective || '');

        const formattedMessages = [];
        let systemInjected = false;

        for (const msg of messages) {
          if (msg.role === 'system') {
            formattedMessages.push({
              role: 'system',
              content: `${fullMemoryContext}${webDirective}\n\n${msg.content}`
            });
            systemInjected = true;
          } else {
            formattedMessages.push({ role: msg.role, content: msg.content });
          }
        }

        if (!systemInjected && (fullMemoryContext || webDirective)) {
          formattedMessages.unshift({
            role: 'system',
            content: `${fullMemoryContext}${webDirective}`
          });
        }

        // Fast response optimization: bypass slow reasoning monologue ONLY when NOT using tool calling (prevents Ollama Jinja 500 error)
        if (!webSearchEnabled && formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === 'user') {
          formattedMessages.push({ role: 'assistant', content: '</think>' });
        }

        const controller = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });

        // --- AGENTIC WORKFLOW: Autonomous Multi-Turn Web Search & Browsing ---
        if (webSearchEnabled) {
          let headersSent = false;
          let turn = 0;
          const MAX_AGENT_TURNS = 2;
          let finalReply = '';

          while (turn < MAX_AGENT_TURNS) {
            turn++;

            const availableTools = researchModeEnabled
              ? [...browser.BROWSING_TOOLS, ...researchSkills.ACADEMIC_TOOLS]
              : browser.BROWSING_TOOLS;

            const turnPayload = {
              model: requestedModel,
              messages: formattedMessages,
              tools: turn === 1 ? availableTools : undefined,
              stream: false,
              options: {
                temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
                num_predict: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 1024, 2048),
                top_k: typeof params.top_k === 'number' ? params.top_k : 50,
                stop: Array.isArray(params.stop) ? params.stop : []
              }
            };

            const turnRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(turnPayload),
              signal: controller.signal
            });

            if (!turnRes.ok) {
              const errDetail = await turnRes.text().catch(() => '');
              if (headersSent) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: errDetail })}\n\n`);
                return res.end();
              }
              return sendJson(res, turnRes.status, { error: `Ollama error (${turnRes.status}): ${errDetail}` });
            }

            const turnData = await turnRes.json();
            let toolCalls = turnData.message?.tool_calls;

            // Also parse XML/JSON tool calls embedded directly into message.content text
            if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
              const parsedTextCalls = browser.parseTextToolCalls(turnData.message?.content);
              if (parsedTextCalls && parsedTextCalls.length > 0) {
                toolCalls = parsedTextCalls;
              }
            }

            // Autonomous fail-safe: if auto-search was needed and the model failed to emit a tool call on turn 1
            if (turn === 1 && autoSearchNeeded && (!Array.isArray(toolCalls) || toolCalls.length === 0)) {
              const autoQuery = browser.extractSearchQuery(lastUserPrompt);
              if (autoQuery) {
                console.log(`[SERVER] Autonomous web search auto-triggered for: "${lastUserPrompt}" -> query: "${autoQuery}"`);
                toolCalls = [{
                  id: `auto_${Date.now()}`,
                  function: {
                    name: 'search_web',
                    arguments: { query: autoQuery }
                  }
                }];
              }
            }

            if (turn < MAX_AGENT_TURNS && Array.isArray(toolCalls) && toolCalls.length > 0) {
              if (isStream && !headersSent) {
                setCors(res);
                res.writeHead(200, {
                  'Content-Type': 'text/event-stream; charset=utf-8',
                  'Cache-Control': 'no-cache, no-transform',
                  'Connection': 'keep-alive'
                });
                headersSent = true;
              }

              // Append assistant message with tool calls
              formattedMessages.push({
                role: 'assistant',
                content: turnData.message?.tool_calls?.length ? (turnData.message?.content || '') : '',
                tool_calls: toolCalls
              });

              for (const call of toolCalls) {
                const toolName = call.function.name;
                const toolArgs = call.function.arguments || {};
                const callId = call.id || `tool_${Date.now()}`;

                if (isStream) {
                  res.write(`data: ${JSON.stringify({ type: 'tool_start', id: callId, name: toolName, args: toolArgs })}\n\n`);
                }

                let toolResult;
                try {
                  if (['academic_search', 'generate_bibtex', 'build_literature_matrix', 'evaluate_research_gap', 'create_design_brief', 'conduct_paper_review'].includes(toolName)) {
                    toolResult = await researchSkills.executeResearchTool(toolName, toolArgs, process.cwd());
                  } else {
                    toolResult = await browser.executeTool(toolName, toolArgs);
                  }
                } catch (err) {
                  toolResult = { error: err.message };
                }

                if (isStream) {
                  res.write(`data: ${JSON.stringify({ type: 'tool_end', id: callId, name: toolName, result: toolResult })}\n\n`);
                }

                const payloadStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
                formattedMessages.push({
                  role: 'tool',
                  content: payloadStr.length > 5000 ? payloadStr.slice(0, 5000) + '... [Results truncated for context window]' : payloadStr,
                  tool_call_id: call.id
                });
              }

              // Continue the loop so AXOM can browse the page found or synthesize!
              continue;
            } else {
              // No more tool calls! AXOM has computed the actual final answer.
              finalReply = (turnData.message?.content || '').replace(/^<\/think>\s*/i, '');
              if (!finalReply && turnData.message?.thinking) {
                finalReply = turnData.message.thinking;
              }
              // Strip any leftover <tool_call> tags from final text if any
              finalReply = finalReply.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim();
              // Strict zero-emoji compliance
              finalReply = finalReply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
              break;
            }
          }

          if (!isStream) {
            if (finalReply) {
              db.logChatMessage(sessionId, 'assistant', finalReply);
              reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
            }
            return sendJson(res, 200, { message: { role: 'assistant', content: finalReply } });
          }

          if (!headersSent) {
            setCors(res);
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive'
            });
            headersSent = true;
          }

          // Stream the final synthesized text smoothly to the client
          if (finalReply) {
            const tokens = finalReply.split(/(?<=\s+)/);
            for (const token of tokens) {
              res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
            }
          }
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();

          if (finalReply) {
            db.logChatMessage(sessionId, 'assistant', finalReply);
            reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
          }
          return;
        }

        // --- DIRECT STREAMING (Ultra-fast direct pipeline when web search is toggled off) ---
        const ollamaPayload = {
          model: requestedModel,
          messages: formattedMessages,
          stream: isStream,
          options: {
            temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
            num_predict: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 1024, 2048),
            top_k: typeof params.top_k === 'number' ? params.top_k : 50,
            stop: Array.isArray(params.stop) ? params.stop : []
          }
        };

        const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaPayload),
          signal: controller.signal
        });

        if (!ollamaRes.ok) {
          const errDetail = await ollamaRes.text().catch(() => '');
          return sendJson(res, ollamaRes.status, { error: `Ollama error (${ollamaRes.status}): ${errDetail}` });
        }

        if (!isStream) {
          const data = await ollamaRes.json();
          let finalReply = data.message?.content || '';
          finalReply = finalReply.replace(/^<\/think>\s*/i, '');
          if (!finalReply && data.message?.thinking) {
            finalReply = data.message.thinking;
          }
          finalReply = finalReply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
          if (data.message) {
            data.message.content = finalReply;
          }

          if (finalReply) {
            db.logChatMessage(sessionId, 'assistant', finalReply);
            reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
          }

          return sendJson(res, 200, data);
        }

        // Server-Sent Events (SSE) Direct Streaming
        setCors(res);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        });

        return pipeOllamaStream(ollamaRes, res, sessionId, requestedModel);
      } catch (err) {
        if (err.name === 'AbortError') return res.end();
        console.error('Chat error:', err);
        return sendJson(res, 500, { error: `Backend error processing chat: ${err.message}` });
      }
    });
    return;
  }

  // --- Static File Serving ---
  if (req.method === 'GET' || req.method === 'HEAD') {
    let safePath = pathname === '/' ? '/index.html' : pathname;
    safePath = path.normalize(safePath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    // Verify path is within PUBLIC_DIR
    if (!filePath.startsWith(PUBLIC_DIR)) {
      return sendText(res, 403, 'Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        return sendText(res, 404, 'File not found');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      setCors(res);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Cache-Control': 'no-cache'
      });

      if (req.method === 'HEAD') {
        res.end();
      } else {
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
    });
    return;
  }

  sendText(res, 405, 'Method Not Allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`=========================================`);
  console.log(`⚡ AXOM Local Backend running at:`);
  console.log(`   http://${HOST}:${PORT}`);
  console.log(`   Connected to Ollama at: ${OLLAMA_BASE}`);
  console.log(`   Living Brain Architecture: ACTIVE`);
  console.log(`=========================================`);

  // Pre-load Axom 1.1 into GPU VRAM
  fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'axom:1.1', keep_alive: -1 })
  }).catch(() => {});
});
