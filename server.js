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
        return sendJson(res, 200, { models: ['axom-chat', 'qwen2.5:7b'] });
      }
      const data = await response.json();
      const rawModels = data.models || [];
      const modelNames = rawModels.map(m => {
        let name = m.name || m.model || '';
        return name.endsWith(':latest') ? name.slice(0, -7) : name;
      }).filter(Boolean);

      // Ensure axom-chat is first if present
      const uniqueModels = Array.from(new Set(modelNames));
      if (uniqueModels.includes('axom-chat')) {
        const idx = uniqueModels.indexOf('axom-chat');
        uniqueModels.splice(idx, 1);
        uniqueModels.unshift('axom-chat');
      } else {
        uniqueModels.unshift('axom-chat');
      }

      return sendJson(res, 200, { models: uniqueModels });
    } catch (err) {
      return sendJson(res, 200, { models: ['axom-chat', 'qwen2.5:7b'] });
    }
  }

  // --- API: Chat Completion ---
  if (req.method === 'POST' && pathname === '/api/chat') {
    let bodyText = '';
    req.on('data', chunk => {
      bodyText += chunk;
      // Safeguard against oversized payloads (max 10MB)
      if (bodyText.length > 10 * 1024 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(bodyText);
        let requestedModel = body.model || 'axom-chat';
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const params = body.params || {};

        const ollamaPayload = {
          model: requestedModel,
          messages: messages,
          stream: false,
          options: {
            temperature: typeof params.temperature === 'number' ? params.temperature : 0.7,
            num_predict: typeof params.max_tokens === 'number' ? params.max_tokens : 1024,
            top_k: typeof params.top_k === 'number' ? params.top_k : 20
          }
        };

        const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ollamaPayload)
        });

        if (!ollamaRes.ok) {
          const errDetail = await ollamaRes.text().catch(() => '');
          return sendText(res, ollamaRes.status, `Ollama error (${ollamaRes.status}): ${errDetail}`);
        }

        const data = await ollamaRes.json();
        return sendJson(res, 200, data);
      } catch (err) {
        console.error('Chat error:', err);
        return sendText(res, 500, `Backend error processing chat: ${err.message}`);
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
