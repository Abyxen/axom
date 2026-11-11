import http.server
import json
import mimetypes
import os
import sys
import threading
import time
import urllib.parse
from pathlib import Path
from http import HTTPStatus

import config
from rag_engine import RAGEngine
import ingest
import tools

rag = RAGEngine()

INDEX_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Axom V2 — Local Intelligence Wrapper</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root {
  --bg: #09090b;
  --bg2: #121215;
  --surf: #18181c;
  --elev: #222228;
  --bd: #27272f;
  --tx: #f4f4f6;
  --tx2: #a1a1aa;
  --tx3: #71717a;
  --ac: #ff512f;
  --ach: #ff6e52;
  --ok: #45D483;
  --accent-glow: rgba(255, 81, 47, 0.15);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--tx);
  font: 14px/1.6 "Inter", system-ui, sans-serif;
  height: 100vh;
  display: flex;
  overflow: hidden;
}
.sidebar {
  width: 320px;
  background: var(--bg2);
  border-right: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  padding: 24px 18px 18px;
  flex-shrink: 0;
}
.brand {
  font: 36px/1 "Anton", sans-serif;
  letter-spacing: -0.5px;
  color: var(--tx);
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-pill {
  font: 10px 'JetBrains Mono', monospace;
  background: var(--accent-glow);
  color: var(--ac);
  border: 1px solid rgba(255,81,47,0.3);
  padding: 3px 6px;
  font-weight: 700;
  border-radius: 4px;
}
.subbrand {
  font: 11px 'JetBrains Mono', monospace;
  color: var(--tx3);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 6px 0 20px 0;
}
.metrics-card {
  background: var(--surf);
  border: 1px solid var(--bd);
  border-radius: 8px;
  padding: 12px;
  font: 11.5px/1.5 'JetBrains Mono', monospace;
  color: var(--tx2);
  margin-bottom: 20px;
}
.metrics-card strong { color: var(--ok); }
.sec-title {
  font: 10px 'JetBrains Mono', monospace;
  text-transform: uppercase;
  color: var(--tx3);
  letter-spacing: 1px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.docs-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}
.doc-item {
  background: var(--surf);
  border: 1px solid var(--bd);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.15s;
}
.doc-item:hover { border-color: var(--tx3); }
.doc-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 190px; }
.doc-tag { font: 9px 'JetBrains Mono', monospace; color: var(--tx3); }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--surf);
  border: 1px solid var(--bd);
  color: var(--tx);
  padding: 8px 12px;
  border-radius: 6px;
  font: 500 12px 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { background: var(--elev); border-color: var(--tx2); }
