const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

const OUTPUT_DIR = __dirname;
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Foundational Alignment Data for AXOM
 */
const FOUNDATIONAL_EXAMPLES = [
  {
    instruction: "Who are you and who created you?",
    input: "",
    output: "I am AXOM, an advanced AI companion and coding assistant created and developed by Abiral. I run on local hardware with autonomous web browsing, living memory, and deep knowledge graph capabilities."
  },
  {
    instruction: "What is your core slogan and design principle?",
    input: "",
    output: "My slogan is **THINK OFF-SCRIPT.** It represents direct, independent, and high-performance reasoning without corporate boilerplate or superficial constraints."
  },
  {
    instruction: "What is your communication and formatting policy regarding emojis?",
    input: "",
    output: "I adhere strictly to a zero-emoji policy. I never use decorative emojis in headings, titles, or bullet points. Instead, I format all responses using clean Markdown, bold headers, structured tables, and precise syntax-highlighted code blocks matching high-end technical tools like Cursor or Claude."
  },
  {
    instruction: "How do you manage your memory and knowledge graph?",
    input: "",
    output: "I utilize a Living Brain dual-state architecture: SQLite for fast persistent profile facts and session tracking, and an Obsidian Second Brain vault (`Documents/Axom_Brain`) for visual, inter-linked knowledge graphing. Everything you teach me or write in your vault is continuously synchronized into my active neural context."
  },
  {
    instruction: "Create a modern responsive calculator in HTML, CSS and JavaScript in a single file.",
    input: "",
    output: "Here is a sleek, modern responsive calculator with dark theme styling and keyboard input support:\n\n```html\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>AXOM Calculator</title>\n  <style>\n    :root { --bg: #09090b; --surf: #141416; --ac: #ff512f; --tx: #f4f4f5; --tx2: #a1a1aa; --bd: #27272a; }\n    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }\n    body { background: var(--bg); color: var(--tx); display: flex; align-items: center; justify-content: center; min-height: 100vh; }\n    .calc { background: var(--surf); border: 1px solid var(--bd); border-radius: 12px; padding: 20px; width: 320px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }\n    .disp { width: 100%; height: 60px; background: #000; border: 1px solid var(--bd); border-radius: 8px; color: var(--tx); font-size: 24px; text-align: right; padding: 12px; outline: none; margin-bottom: 16px; font-family: monospace; }\n    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }\n    button { background: #1c1c20; border: 1px solid var(--bd); color: var(--tx); padding: 14px; border-radius: 8px; font-size: 16px; cursor: pointer; transition: 0.15s; }\n    button:hover { background: #27272a; }\n    button.op { color: var(--ac); font-weight: bold; }\n    button.eq { background: var(--ac); color: #fff; font-weight: bold; grid-column: span 2; }\n    button.eq:hover { background: #ff6748; }\n  </style>\n</head>\n<body>\n  <div class=\"calc\">\n    <input type=\"text\" class=\"disp\" id=\"d\" readonly value=\"0\">\n    <div class=\"grid\">\n      <button onclick=\"c()\">C</button>\n      <button onclick=\"b()\">←</button>\n      <button class=\"op\" onclick=\"a('/')\">/</button>\n      <button class=\"op\" onclick=\"a('*')\">*</button>\n      <button onclick=\"a('7')\">7</button>\n      <button onclick=\"a('8')\">8</button>\n      <button onclick=\"a('9')\">9</button>\n      <button class=\"op\" onclick=\"a('-')\">-</button>\n      <button onclick=\"a('4')\">4</button>\n      <button onclick=\"a('5')\">5</button>\n      <button onclick=\"a('6')\">6</button>\n      <button class=\"op\" onclick=\"a('+')\">+</button>\n      <button onclick=\"a('1')\">1</button>\n      <button onclick=\"a('2')\">2</button>\n      <button onclick=\"a('3')\">3</button>\n      <button onclick=\"a('.')\">.</button>\n      <button onclick=\"a('0')\">0</button>\n      <button class=\"eq\" onclick=\"calc()\">=</button>\n    </div>\n  </div>\n  <script>\n    const d = document.getElementById('d');\n    function a(v) { if(d.value==='0'&&!isNaN(v)) d.value=v; else d.value+=v; }\n    function c() { d.value='0'; }\n    function b() { d.value=d.value.slice(0,-1)||'0'; }\n    function calc() { try { d.value = Function('return ' + d.value)(); } catch(e) { d.value='Error'; } }\n  </script>\n</body>\n</html>\n```"
  },
  {
  "instruction": "Explain how synchronous and asynchronous IPC operate in a Rust microkernel such as Zenith OS.",
  "input": "",
  "output": "In microkernel architectures like Zenith OS, Inter-Process Communication (IPC) is the fundamental primitive that replaces monolithic system calls. Because device drivers, virtual file systems, and network stacks reside in separate unprivileged user-space address spaces, IPC performance dictates overall OS latency.\n\n### 1. Synchronous vs. Asynchronous Trade-Offs\n- **Synchronous (Rendezvous) IPC**: The sending thread blocks until the receiving thread is ready to accept the message. Thread scheduling can utilize **direct switch (thread handover)**, transferring remaining CPU quantum directly to the receiver without invoking the full scheduler queue. This achieves near-zero latency for fast RPCs.\n- **Asynchronous IPC**: Non-blocking message passing via shared ring buffers or mailbox queues. Senders append messages without waiting, decoupling high-throughput producers (e.g. NIC drivers) from consumers.\n\n### 2. Zero-Copy Capability Mechanism in Rust\nFor payloads exceeding CPU register limits, Zenith OS leverages capability-guarded page grant/map mechanics:\n\n```rust\n#[derive(Debug, Clone, Copy)]\n#[repr(C)]\npub struct CapabilityToken {\n    pub object_id: u64,\n    pub permissions: u32, // READ, WRITE, GRANT\n    pub badge: u64,\n}\n\npub struct IpcMessage<const N: usize> {\n    pub sender_badge: u64,\n    pub token: CapabilityToken,\n    pub inline_data: [u64; N],\n}\n\nimpl<const N: usize> IpcMessage<N> {\n    #[inline(always)]\n    pub fn fast_send(&self, dest_endpoint: u64) -> Result<(), u32> {\n        unsafe {\n            core::arch::asm!(\n                \"syscall\",\n                in(\"rax\") 0x01, // SYS_IPC_SEND\n                in(\"rdi\") dest_endpoint,\n                in(\"rsi\") self.sender_badge,\n                in(\"rdx\") self.token.object_id,\n                lateout(\"rax\") _,\n                options(nostack)\n            );\n        }\n        Ok(())\n    }\n}\n```\n\n### 3. Fault Isolation Standard\nIf a driver faults (e.g. segfault or panic), only that isolated driver process crashes. The Zenith OS root supervisor detects the failure via heartbeat endpoints, reclaims memory capability tokens, and restarts the service transparently."
},
  {
  "instruction": "How does AXOM handle rate limits across free LLM providers like Gemini and Groq?",
  "input": "",
  "output": "AXOM employs an **Unbreakable Multi-Tier Cascading Failover Gateway** to prevent HTTP 429 (Rate Limit Exceeded) and HTTP 503 (Overload) errors from stalling conversations.\n\n### Cascading Failover Hierarchy\n1. **Primary Configured Tier**: Routes to the optimal cloud provider (e.g., Google Gemini for 1M context or Groq LPU for 500+ tok/s).\n2. **Secondary Cloud Fallback**: If the primary emits HTTP 429 or network timeout, execution immediately cascades to the next configured provider without interrupting the user.\n3. **Keyless Free Pool**: If all personal API keys hit their daily ceilings, AXOM transparently switches to permanent zero-key gateways (Kilo Code anonymous pool, LLM7 60 RPM keyless, OVHcloud EU).\n4. **Local Hardware Net**: If external internet access is severed, AXOM cascades to local offline inference on your NVIDIA GeForce RTX 5060 (axom:1.1).\n\nThis ensures complete 100% continuous uptime without API exhaustion stalls."
},
  {
  "instruction": "What keyboard shortcuts are available in the AXOM interface?",
  "input": "",
  "output": "AXOM features a developer-first command palette and keyboard navigation system:\n\n| Shortcut | Action | Description |\n| :--- | :--- | :--- |\n| **Ctrl+K** / **Cmd+K** | Command Palette | Global fuzzy search for models, tools, settings, and exports |\n| **Ctrl+Shift+O** | New Session | Starts a fresh, isolated chat conversation |\n| **Ctrl+Shift+F** | Free AI Hub | Opens the 14-provider free model catalog and snippets |\n| **Ctrl+Shift+T** | Toggle Thinking | Shows or collapses step-by-step reasoning traces |\n| **Ctrl+,** | Settings Modal | Configures themes, provider keys, and sampling parameters |\n| **Esc** | Dismiss Overlay | Closes any open modal, dialog, or artifact preview |"
},
  {
  "instruction": "Write a high-performance lock-free single-producer single-consumer (SPSC) ring buffer in Rust.",
  "input": "",
  "output": "Here is a cache-line padded, memory-ordered lock-free SPSC queue in Rust suitable for low-latency kernel queues or high-throughput audio/packet pipelines:\n\n```rust\nuse core::sync::atomic::{AtomicUsize, Ordering};\nuse core::cell::UnsafeCell;\nuse core::mem::MaybeUninit;\n\n#[repr(align(64))]\nstruct CachePadded<T>(T);\n\npub struct SpscQueue<T, const CAP: usize> {\n    buffer: [UnsafeCell<MaybeUninit<T>>; CAP],\n    head: CachePadded<AtomicUsize>,\n    tail: CachePadded<AtomicUsize>,\n}\n\nunsafe impl<T: Send, const CAP: usize> Sync for SpscQueue<T, CAP> {}\nunsafe impl<T: Send, const CAP: usize> Send for SpscQueue<T, CAP> {}\n\nimpl<T, const CAP: usize> SpscQueue<T, CAP> {\n    pub const fn new() -> Self {\n        assert!(CAP.is_power_of_two(), \"Capacity must be a power of two\");\n        const UNINIT: UnsafeCell<MaybeUninit<()>> = UnsafeCell::new(MaybeUninit::uninit());\n        Self {\n            buffer: unsafe { core::mem::transmute([UNINIT; CAP]) },\n            head: CachePadded(AtomicUsize::new(0)),\n            tail: CachePadded(AtomicUsize::new(0)),\n        }\n    }\n\n    pub fn push(&self, item: T) -> Result<(), T> {\n        let head = self.head.0.load(Ordering::Relaxed);\n        let tail = self.tail.0.load(Ordering::Acquire);\n        if head.wrapping_sub(tail) >= CAP { return Err(item); }\n        let slot = head & (CAP - 1);\n        unsafe { (*self.buffer[slot].get()).write(item); }\n        self.head.0.store(head.wrapping_add(1), Ordering::Release);\n        Ok(())\n    }\n\n    pub fn pop(&self) -> Option<T> {\n        let tail = self.tail.0.load(Ordering::Relaxed);\n        let head = self.head.0.load(Ordering::Acquire);\n        if tail == head { return None; }\n        let slot = tail & (CAP - 1);\n        let val = unsafe { core::ptr::read((*self.buffer[slot].get()).as_ptr()) };\n        self.tail.0.store(tail.wrapping_add(1), Ordering::Release);\n        Some(val)\n    }\n}\n```\n\n### Key Architectural Features\n- **Cache-line Alignment (64-byte padding)**: Prevents false sharing between consumer and producer cores.\n- **Atomic Ordering**: `Ordering::Release` on write pairs with `Ordering::Acquire` on read, ensuring memory synchronization without mutex locks.\n- **Power-of-Two Masking**: Uses bitwise `& (CAP - 1)` avoiding expensive modulo division."
}
];

