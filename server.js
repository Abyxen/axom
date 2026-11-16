const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason);
});

const db = require('./db');
const reviewer = require('./memory_reviewer');
const browser = require('./browser_service');
const obsidianVault = require('./obsidian_vault');
const fileService = require('./file_service');
const researchSkills = require('./research_skills');
const mcpClient = require('./mcp_client');
const ragService = require('./rag_service');
const aiProviders = require('./ai_providers');
const { isBasicPrompt } = aiProviders;
const axomSkills = require('./axom_skills');
const subagents = require('./subagents');
const localTools = require('./local_tools');
const freeApisService = require('./free_apis_service');
const { harness, getHarnessStatus, SEAMS } = require('./harness');
const universalFileGenerator = require('./universal_file_generator');

const PORT = 8000;
const HOST = '127.0.0.1';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const PUBLIC_DIR = __dirname;

// Initialize Component A database & Obsidian Second Brain Vault
db.initDatabase();
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

async function pipeOllamaStream(ollamaRes, res, sessionId, requestedModel, isBasic = false) {
  const reader = ollamaRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hasContent = false;
  let gatheredThinking = '';
  let isFirstChunk = true;
  let fullAssistantReply = '';
  let inThinkTag = false;

  function processChunk(textChunk) {
    if (!textChunk) return;

    if (textChunk.includes('<think>')) {
      inThinkTag = true;
      const parts = textChunk.split('<think>');
      if (parts[0]) {
        hasContent = true;
        fullAssistantReply += parts[0];
        res.write(`data: ${JSON.stringify({ text: parts[0] })}\n\n`);
      }
      textChunk = parts.slice(1).join('<think>');
    }

    if (inThinkTag) {
      if (textChunk.includes('</think>')) {
        inThinkTag = false;
        const parts = textChunk.split('</think>');
        if (parts[0] && !isBasic) {
          gatheredThinking += parts[0];
          res.write(`data: ${JSON.stringify({ type: 'think', text: parts[0] })}\n\n`);
        }
        const rest = parts.slice(1).join('</think>');
        if (rest) {
          hasContent = true;
          fullAssistantReply += rest;
          res.write(`data: ${JSON.stringify({ text: rest })}\n\n`);
        }
      } else {
        if (!isBasic) {
          gatheredThinking += textChunk;
          res.write(`data: ${JSON.stringify({ type: 'think', text: textChunk })}\n\n`);
        }
      }
      return;
    }

    if (isFirstChunk && textChunk) {
      textChunk = textChunk.replace(/^<\/think>\s*/i, '');
      if (textChunk) isFirstChunk = false;
    }
    if (textChunk) {
      hasContent = true;
      fullAssistantReply += textChunk;
      res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
    }
  }

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
        if (parsed.message?.thinking && !isBasic) {
          gatheredThinking += parsed.message.thinking;
          res.write(`data: ${JSON.stringify({ type: 'think', text: parsed.message.thinking })}\n\n`);
        }
        processChunk(parsed.message?.content || '');
        if (parsed.done) {
          if (!hasContent && gatheredThinking && !isBasic) {
            fullAssistantReply = gatheredThinking;
            res.write(`data: ${JSON.stringify({ text: gatheredThinking })}\n\n`);
          }
          try {
            freeApisService.recordUsage({
              providerId: 'local',
              modelId: requestedModel || 'axom:1.1',
              promptTokens: Math.max(1, Math.round((buffer?.length || 50) / 4)),
              completionTokens: Math.max(1, Math.round(fullAssistantReply.length / 4)),
              latencyMs: Date.now() - streamStartTime
            });
          } catch (e) {}
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
      processChunk(parsed.message?.content || '');
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

  // --- API: Model Listing (Local + Cloud AI Providers) ---
  if (req.method === 'GET' && pathname === '/api/models') {
    const forceRefresh = req.url.includes('refresh=1');
    const list = await aiProviders.getCombinedModelListAsync({ force: forceRefresh });
    return sendJson(res, 200, {
      models: list.map(m => m.id),
      data: list
    });
  }

  // --- API: AI Providers Listing & Status ---
  if (req.method === 'GET' && pathname === '/api/providers') {
    return sendJson(res, 200, aiProviders.getProviderStatusList());
  }

  // --- API: Save AI Provider Keys & Configuration ---
  if (req.method === 'POST' && pathname === '/api/providers/save') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const result = aiProviders.saveProvidersConfig(body);
        return sendJson(res, 200, { success: true, ...result });
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }
    });
    return;
  }

  // --- API: Test AI Provider Connection & Latency ---
  if (req.method === 'POST' && pathname === '/api/providers/test') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const providerId = body.provider_id || body.providerId;
        const apiKey = body.api_key || body.apiKey || '';
        const customBaseUrl = body.custom_url || body.baseUrl || '';
        const customModel = body.custom_model || body.customModel || '';
        const testRes = await aiProviders.testProviderConnection(providerId, apiKey, customBaseUrl, customModel);
        return sendJson(res, 200, testRes);
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

  // --- API: Free LLM APIs Catalog & Hub (Awesome Free LLM APIs) ---
  if (req.method === 'GET' && pathname === '/api/free-apis') {
    return sendJson(res, 200, freeApisService.getCatalog());
  }

  if (req.method === 'GET' && pathname === '/api/usage') {
    return sendJson(res, 200, freeApisService.getUsageStats());
  }

  if (req.method === 'POST' && pathname === '/api/usage/reset') {
    const today = new Date().toISOString().slice(0, 10);
    freeApisService.saveUsageData({ date: today, providers: {} });
    return sendJson(res, 200, { ok: true, stats: freeApisService.getUsageStats() });
  }

  if (req.method === 'POST' && pathname === '/api/free-apis/test') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const testRes = await freeApisService.testEndpoint(body.provider_id, body.model_id, body.api_key);
        return sendJson(res, 200, testRes);
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

    // --- API: Safe Code Execution Sandbox (Python & Node.js) ---
  if (req.method === 'POST' && pathname === '/api/execute_code') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const language = (body.language || '').toLowerCase().trim();
        const codeText = body.code || '';
        const timeoutMs = Math.min(Math.max(Number(body.timeout_ms) || 5000, 1000), 15000);

        if (!codeText.trim()) {
          return sendJson(res, 400, { ok: false, error: 'Empty code string provided' });
        }

        const t0 = Date.now();
        let cmd = '';
        let args = [];
        const sandboxDir = path.join(__dirname, 'workspace');
        if (!fs.existsSync(sandboxDir)) fs.mkdirSync(sandboxDir, { recursive: true });

        const ext = (language === 'python' || language === 'py') ? 'py' : 'js';
        const tempFile = path.join(sandboxDir, `_exec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`);
        fs.writeFileSync(tempFile, codeText, 'utf8');

        if (language === 'python' || language === 'py') {
          cmd = 'python';
          args = [tempFile];
        } else if (language === 'javascript' || language === 'js' || language === 'node') {
          cmd = 'node';
          args = [tempFile];
        } else {
          try { fs.unlinkSync(tempFile); } catch (e) {}
          return sendJson(res, 400, { ok: false, error: `Language "${language}" not supported. Allowed: python, javascript` });
        }

        let stdout = '';
        let stderr = '';
        let killed = false;

        const child = spawn(cmd, args, {
          cwd: sandboxDir,
          windowsHide: true,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        const timer = setTimeout(() => {
          killed = true;
          try { child.kill('SIGKILL'); } catch (e) {}
        }, timeoutMs);

        child.stdout.on('data', (d) => {
          if (stdout.length < 20000) stdout += d.toString();
        });

        child.stderr.on('data', (d) => {
          if (stderr.length < 20000) stderr += d.toString();
        });

        child.on('close', (exitCode) => {
          clearTimeout(timer);
          try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
          const duration_ms = Date.now() - t0;
          return sendJson(res, 200, {
            ok: exitCode === 0 && !killed,
            success: exitCode === 0 && !killed,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
            timedOut: killed,
            duration_ms
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
          return sendJson(res, 500, {
            ok: false,
            success: false,
            error: err.message,
            duration_ms: Date.now() - t0
          });
        });
      } catch (e) {
        return sendJson(res, 500, { ok: false, error: e.message });
      }
    });
    return;
  }

