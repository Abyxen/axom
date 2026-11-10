const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const reviewer = require('./memory_reviewer');
const browser = require('./browser_service');

const PORT = 8000;
const HOST = '127.0.0.1';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const PUBLIC_DIR = __dirname;

// Initialize Component A database
db.initDatabase();

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

  // --- API: Settings Save ---
  if (req.method === 'POST' && pathname === '/api/settings') {
    return sendJson(res, 200, { status: 'saved' });
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
        // Query user_profile_memory for active keys and format into context block
        const profileContext = db.formatProfileContext();
        const webSearchEnabled = body.web_search === true;
        const webDirective = webSearchEnabled
          ? '\n\n# AUTONOMOUS WEB BROWSING DIRECTIVE:\nYou have real-time access to the live internet via search_web, browse_page, and open_browser tools.\nWhen answering questions about current facts, versions, releases, news, documentation, or when browsing or searching is requested, actively call the search_web or browse_page tool to retrieve live, accurate information.'
          : '';

        const formattedMessages = [];
        let systemInjected = false;

        for (const msg of messages) {
          if (msg.role === 'system') {
            formattedMessages.push({
              role: 'system',
              content: `${profileContext}${webDirective}\n\n${msg.content}`
            });
            systemInjected = true;
          } else {
            formattedMessages.push({ role: msg.role, content: msg.content });
          }
        }

        if (!systemInjected && (profileContext || webDirective)) {
          formattedMessages.unshift({
            role: 'system',
            content: `${profileContext}${webDirective}`
          });
        }

        // Fast response optimization: bypass slow reasoning monologue
        if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === 'user') {
          formattedMessages.push({ role: 'assistant', content: '</think>' });
        }

        const controller = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });

        // --- AGENTIC WORKFLOW: Autonomous Web Search & Browsing ---
        if (webSearchEnabled) {
          const toolPayload = {
            model: requestedModel,
            messages: formattedMessages,
            tools: browser.BROWSING_TOOLS,
            stream: false,
            options: {
              temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
              num_predict: Math.max(typeof params.max_tokens === 'number' ? params.max_tokens : 1024, 2048),
              top_k: typeof params.top_k === 'number' ? params.top_k : 50,
              stop: Array.isArray(params.stop) ? params.stop : []
            }
          };

          const initialRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toolPayload),
            signal: controller.signal
          });

          if (!initialRes.ok) {
            const errDetail = await initialRes.text().catch(() => '');
            return sendJson(res, initialRes.status, { error: `Ollama error (${initialRes.status}): ${errDetail}` });
          }

          const initialData = await initialRes.json();
          const toolCalls = initialData.message?.tool_calls;

          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            if (isStream) {
              setCors(res);
              res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive'
              });
            }

            // Append assistant tool request
            formattedMessages.push(initialData.message);

            for (const call of toolCalls) {
              const toolName = call.function.name;
              const toolArgs = call.function.arguments || {};
              const callId = call.id || `tool_${Date.now()}`;

              if (isStream) {
                res.write(`data: ${JSON.stringify({ type: 'tool_start', id: callId, name: toolName, args: toolArgs })}\n\n`);
              }

              let toolResult;
              try {
                toolResult = await browser.executeTool(toolName, toolArgs);
              } catch (err) {
                toolResult = { error: err.message };
              }

              if (isStream) {
                res.write(`data: ${JSON.stringify({ type: 'tool_end', id: callId, name: toolName, result: toolResult })}\n\n`);
              }

              formattedMessages.push({
                role: 'tool',
                content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                tool_call_id: call.id
              });
            }

            // Synthesis turn with tool outputs
            const synthPayload = {
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

            const synthRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(synthPayload),
              signal: controller.signal
            });

            if (!synthRes.ok) {
              const errDetail = await synthRes.text().catch(() => '');
              if (isStream) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: errDetail })}\n\n`);
                return res.end();
              }
              return sendJson(res, synthRes.status, { error: errDetail });
            }

            if (!isStream) {
              const synthData = await synthRes.json();
              let finalReply = (synthData.message?.content || '').replace(/^<\/think>\s*/i, '');
              if (synthData.message) synthData.message.content = finalReply;
              if (finalReply) {
                db.logChatMessage(sessionId, 'assistant', finalReply);
                reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
              }
              return sendJson(res, 200, synthData);
            }

            return pipeOllamaStream(synthRes, res, sessionId, requestedModel);
          } else {
            // No tools triggered: return initial response directly
            if (!isStream) {
              let finalReply = (initialData.message?.content || '').replace(/^<\/think>\s*/i, '');
              if (initialData.message) initialData.message.content = finalReply;
              if (finalReply) {
                db.logChatMessage(sessionId, 'assistant', finalReply);
                reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
              }
              return sendJson(res, 200, initialData);
            }

            setCors(res);
            res.writeHead(200, {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive'
            });

            if (initialData.message?.thinking) {
              res.write(`data: ${JSON.stringify({ type: 'think', text: initialData.message.thinking })}\n\n`);
            }
            let text = (initialData.message?.content || '').replace(/^<\/think>\s*/i, '');
            if (!text && initialData.message?.thinking) text = initialData.message.thinking;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();

            if (text) {
              db.logChatMessage(sessionId, 'assistant', text);
              reviewer.scheduleSessionReview(sessionId, 15000, requestedModel, OLLAMA_BASE);
            }
            return;
          }
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