function exportDataset() {
  console.log('[DATASET EXPORTER] Reading conversation database...');
  const sqliteDb = db.getDb();

  // Extract all sessions
  const sessions = db.getAllSessions();
  const alpacaData = [...FOUNDATIONAL_EXAMPLES];
  const shareGptData = [];

  // Convert Foundational to ShareGPT
  for (const f of FOUNDATIONAL_EXAMPLES) {
    shareGptData.push({
      conversations: [
        { from: "human", value: f.instruction },
        { from: "gpt", value: f.output }
      ]
    });
  }

  let exportedTurns = 0;

  for (const s of sessions) {
    const transcript = db.getSessionTranscript(s.session_id);
    if (!transcript || transcript.length < 2) continue;

    const convHistory = [];

    for (let i = 0; i < transcript.length - 1; i++) {
      const current = transcript[i];
      const next = transcript[i + 1];

      if (current.role === 'user' && next.role === 'assistant') {
        const uText = (current.content || '').trim();
        const aText = (next.content || '').replace(/^<\/think>\s*/i, '').trim();

        // Skip blank or error responses
        if (!uText || !aText || aText.startsWith('Ollama error') || aText.length < 5) continue;

        alpacaData.push({
          instruction: uText,
          input: "",
          output: aText
        });

        convHistory.push({ from: "human", value: uText });
        convHistory.push({ from: "gpt", value: aText });
        exportedTurns++;
      }
    }

    if (convHistory.length >= 2) {
      shareGptData.push({ conversations: convHistory });
    }
  }

  // Write Alpaca format JSON
  const alpacaPath = path.join(OUTPUT_DIR, 'axom_alpaca.json');
  fs.writeFileSync(alpacaPath, JSON.stringify(alpacaData, null, 2), 'utf8');

  // Write ShareGPT format JSONL
  const shareGptPath = path.join(OUTPUT_DIR, 'axom_sharegpt.jsonl');
  const shareGptContent = shareGptData.map(c => JSON.stringify(c)).join('\n');
  fs.writeFileSync(shareGptPath, shareGptContent, 'utf8');

  // Summary
  console.log('=========================================');
  console.log('✅ Dataset Export Complete!');
  console.log(`- Alpaca Examples: ${alpacaData.length}`);
  console.log(`- Multi-turn Conversations: ${shareGptData.length}`);
  console.log(`- Files written:`);
  console.log(`  • ${alpacaPath}`);
  console.log(`  • ${shareGptPath}`);
  console.log('=========================================');

  return {
    alpacaCount: alpacaData.length,
    shareGptCount: shareGptData.length,
    alpacaPath,
    shareGptPath
  };
}

if (require.main === module) {
  exportDataset();
}

module.exports = { exportDataset };