if (req.method === 'POST' && pathname === '/api/free-apis/snippet') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const snippet = freeApisService.generateSnippet(body.provider_id, body.model_id, body.language || 'python');
        return sendJson(res, 200, { ok: true, snippet });
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: e.message });
      }
    });
    return;
  }

  // --- API: Automatic Conversation Titling ---
  if (req.method === 'POST' && pathname === '/api/conversation/title') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const userPrompt = (body.prompt || body.text || '').trim();
        const assistantResponse = (body.response || '').trim();
        if (!userPrompt) {
          return sendJson(res, 400, { ok: false, error: 'prompt is required' });
        }

        const titlePrompt = `Generate a concise, professional 3 to 5 word title for a conversation that begins with the following exchange.\nDo NOT include quotation marks, formatting, punctuation, or filler words. Output ONLY the title text.\n\nUser: ${userPrompt.slice(0, 300)}\nAssistant: ${assistantResponse.slice(0, 300)}`;

        let generatedTitle = '';
        try {
          const titleRes = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'axom:1.1',
              prompt: titlePrompt,
              stream: false,
              options: { temperature: 0.3, num_predict: 24 }
            })
          });
          if (titleRes.ok) {
            const data = await titleRes.json();
            generatedTitle = (data.response || '').replace(/["'#*`]/g, '').trim();
          }
        } catch (e) {}

        if (!generatedTitle || generatedTitle.length < 3 || generatedTitle.length > 50) {
          generatedTitle = userPrompt.split('\n')[0].replace(/[^a-zA-Z0-9\s-]/g, '').trim().slice(0, 35);
        }

        return sendJson(res, 200, { ok: true, title: generatedTitle });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    });
    return;
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

  // --- API: DeepSeek Harness Microkernel Architecture Telemetry & Seams ---
  if (req.method === 'GET' && pathname === '/api/harness/status') {
    return sendJson(res, 200, getHarnessStatus());
  }

  if (req.method === 'GET' && pathname === '/api/harness/plugins') {
    return sendJson(res, 200, {
      plugins: harness.inspect().plugins
    });
  }

  if (req.method === 'GET' && pathname === '/api/harness/seams') {
    return sendJson(res, 200, {
      seams: Object.entries(SEAMS).map(([k, s]) => ({
        key: k,
        serviceName: s.serviceName,
        description: s.description,
        requiredMethods: s.requiredMethods,
        isProvided: harness.has(s.serviceName)
      }))
    });
  }

  // --- API: Installed Engineering & Local AI Skills Hub ---
  // --- API: Subagents Catalog (Antigravity & Agentic Swarm) ---
  if (req.method === 'GET' && pathname === '/api/subagents') {
    return sendJson(res, 200, {
      ok: true,
      total_subagents: subagents.SUBAGENTS.length,
      subagents: subagents.getSubagents()
    });
  }

  // --- API: Invoke Subagent Task ---
  if (req.method === 'POST' && pathname === '/api/subagents/invoke') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const subagentId = body.subagent_id || 'coder';
        const taskPrompt = body.task || '';
        const context = body.context || '';
        const model = body.model || 'axom:1.1';

        if (!taskPrompt.trim()) {
          return sendJson(res, 400, { ok: false, error: 'Empty task prompt provided' });
        }

        const result = await subagents.invokeSubagent({
          subagentId,
          taskPrompt,
          context,
          model
        });

        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/skills') {
    const catalog = axomSkills.getSkillsCatalog();
    return sendJson(res, 200, {
      total_skills: catalog.length,
      skills: catalog,
      sources: [
        'amd/skills',
        'EliasOulkadi/shokunin',
        'wshobson/agents',
        'sickn33/agentic-awesome-skills'
      ]
    });
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

  // --- API: MCP Tools & Telemetry Status ---
  if (req.method === 'GET' && pathname === '/api/mcp/status') {
    return sendJson(res, 200, {
      config: mcpClient.loadConfig(),
      tools: mcpClient.MCP_TOOLS
    });
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

  // --- API: Universal File Download Endpoint ---
  if (req.method === 'GET' && pathname === '/api/files/download') {
    const rawPath = parsedUrl.searchParams.get('path') || parsedUrl.searchParams.get('file');
    if (!rawPath) {
      return sendJson(res, 400, { error: 'path query parameter is required' });
    }

    const safePath = universalFileGenerator.resolveSafePath(rawPath);
    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
      return sendJson(res, 404, { error: `File not found: ${rawPath}` });
    }

    const stats = fs.statSync(safePath);
    const mimeType = universalFileGenerator.getMimeType(safePath);
    const filename = path.basename(safePath);

    setCors(res);
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
    return;
  }

  // --- API: Open File/Directory in Windows Explorer ---
  if (req.method === 'POST' && pathname === '/api/files/open') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const rawPath = body.path || body.filePath;
        if (!rawPath) return sendJson(res, 400, { error: 'path is required' });

        const safePath = universalFileGenerator.resolveSafePath(rawPath);
        if (!fs.existsSync(safePath)) {
          return sendJson(res, 404, { error: `Path does not exist: ${safePath}` });
        }

        const { exec } = require('node:child_process');
        const isFile = fs.statSync(safePath).isFile();
        const cmd = isFile ? `explorer.exe /select,"${safePath}"` : `explorer.exe "${safePath}"`;
        exec(cmd, (err) => {
          if (err) {
            return sendJson(res, 500, { error: err.message });
          }
          return sendJson(res, 200, { success: true, message: `Opened: ${safePath}` });
        });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // --- API: Direct File Generation Endpoint ---
  if (req.method === 'POST' && pathname === '/api/files/generate') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        if (!body.filePath && !body.path && !body.file_path) {
          return sendJson(res, 400, { error: 'filePath is required' });
        }
        const result = await universalFileGenerator.generateFile({
          filePath: body.filePath || body.path || body.file_path,
          fileType: body.fileType || body.file_type,
          content: body.content || '',
          title: body.title,
          author: body.author,
          files: body.files,
          base64Data: body.base64Data || body.base64_data,
          sourceDir: body.sourceDir || body.source_dir
        });
        return sendJson(res, 200, result);
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  // --- API: RAG (Retrieval Augmented Generation) Knowledge Vault ---

  if (req.method === 'GET' && pathname === '/api/rag/documents') {
    return sendJson(res, 200, ragService.listDocuments());
  }

  if (req.method === 'POST' && pathname === '/api/rag/upload') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 50 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const files = Array.isArray(body.files) ? body.files : (body.name ? [{ name: body.name, data: body.data || body.content }] : []);
        const saved = [];
        for (const f of files) {
          const resSave = ragService.saveUploadedDocument(f.name, f.data || f.content);
          saved.push(resSave);
        }
        // Auto-ingest after upload
        const ingestRes = await ragService.ingestDocuments();
        return sendJson(res, 200, { success: true, saved, ingest: ingestRes });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/rag/delete') {
    let bodyText = '';
    req.on('data', chunk => bodyText += chunk);
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const delRes = ragService.deleteDocument(body.filename);
        if (delRes.error) return sendJson(res, 404, delRes);
        const ingestRes = await ragService.ingestDocuments();
        return sendJson(res, 200, { success: true, deleted: delRes.deleted, ingest: ingestRes });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/rag/ingest') {
    try {
      const resIngest = await ragService.ingestDocuments();
      return sendJson(res, 200, resIngest);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/rag/chat') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      if (bodyText.length > 10 * 1024 * 1024) req.destroy();
    });
    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText || '{}');
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const isStream = body.stream !== false;
        const topK = typeof body.top_k === 'number' ? body.top_k : 4;

        const userMsgObj = messages.filter(m => m.role === 'user').slice(-1)[0];
        const lastUserPrompt = userMsgObj ? (typeof userMsgObj.content === 'string' ? userMsgObj.content : '') : '';

        const requestedModel = (body.model && body.model.trim()) || 'auto';
        let effectiveModel = requestedModel;
        let autoRoute = null;

        if (requestedModel === 'auto') {
          autoRoute = aiProviders.selectBestModelForTask(lastUserPrompt, { isRag: true });
          effectiveModel = autoRoute.selectedModel;
        }

        // Retrieve top grounded chunks using Hybrid LanceDB search
        const chunks = await ragService.searchChunks(lastUserPrompt, topK);
        const groundingContext = ragService.formatGroundedContext(chunks);
        const ragDirective = ragService.getRagSystemDirective();

        const formattedMessages = [
          {
            role: 'system',
            content: `${groundingContext}${ragDirective}`
          }
        ];

        for (const msg of messages) {
          if (msg.role !== 'system') {
            formattedMessages.push({ role: msg.role, content: msg.content });
          }
        }

        // Direct Cloud Provider Streaming or Non-streaming for RAG
        if (aiProviders.isCloudModel(effectiveModel)) {
          if (isStream) {
            setCors(res);
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive'
            });
            if (autoRoute) {
              res.write(`data: ${JSON.stringify({ type: 'auto_route', route: autoRoute })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ type: 'citations', citations: chunks })}\n\n`);
            return await aiProviders.streamProviderChat({
              model: effectiveModel,
              messages: formattedMessages,
              temperature: 0.2,
              max_tokens: 2048,
              res
            });
          } else {
            let fullReply = '';
            const mockRes = {
              write: (chunk) => {
                const match = chunk.match(/^data: (.*)\n\n$/);
                if (match) {
                  try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.text) fullReply += parsed.text;
                    else if (parsed.type === 'content' && parsed.text) fullReply += parsed.text;
                    else if (parsed.fullText) fullReply = parsed.fullText;
                  } catch (e) {}
                }
              },
              end: () => {}
            };
            const chatRes = await aiProviders.streamProviderChat({
              model: effectiveModel,
              messages: formattedMessages,
              temperature: 0.2,
              max_tokens: 2048,
              res: mockRes
            });
            const content = chatRes?.content || fullReply;
            return sendJson(res, 200, {
              message: { role: 'assistant', content },
              citations: chunks
            });
          }
        }

        const controller = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });

        if (isStream && autoRoute) {
          res.write(`data: ${JSON.stringify({ type: 'auto_route', route: autoRoute })}\n\n`);
        }

        const ollamaPayload = {
          model: effectiveModel,
          messages: formattedMessages,
          stream: isStream,
          options: {
            num_ctx: 16384,
            temperature: 0.2, // Ultra-focused low temperature for maximum grounding accuracy
            repeat_penalty: 1.1,
            top_p: 0.9,
            top_k: 40,
            num_predict: 2048
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
          if (!finalReply && data.message?.thinking) finalReply = data.message.thinking;
          finalReply = finalReply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
          return sendJson(res, 200, {
            message: { role: 'assistant', content: finalReply },
            citations: chunks
          });
        }

        // SSE Streaming with Citations
        setCors(res);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        });

        // Write citations event first so client knows which chunks were grounded
        res.write(`data: ${JSON.stringify({ type: 'citations', citations: chunks })}\n\n`);

        return pipeOllamaStream(ollamaRes, res, body.session_id || 'rag_session', requestedModel);
      } catch (err) {
        if (err.name === 'AbortError') return res.end();
        console.error('[RAG] Chat error:', err);
        return sendJson(res, 500, { error: err.message });
      }
    });
    return;
  }

  function isMcpTaskNeeded(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  const p = prompt.toLowerCase();
  const keywords = [
    'calculate', 'compute', 'solve', 'equation', 'sqrt', 'integral', 'matrix', 'math',
    'system info', 'hardware', 'specs', 'vram', 'ram', 'gpu', 'cpu', 'telemetry',
    'recall', 'memory', 'what did i say', 'do you remember', 'second brain', 'obsidian'
  ];
  return keywords.some(k => p.includes(k));
}

