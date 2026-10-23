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
    try {
      const response = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) {
        return sendJson(res, 200, [
          { id: 'axomv1:4b', name: 'axomv1 4B' },
          { id: 'axom-chat', name: 'axom-chat' },
          { id: 'qwen2.5:7b', name: 'qwen2.5:7b' }
        ]);
      }
      const data = await response.json();
      const rawModels = data.models || [];
      const modelNames = rawModels.map(m => {
        let name = m.name || m.model || '';
        return name.endsWith(':latest') ? name.slice(0, -7) : name;
      }).filter(Boolean);

      // Prioritize axomv1:4b
      const uniqueNames = Array.from(new Set(modelNames));
      if (uniqueNames.includes('axomv1:4b')) {
        const idx = uniqueNames.indexOf('axomv1:4b');
        uniqueNames.splice(idx, 1);
        uniqueNames.unshift('axomv1:4b');
      } else if (uniqueNames.includes('axomv1-4b')) {
        const idx = uniqueNames.indexOf('axomv1-4b');
        uniqueNames.splice(idx, 1);
        uniqueNames.unshift('axomv1-4b');
      } else if (uniqueNames.includes('axom-chat')) {
        const idx = uniqueNames.indexOf('axom-chat');
        uniqueNames.splice(idx, 1);
        uniqueNames.unshift('axom-chat');
      }

      const modelList = uniqueNames.map(name => ({
        id: name,
        name: (name === 'axomv1:4b' || name === 'axomv1-4b') ? 'axomv1 4B' : name
      }));

      // Return object with models array and rich objects for full compatibility
      return sendJson(res, 200, { models: uniqueNames, data: modelList });
    } catch (err) {
      return sendJson(res, 200, {
        models: ['axomv1:4b', 'axom-chat', 'qwen2.5:7b'],
        data: [
          { id: 'axomv1:4b', name: 'axomv1 4B' },
          { id: 'axom-chat', name: 'axom-chat' },
          { id: 'qwen2.5:7b', name: 'qwen2.5:7b' }
        ]
      });
    }
  }

  // --- API: Training Metrics ---
  if (req.method === 'GET' && pathname === '/api/training/metrics') {
    return sendJson(res, 200, {
      step: 264,
      max_steps: 2600,
      loss: '0.7069',
      speed: '~28.5s/step (16 seq/batch)',
      eta: 'Checkpoints saved to Google Drive',
      checkpoints: ['checkpoint-250']
    });
  }

  // --- API: Memories ---
  if (req.method === 'GET' && pathname === '/api/memories') {
    return sendJson(res, 200, [
      { id: '1', text: 'Created and developed by Abiral for local AI assistance' },
      { id: '2', text: 'Hardware: HP OMEN RTX 5060 Laptop GPU (8GB VRAM, 32GB RAM)' },
      { id: '3', text: 'Primary model: axomv1 4B (Qwen 3.5 4B QLoRA fine-tuned)' }
    ]);
  }

  // --- API: Projects ---
  if (req.method === 'GET' && pathname === '/api/projects') {
    return sendJson(res, 200, [
      { id: '1', name: 'AXOM Core Engine', status: 'Active', model: 'axomv1:4b' }
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
        let requestedModel = body.model || 'axomv1:4b';
        if (requestedModel === 'axomv1 4B' || requestedModel === 'axomv1-4b') {
          requestedModel = 'axomv1:4b';
        }
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const params = body.params || {};
        const isStream = params.stream === true;

        const ollamaPayload = {
          model: requestedModel,
          messages: messages,
          stream: isStream,
          options: {
            temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
            num_predict: typeof params.max_tokens === 'number' ? params.max_tokens : 1024,
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
              const textChunk = parsed.message?.content || '';
              if (textChunk) {
                res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
              }
              if (parsed.done) {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              }
            } catch (e) {}
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            const textChunk = parsed.message?.content || '';
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          } catch (e) {}
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
});