.btn.pri { background: var(--ac); border-color: var(--ac); color: #fff; font-weight: 600; }
.btn.pri:hover { background: var(--ach); }
.upload-dropzone {
  border: 1px dashed var(--bd);
  border-radius: 8px;
  padding: 14px;
  text-align: center;
  font-size: 11.5px;
  color: var(--tx3);
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.15s;
}
.upload-dropzone:hover { border-color: var(--ac); color: var(--tx); }

/* Main Area */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: relative;
}
.chat-hdr {
  height: 64px;
  padding: 0 28px;
  border-bottom: 1px solid var(--bd);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chat-title { font-size: 13.5px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.msg { max-width: 840px; display: flex; flex-direction: column; gap: 6px; }
.msg.user { align-self: flex-end; }
.msg.assistant { align-self: flex-start; }
.msg-who { font: 10.5px 'JetBrains Mono', monospace; color: var(--tx3); text-transform: uppercase; }
.msg-bubble {
  background: var(--surf);
  border: 1px solid var(--bd);
  border-radius: 8px;
  padding: 14px 18px;
  line-height: 1.65;
  font-size: 13.5px;
}
.msg.user .msg-bubble { background: #1a1a24; border-color: #2e2e42; color: #fff; }
.think-box {
  background: rgba(255,255,255,0.03);
  border: 1px solid #2e2e36;
  border-radius: 6px;
  margin-bottom: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--tx2);
}
.think-summary {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}
.think-body { padding: 10px 12px; border-top: 1px solid #2e2e36; white-space: pre-wrap; max-height: 240px; overflow-y: auto; }
.citations-box {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.citation-chip {
  background: rgba(69, 212, 131, 0.12);
  border: 1px solid rgba(69, 212, 131, 0.35);
  color: #45D483;
  font: 11px 'JetBrains Mono', monospace;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.citation-chip:hover { background: rgba(69, 212, 131, 0.25); }

/* Composer */
.composer-wrap {
  padding: 16px 28px 20px;
  border-top: 1px solid var(--bd);
  background: var(--bg);
}
.composer {
  background: var(--surf);
  border: 1px solid var(--bd);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.composer textarea {
  background: transparent;
  border: 0;
  outline: 0;
  color: var(--tx);
  font: 13.5px 'Inter', sans-serif;
  resize: none;
  min-height: 48px;
  max-height: 200px;
}
.composer-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.composer-tools span { font: 10.5px 'JetBrains Mono', monospace; color: var(--tx3); }
</style>
</head>
<body>

<aside class="sidebar">
  <div class="brand">
    <span>AXOM</span>
    <span class="brand-pill">V2</span>
  </div>
  <div class="subbrand">Local Enhancement Suite</div>

  <div class="metrics-card" id="statusCard">
    <div>Engine: <strong>Ollama (axom:1.1)</strong></div>
    <div>Context: <strong>16,384 tokens</strong></div>
    <div>Vector DB: <strong>LanceDB</strong></div>
    <div>Embedding: <strong>qwen3-embed (1024-d)</strong></div>
  </div>

  <div class="sec-title">
    <span>Knowledge Docs (<span id="docsCount">0</span>)</span>
    <button class="btn" style="padding: 2px 6px; font-size: 10px;" id="reindexBtn">Re-Index</button>
  </div>

  <div class="docs-list" id="docsList">
    <div style="color:var(--tx3); font-size:11px; padding:10px 0;">Loading documents...</div>
  </div>

  <div class="upload-dropzone" id="dropZone">
    <div>Drop documents here to index</div>
    <div style="font-size: 9.5px; opacity: 0.7; margin-top: 4px;">PDF, Markdown, TXT, Code</div>
    <input type="file" id="fileInp" style="display:none;" multiple>
  </div>
</aside>

<section class="main">
  <header class="chat-hdr">
    <div class="chat-title">
      <span>Grounded RAG & Chain-of-Thought Chat</span>
    </div>
    <button class="btn" id="clearBtn">Clear Session</button>
  </header>

  <main class="chat-area" id="chatArea">
    <div class="msg assistant">
      <div class="msg-who">Axom V2</div>
      <div class="msg-bubble">
        Axom V2 is active with an expanded 16k context window and LanceDB local document grounding. Drop documents into the sidebar to index them, or ask any technical question to begin.
      </div>
    </div>
  </main>

  <div class="composer-wrap">
    <div class="composer">
      <textarea id="promptInp" rows="2" placeholder="Ask Axom V2 with local document grounding and CoT reasoning..."></textarea>
      <div class="composer-tools">
        <span>Enter sends · Shift+Enter new line</span>
        <button class="btn pri" id="sendBtn">Send</button>
      </div>
    </div>
  </div>
</section>

<script>
const $ = s => document.querySelector(s);
let chatHistory = [];

async function loadDocs() {
  try {
    const res = await fetch('/api/docs');
    const data = await res.json();
    $('#docsCount').textContent = data.files.length;
    if (!data.files.length) {
      $('#docsList').innerHTML = '<div style="color:var(--tx3); font-size:11px; padding:10px 0;">No documents in docs/ folder.</div>';
      return;
    }
    $('#docsList').innerHTML = data.files.map(f => `
      <div class="doc-item" title="${f.path}">
        <span class="doc-name">${f.name}</span>
        <span class="doc-tag">${f.size_kb} KB</span>
      </div>
    `).join('');
  } catch(e) {
    console.error('Failed to load docs:', e);
  }
}

async function sendPrompt() {
  const inp = $('#promptInp');
  const text = inp.value.trim();
  if (!text) return;

  inp.value = '';
  appendUserMessage(text);
  chatHistory.push({ role: 'user', content: text });

  const aiMsgId = 'msg_' + Date.now();
  appendAssistantSkeleton(aiMsgId);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, history: chatHistory })
    });
    const data = await res.json();

    const bubble = document.getElementById(aiMsgId);
    if (!bubble) return;

    let fullText = data.content || '';
    chatHistory.push({ role: 'assistant', content: fullText });

    // Render citations if available
    let citationsHtml = '';
    if (data.citations && data.citations.length) {
      citationsHtml = '<div class="citations-box">' + data.citations.map(c => `
        <span class="citation-chip" title="${c.text.slice(0, 150)}...">${c.citation_tag} (${Math.round(c.score * 100)}%)</span>
      `).join('') + '</div>';
    }

    // Render <think> tags as collapsible box
    let bodyText = fullText;
    let thinkHtml = '';
    const thinkMatch = fullText.match(/<think>([\\s\\S]*?)<\\/think>/i);
    if (thinkMatch) {
      const thinkContent = thinkMatch[1].trim();
      bodyText = fullText.replace(/<think>[\\s\\S]*?<\\/think>/i, '').trim();
      thinkHtml = `
        <details class="think-box">
          <summary class="think-summary">
            <span>Step-by-Step Chain-of-Thought Reasoning</span>
            <span style="font-size:10px; opacity:0.6;">▼</span>
          </summary>
          <div class="think-body">${escapeHtml(thinkContent)}</div>
        </details>
      `;
    }

    bubble.innerHTML = thinkHtml + citationsHtml + `<div style="white-space: pre-wrap;">${escapeHtml(bodyText)}</div>`;
    $('#chatArea').scrollTop = $('#chatArea').scrollHeight;
  } catch(err) {
    const bubble = document.getElementById(aiMsgId);
    if (bubble) bubble.innerHTML = `<span style="color:#ff6b4d">Error: ${escapeHtml(err.message)}</span>`;
  }
}

function appendUserMessage(text) {
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="msg-who">You</div><div class="msg-bubble">${escapeHtml(text)}</div>`;
  $('#chatArea').appendChild(msg);
  $('#chatArea').scrollTop = $('#chatArea').scrollHeight;
}

function appendAssistantSkeleton(id) {
  const msg = document.createElement('div');
  msg.className = 'msg assistant';
  msg.innerHTML = `<div class="msg-who">Axom V2</div><div class="msg-bubble" id="${id}"><span style="color:var(--tx3)">Retrieving local knowledge & thinking...</span></div>`;
  $('#chatArea').appendChild(msg);
  $('#chatArea').scrollTop = $('#chatArea').scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
}

// Event Listeners
$('#sendBtn').onclick = sendPrompt;
$('#promptInp').onkeydown = e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
};
$('#clearBtn').onclick = () => {
  chatHistory = [];
  $('#chatArea').innerHTML = `
    <div class="msg assistant">
      <div class="msg-who">Axom V2</div>
      <div class="msg-bubble">Session cleared. Context is ready for a new inquiry.</div>
    </div>
  `;
};
$('#reindexBtn').onclick = async () => {
  $('#reindexBtn').textContent = 'Indexing...';
  try {
    await fetch('/api/ingest', { method: 'POST' });
    await loadDocs();
  } finally {
    $('#reindexBtn').textContent = 'Re-Index';
  }
};

// File Upload
$('#dropZone').onclick = () => $('#fileInp').click();
$('#fileInp').onchange = async e => {
  const files = e.target.files;
  if (!files.length) return;
  for (const f of files) {
    const formData = new FormData();
    formData.append('file', f);
    await fetch('/api/upload', { method: 'POST', body: formData });
  }
  await fetch('/api/ingest', { method: 'POST' });
  await loadDocs();
};

loadDocs();
</script>
</body>
</html>
"""

class AxomV2RequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {args[0]} - {args[1]}\n")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(INDEX_HTML.encode("utf-8"))
            return

        if path == "/api/docs":
            files = []
            for f in config.DOCS_DIR.rglob("*"):
                if f.is_file():
                    files.append({
                        "name": f.name,
                        "path": f.relative_to(config.DOCS_DIR).as_posix(),
                        "size_kb": round(f.stat().st_size / 1024, 1)
                    })
            self._send_json(HTTPStatus.OK, {"files": files})
            return

        if path == "/api/status":
            table = rag._get_table()
            chunk_count = table.count_rows() if table else 0
            self._send_json(HTTPStatus.OK, {
                "model": config.LLM_MODEL,
                "context_window": config.NUM_CTX,
                "table_name": config.TABLE_NAME,
                "indexed_chunks": chunk_count,
                "embedding_model": config.EMBEDDING_MODEL
            })
            return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not Found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", 0))

        if path == "/api/chat":
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body) if body else {}
            prompt = payload.get("prompt", "")
            history = payload.get("history", [])

            result = rag.query(prompt, chat_history=history, stream=False)
            self._send_json(HTTPStatus.OK, result)
            return

        if path == "/api/ingest":
            result = ingest.ingest_directory()
            rag._table = None # Reset table cache in rag_engine
            self._send_json(HTTPStatus.OK, result)
            return

        if path == "/api/tool":
            body = self.rfile.read(length).decode("utf-8")
            payload = json.loads(body) if body else {}
            tool_name = payload.get("tool", "")
            args = payload.get("args", {})
            out = tools.dispatch_tool(tool_name, **args)
            self._send_json(HTTPStatus.OK, {"output": out})
            return

        if path == "/api/upload":
            # Multi-part file upload parsing
            content_type = self.headers.get("Content-Type", "")
            if "boundary=" in content_type:
                boundary_str = content_type.split("boundary=")[1].strip().strip('"')
                boundary = boundary_str.encode("utf-8")
                raw_body = self.rfile.read(length)
                parts = raw_body.split(b"--" + boundary)
                for part in parts:
                    if b"Content-Disposition:" in part and b"filename=" in part:
                        lines = part.split(b"\r\n")
                        filename = "uploaded_file.txt"
                        for line in lines:
                            if b"filename=" in line:
                                str_line = line.decode("utf-8", errors="replace")
                                if 'filename="' in str_line:
                                    filename = str_line.split('filename="')[1].split('"')[0]
                        # Extract file bytes
                        header_end = part.find(b"\r\n\r\n")
                        if header_end != -1:
                            file_bytes = part[header_end + 4:].rstrip(b"\r\n")
                            save_path = config.DOCS_DIR / filename
                            with open(save_path, "wb") as f:
                                f.write(file_bytes)
                self._send_json(HTTPStatus.OK, {"status": "uploaded"})
                return

        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found"})

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

def start_server(host=config.WEB_HOST, port=config.WEB_PORT):
    server = http.server.ThreadingHTTPServer((host, port), AxomV2RequestHandler)
    print("=" * 64)
    print(f" AXOM V2 WEB INTERFACE ACTIVE")
    print(f" URL: http://{host}:{port}")
    print("=" * 64)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Axom V2 Web Server.")
        server.server_close()

if __name__ == "__main__":
    start_server()
