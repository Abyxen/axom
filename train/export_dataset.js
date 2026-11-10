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
