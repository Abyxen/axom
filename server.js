const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 8000;
const HOST = '127.0.0.1';
const OLLAMA_BASE = 'http://127.0.0.1:11434';
const PUBLIC_DIR = __dirname;

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
          ollama: 'connected'
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

  // --- API: Memories ---
  if (req.method === 'GET' && pathname === '/api/memories') {
    return sendJson(res, 200, [
      { id: '1', text: 'Created and developed by Abiral for local AI assistance' },
      { id: '2', text: 'Hardware: HP OMEN RTX 5060 Laptop GPU (8GB VRAM, 32GB RAM)' },
      { id: '3', text: 'Primary model: Axom 1.1 (Qwen 3.5 4B Uncensored)' },
      { id: '4', text: 'Training dataset: 4,364 examples (500,490 words, 27 domains)' }
    ]);
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
        let requestedModel = 'axom:1.1';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const params = body.params || {};
        const isStream = params.stream === true;

        // Fast response optimization: bypass slow reasoning monologue
        // by appending an assistant turn prefix with closed thinking tag
        const formattedMessages = [...messages];
        if (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === 'user') {
          formattedMessages.push({ role: 'assistant', content: '</think>' });
        }

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

        const controller = new AbortController();
        res.on('close', () => {
          if (!res.writableEnded) controller.abort();
        });

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
          if (data.message?.content) {
            data.message.content = data.message.content.replace(/^<\/think>\s*/i, '');
          }
          if (data.message && !data.message.content && data.message.thinking) {
            data.message.content = data.message.thinking;
          }
          return sendJson(res, 200, data);
        }

        // Server-Sent Events (SSE) Streaming
        setCors(res);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive'
        });

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasContent = false;
        let gatheredThinking = '';
        let isFirstChunk = true;

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
                res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
              }
              if (parsed.done) {
                if (!hasContent && gatheredThinking) {
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
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
            if (parsed.done && !hasContent && gatheredThinking) {
              res.write(`data: ${JSON.stringify({ text: gatheredThinking })}\n\n`);
            }
          } catch (e) {}
        }

        if (!hasContent && gatheredThinking) {
          res.write(`data: ${JSON.stringify({ text: gatheredThinking })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
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
  console.log(`=========================================`);

  // Pre-load Axom 1.1 into GPU VRAM
  fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'axom:1.1', keep_alive: -1 })
  }).catch(() => {});
});