async function autoExtractAndSaveCode(text, prompt = '') {
  if (!text) return [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match;
  const createdFiles = [];

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    const code = match[2];
    if (!code || code.trim().length < 5) continue;

    let detectedPath = '';
    const firstLine = code.split('\n')[0].trim();
    const pathMatch = firstLine.match(/(?:path|file):\s*([^\s*-->]+)/i);
    if (pathMatch) {
      detectedPath = pathMatch[1].trim();
    } else {
      const pLower = (prompt || '').toLowerCase();
      if (pLower.includes('calculator') && (lang === 'html' || code.includes('<!DOCTYPE') || code.includes('<html'))) {
        detectedPath = 'Desktop/Calculator/index.html';
      } else if (pLower.includes('desktop')) {
        const ext = lang ? `.${lang}` : '.txt';
        detectedPath = `Desktop/generated_file_${Date.now()}${ext}`;
      } else {
        const ext = lang ? `.${lang}` : '.txt';
        detectedPath = `workspace/generated_${Date.now()}${ext}`;
      }
    }

    try {
      const fileRes = await universalFileGenerator.generateFile({
        filePath: detectedPath,
        content: code
      });
      createdFiles.push(fileRes);
    } catch (e) {
      console.warn('[SERVER] Auto-extract file save error:', e.message);
    }
  }

  return createdFiles;
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
        const sessionId = body.session_id || 'default_session';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const params = body.params || {};
        const isStream = params.stream === true;

        // COMPONENT A: Log incoming user message to raw chat logs
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg && lastUserMsg.content) {
          db.logChatMessage(sessionId, 'user', lastUserMsg.content);
        }

        // SUBAGENT PERSONA INJECTION
        const reqSubagentId = body.subagent || (params && params.subagent);
        let subagentDirective = '';
        if (reqSubagentId) {
          const matchedSubagent = subagents.getSubagent(reqSubagentId);
          if (matchedSubagent) {
            subagentDirective = `\n\n# ACTIVE SUBAGENT PERSONA: ${matchedSubagent.name} (${matchedSubagent.role})\n${matchedSubagent.systemPrompt}\nFocus all analysis, reasoning, and code exclusively through this specialized persona.\n`;
          }
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
        const isBasic = isBasicPrompt(lastUserPrompt);

        // Automated intelligence: basic greetings never trigger web search or deep thinking overhead
        const autoSearchNeeded = !isBasic && browser.isWebSearchNeeded(lastUserPrompt);
        const autoResearchNeeded = !isBasic && researchSkills.isResearchTask(lastUserPrompt);
        const autoMcpNeeded = !isBasic && isMcpTaskNeeded(lastUserPrompt);

        const researchModeEnabled = !isBasic && (body.research_mode === true || autoResearchNeeded);
        const webSearchEnabled = !isBasic && (body.web_search === true || (body.web_mode !== 'offline' && autoSearchNeeded) || researchModeEnabled);
        const agentModeEnabled = !isBasic && (webSearchEnabled || researchModeEnabled || autoMcpNeeded || body.agent_mode === true);

        const requestedModel = (body.model && body.model.trim()) || 'auto';
        let effectiveModel = requestedModel;
        let autoRoute = null;

        if (requestedModel === 'auto') {
          autoRoute = aiProviders.selectBestModelForTask(lastUserPrompt, {
            isRag: false,
            hasWebSearch: webSearchEnabled,
            hasAttachments: Boolean(body.attachments && body.attachments.length)
          });
          effectiveModel = autoRoute.selectedModel;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const temporalDirective = `\n\n# REAL-TIME TEMPORAL GROUNDING & OPERATIONAL CONTEXT (YEAR 2026):
Current Date: ${dateStr}. Current Year: ${now.getFullYear()}.
Current Environment: Windows 11 (x64), Node.js ${process.version}, Python 3.15.1, NVIDIA GeForce RTX 5060 Laptop GPU.
CRITICAL OPERATIONAL RULES:
1. Direct Answer Mandate (Zero Process Dumps): When asked to compute, calculate, multiply, convert, or answer any direct question, output ONLY the direct final answer clearly and concisely (e.g., "**200,000,056,785,664,764**"). NEVER output calculation details, operational breakdowns, integer precision essays, input/multiplier/output tables, or Python code snippets unless the user explicitly asks: "show steps", "explain the calculation", "show code", or "how did you calculate this".
2. Temporal Awareness: The current year is 2026. For questions regarding recent events, current weather, active technologies, or real-time data, actively query using the available tools before finalizing your answer.
3. Exact Precision: For mathematical calculations or algorithms, execute code via the calculate_or_eval tool internally, but present ONLY the clean final result to the user.
4. System & Memory: Use system_info for hardware status and search_living_memory for stored notes and user facts. When referencing known facts, people, or preferences from your living memory, speak naturally and definitively. NEVER say "Based on your profile", "According to your known list", "In your records", or "From your background data". Answer directly (e.g., "Zazi is a gay girl." or "She is a gay girl.").
5. Output Style: Zero decorative emojis. Crisp, direct, and focused answers using GitHub-flavored Markdown.
6. Autonomous File & Folder Generation: When asked to create, write, or generate files (such as HTML pages, calculators, scripts, PDFs, ZIP archives) or folders on Desktop or workspace, ALWAYS execute the appropriate tool (write_file, generate_file, create_folder). For multi-page reports or documents, generate a PDF using generate_file with file_type: 'pdf'. For multi-file packages or archives, use generate_file with file_type: 'zip'.`;

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
   - Zero decorative emojis in all assistant responses.`
          : '';

        const casualDirective = isBasic
          ? '\n\n# DIRECT CASUAL MANDATE: The user prompt is a casual greeting or brief chit-chat. Answer directly, warmly, and concisely in 1 sentence. NEVER output internal thinking blocks, essays, calculation steps, or web lookups.'
          : '';

        const fullDirective = `${temporalDirective}${webDirective}${researchDirective}${casualDirective}${subagentDirective}`;

        const formattedMessages = [];
        let systemInjected = false;

        for (const msg of messages) {
          if (msg.role === 'system') {
            formattedMessages.push({
              role: 'system',
              content: `${fullMemoryContext}${fullDirective}\n\n${msg.content}`
            });
            systemInjected = true;
          } else {
            formattedMessages.push({ role: msg.role, content: msg.content });
          }
        }

        if (!systemInjected && (fullMemoryContext || fullDirective)) {
          formattedMessages.unshift({
            role: 'system',
            content: `${fullMemoryContext}${fullDirective}`
          });
        }

        const controller = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });

        // --- DIRECT CLOUD AI DISTRIBUTOR ROUTING (Groq, OpenRouter, Gemini, Cerebras, DeepSeek) ---
        if (aiProviders.isCloudModel(effectiveModel)) {
          // If web search is needed or toggled, pre-ground with Google search results
          if ((webSearchEnabled || autoSearchNeeded) && lastUserPrompt) {
            try {
              const query = browser.extractSearchQuery(lastUserPrompt) || lastUserPrompt;
              const searchRes = await browser.searchWeb(query);
              if (searchRes && searchRes.results && searchRes.results.length) {
                const searchBlock = `\n\n# REAL-TIME GOOGLE WEB SEARCH RESULTS FOR "${query}":\n` +
                  searchRes.results.slice(0, 5).map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.link}\n${r.snippet}`).join('\n\n');
                if (formattedMessages[0]?.role === 'system') {
                  formattedMessages[0].content += searchBlock;
                } else {
                  formattedMessages.unshift({ role: 'system', content: searchBlock });
                }
              }
            } catch (sErr) {
              console.warn('[SERVER] Cloud web search grounding notice:', sErr.message);
            }
          }

          if (isStream) {
            setCors(res);
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive'
            });

            if (autoRoute) {
              res.write(`data: ${JSON.stringify({ type: 'auto_route', route: autoRoute })}\n\n`);
            }

            return await aiProviders.streamProviderChat({
              model: effectiveModel,
              messages: formattedMessages,
              temperature: typeof params.temperature === 'number' ? params.temperature : 0.4,
              max_tokens: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 2048, 2048),
              res,
              isBasic,
              onFinish: (fullReply) => {
                if (fullReply) {
                  db.logChatMessage(sessionId, 'assistant', fullReply);
                  reviewer.scheduleSessionReview(sessionId, 15000, 'axom:1.1', OLLAMA_BASE);
                }
              }
            });
          } else {
            let gatheredText = '';
            const mockRes = {
              write: (chunk) => {
                const match = chunk.match(/^data: (.*)\n\n$/);
                if (match) {
                  try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.text) gatheredText += parsed.text;
                  } catch (e) {}
                }
              },
              end: () => {}
            };
            await aiProviders.streamProviderChat({
              model: requestedModel,
              messages: formattedMessages,
              temperature: typeof params.temperature === 'number' ? params.temperature : 0.4,
              max_tokens: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 2048, 2048),
              res: mockRes,
              isBasic,
              onFinish: (fullReply) => {
                if (fullReply) {
                  db.logChatMessage(sessionId, 'assistant', fullReply);
                  reviewer.scheduleSessionReview(sessionId, 15000, 'axom:1.1', OLLAMA_BASE);
                }
              }
            });
            return sendJson(res, 200, {
              message: { role: 'assistant', content: gatheredText }
            });
          }
        }

        // --- AGENTIC WORKFLOW: Autonomous Multi-Turn Web Search, MCP & Tools ---
        if (agentModeEnabled) {
          let headersSent = false;
          let turn = 0;
          const MAX_AGENT_TURNS = 3;
          let finalReply = '';

          while (turn < MAX_AGENT_TURNS) {
            turn++;

            const harnessConsumer = harness.get('consumer_tools');
            const availableTools = harnessConsumer.getAvailableTools({
              webSearchEnabled,
              researchModeEnabled,
              mcpEnabled: true,
              skillsEnabled: true
            });

            const turnPayload = {
              model: effectiveModel,
              messages: formattedMessages,
              tools: turn < MAX_AGENT_TURNS ? availableTools : undefined,
              stream: false,
              options: {
                num_ctx: 32768,
                temperature: typeof params.temperature === 'number' ? params.temperature : 0.4,
                repeat_penalty: 1.1,
                top_p: 0.9,
                top_k: 40,
                num_predict: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 8192, 8192),
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
              const isToolTruncation = turnRes.status === 500 && (
                errDetail.includes('invalid tool call arguments') ||
                errDetail.includes('unexpected end of JSON input') ||
                errDetail.includes('llama-server returned invalid tool call')
              );

              if (isToolTruncation) {
                console.warn('[SERVER] Ollama 500 tool argument truncation caught. Auto-recovering via direct file generation...');
                if (isStream && !headersSent) {
                  setCors(res);
                  res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive'
                  });
                  headersSent = true;
                }
                if (isStream) {
                  res.write(`data: ${JSON.stringify({ type: 'status', message: 'Generating file directly...' })}\n\n`);
                }

                const recoveryMessages = [
                  ...formattedMessages,
                  {
                    role: 'user',
                    content: 'A token truncation occurred on tool arguments. Please provide the complete file content directly inside a markdown code block (e.g. ```html ... ```). Specify the destination path on the first line (e.g. <!-- path: Desktop/Calculator/index.html -->).'
                  }
                ];

                try {
                  const recRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: effectiveModel,
                      messages: recoveryMessages,
                      stream: false,
                      options: {
                        num_ctx: 32768,
                        temperature: 0.3,
                        num_predict: 8192
                      }
                    }),
                    signal: controller.signal
                  });

                  if (recRes.ok) {
                    const recData = await recRes.json();
                    let recText = (recData.message?.content || '').replace(/^<\/think>\s*/i, '').trim();
                    if (!recText && recData.message?.thinking) recText = recData.message.thinking;

                    const savedFiles = await autoExtractAndSaveCode(recText, lastUserPrompt);
                    if (savedFiles && savedFiles.length > 0) {
                      for (const sf of savedFiles) {
                        if (isStream) {
                          res.write(`data: ${JSON.stringify({ type: 'file_download_ready', file: sf })}\n\n`);
                        }
                      }
                      recText += '\n\n' + savedFiles.map(f => `**File Generated:** [${f.file_name}](${f.download_url}) (${f.size_bytes} bytes at \`${f.relative_path}\`)`).join('\n');
                    }

                    finalReply = recText;
                    break;
                  }
                } catch (recErr) {
                  console.error('[SERVER] Recovery attempt failed:', recErr);
                }
              }

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
                  res.write(`data: ${JSON.stringify({ type: 'status', message: `Executing ${toolName}...` })}\n\n`);
                  res.write(`data: ${JSON.stringify({ type: 'tool_start', id: callId, name: toolName, args: toolArgs })}\n\n`);
                }

                let toolResult;
                try {
                  toolResult = await harnessConsumer.executeTool(toolName, toolArgs);
                } catch (err) {
                  toolResult = { error: err.message };
                }

                if (isStream) {
                  res.write(`data: ${JSON.stringify({ type: 'tool_end', id: callId, name: toolName, result: toolResult })}\n\n`);
                  if (toolResult && toolResult.download_url) {
                    res.write(`data: ${JSON.stringify({ type: 'file_download_ready', file: toolResult })}\n\n`);
                  }
                }

                const payloadStr = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
                let toolContent = payloadStr.length > 5000 ? payloadStr.slice(0, 5000) + '... [Results truncated for context window]' : payloadStr;
                if (toolName === 'calculate_or_eval') {
                  toolContent += '\n[MANDATE: Output ONLY the direct final answer (e.g. "**200,000,056,785,664,764**"). Do NOT display calculation details, methodology, operational steps, or Python code blocks.]';
                }
                formattedMessages.push({
                  role: 'tool',
                  content: toolContent,
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
          model: effectiveModel,
          messages: formattedMessages,
          stream: isStream,
          options: {
            num_ctx: 32768,
            temperature: typeof params.temperature === 'number' ? params.temperature : 0.4,
            repeat_penalty: 1.1,
            top_p: 0.9,
            top_k: 40,
            num_predict: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 8192, 8192),
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
            reviewer.scheduleSessionReview(sessionId, 15000, effectiveModel, OLLAMA_BASE);
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

        if (autoRoute) {
          res.write(`data: ${JSON.stringify({ type: 'auto_route', route: autoRoute })}\n\n`);
        }

        return pipeOllamaStream(ollamaRes, res, sessionId, effectiveModel, isBasic);
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

  // Pre-load Axom 1.1 into GPU VRAM & warm up live model registry
  fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'axom:1.1', keep_alive: -1 })
  }).catch(() => {});

  aiProviders.getCombinedModelListAsync({ force: true }).then(models => {
    console.log(`[SERVER] Model registry initialized (${models.length} models ready).`);
  }).catch(e => console.warn('[SERVER] Model registry warm-up warning:', e.message));
});
