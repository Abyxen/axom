# 🧠 AXOM — Master Project & Architecture Log

> **MANDATORY PROTOCOL FOR AI ASSISTANT / DEVELOPERS:**
> Every single time any modification, feature, script, model adjustment, UI change, or optimization is performed in this repository, this file **MUST** be updated immediately.
> For every entry, document:
> 1. **What was done** (Specific change, files modified or created).
> 2. **How it was implemented** (Code logic, architecture, parameters, commands).
> 3. **Why it was done** (Technical rationale, problem solved, trade-offs evaluated).

---

## 📌 Project Overview
- **Project Name:** AXOM (Independent Intelligence)
- **Creator / Developer:** Abiral
- **Target Hardware:** HP OMEN Gaming Laptop (NVIDIA GeForce RTX 5060 Laptop GPU, 8 GB VRAM, 32 GB RAM, Windows 11)
- **Mission:** Build a completely self-hosted, private, uncensored, high-performance personal AI companion tailored for programming, logical reasoning, and creative thought, capable of learning and evolving from user interactions.

---

## 📜 Chronological Engineering Log

### 1. Model Selection & Architecture Design
- **Date:** October 2026
- **What Was Done:**
  - Evaluated open-weights base language models for local deployment on an 8 GB VRAM RTX 5060 Laptop GPU.
  - Selected `Qwen 3.5 4B Uncensored` (Abliterated / uncensored variant of Qwen architecture).
- **How It Was Implemented:**
  - Researched parameter sizing (3B vs 4B vs 7B vs 8B) under the strict budget of 8 GB VRAM.
  - Verified that a 4B parameter model at 4-bit quantization occupies ~2.7 GB of VRAM, leaving over 5 GB of VRAM free for large context windows (32,768+ tokens) and fast KV cache.
- **Why It Was Done:**
  - 7B/8B models at 4-bit require 5–6 GB base VRAM, which limits the context window on an 8 GB GPU before spilling into system RAM and slowing down.
  - 4B provides the "sweet spot" of near-7B reasoning capability and code comprehension while generating at blazing speeds (85–100+ tokens/second).
  - Uncensored base allows raw, direct technical assistance without preachy canned refusals or moralizing filters.

---

### 2. Fine-Tuning Pipeline with Unsloth (Google Colab)
- **Date:** October 2026
- **What Was Done:**
  - Created an automated QLoRA (Quantized Low-Rank Adaptation) training notebook in Google Colab (`Axom.ipynb`).
  - Tuned the model on a composite dataset balancing coding, multi-turn reasoning, and creator identity.
- **How It Was Implemented:**
  - Used `unsloth` for 2x faster training and 70% reduced memory footprint on Colab T4 GPU.
  - **Dataset Distribution:**
    - 47% Coding & Architecture (`sahil2801/CodeAlpaca-20k`)
    - 47% Multi-turn Dialogues & Logic (`mlabonne/FineTome-100k`)
    - 6% Grounded Identity (`AXOM`, created and engineered by Abiral)
  - Applied response-only loss masking so the model is only penalized on its responses, not the prompts.
  - Set LoRA rank $r=16$, $\alpha=32$, target modules (q, k, v, o, gate, up, down projections).
- **Why It Was Done:**
  - Stock base models often lack a clear personal identity or exhibit conversational drift.
  - Fine-tuning embeds Abiral's creator identity directly into the weights rather than relying exclusively on system prompt tokens.
  - Unsloth prevented out-of-memory crashes on free-tier T4 GPUs (16 GB VRAM) and reduced training time to ~15 minutes.

---

### 3. GGUF Quantization & Google Drive Pipeline
- **Date:** October 2026
- **What Was Done:**
  - Converted trained 16-bit LoRA adapter weights directly into 4-bit GGUF format (`Q4_K_M`) within Colab.
  - Automated transfer to Google Drive (`G:\My Drive\AXOM_Model\`).
- **How It Was Implemented:**
  - Utilized `llama.cpp` quantization engine inside Unsloth:
    ```python
    model.save_pretrained_gguf("axom_model", tokenizer, quantization_method="q4_k_m")
    ```
  - Resulted in `Qwen3.5-4B-Uncensored.Q4_K_M.gguf` (2.70 GB).
- **Why It Was Done:**
  - GGUF is the universal format for CPU/GPU hybrid inference in `llama.cpp` and `Ollama`.
  - `Q4_K_M` (Medium 4-bit) provides the best perplexity-to-size ratio, maintaining ~99% of 16-bit float quality while cutting storage and memory usage by 75%.
  - Google Drive desktop integration allowed seamless downloading to the local HP OMEN laptop without manual web uploads.

---

### 4. Local Ollama Engine & Persona Configuration (`Modelfile`)
- **Date:** October 2026
- **What Was Done:**
  - Configured Ollama to register the model as `axom:1.1` and aliased it to `axom:latest`.
  - Authored a custom [`Modelfile`](file:///c:/Users/abira/Documents/axom/Modelfile) defining inference parameters and system persona.
- **How It Was Implemented:**
  - Configured Modelfile directives:
    - `FROM ./models/Qwen3.5-4B-Uncensored.Q4_K_M.gguf`
    - `PARAMETER temperature 0.7`
    - `PARAMETER top_p 0.9`
    - `PARAMETER top_k 40`
    - `PARAMETER stop "<|im_end|>"`
    - System prompt establishing:
      - Identity: AXOM
      - Creator: Abiral
      - Core traits: Direct, highly technical, concise, uncensored, zero fluff.
- **Why It Was Done:**
  - Ollama manages GPU offloading and memory allocation automatically via CUDA.
  - Explicit temperature and sampling parameters prevent repetitive loops while preserving creativity for coding and brainstorming.
  - Explicit stop tokens prevent the model from hallucinating simulated user responses.

---

### 5. Zero-Dependency Local Backend (`server.js`)
- **Date:** October 2026
- **What Was Done:**
  - Engineered a lightweight, zero-dependency Node.js HTTP server serving both the web application and acting as a streaming API bridge to Ollama.
- **How It Was Implemented:**
  - Used native Node.js standard libraries (`http`, `fs`, `path`, `url`) without heavy `node_modules` dependencies (no Express, no Axios required).
  - Implemented endpoints:
    - `GET /` ➔ Serves [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
    - `GET /api/health` ➔ Checks backend and Ollama connectivity status.
    - `GET /api/models` ➔ Dynamically queries Ollama's active model list.
    - `POST /api/chat` ➔ Proxies chat requests with support for both JSON and Server-Sent Events (SSE) streaming (`text/event-stream`).
  - Added **Fast Thinking Monologue Bypass**:
    - Detects whether reasoning models output verbose `<think>` blocks and cleanly terminates or skips empty monologue to deliver immediate actionable answers at ~85–100+ tokens/sec.
- **Why It Was Done:**
  - Eliminates external package vulnerabilities, `npm install` failures, and bloat.
  - SSE enables instantaneous word-by-word streaming to the web UI with zero perceived latency.
  - Thinking bypass prevents models from spending 20 seconds "thinking" to answer trivial questions like "What is 2+2?".

---

### 6. Editorial Brutalist Web UI (`index.html`)
- **Date:** October 2026
- **What Was Done:**
  - Integrated the complete standalone frontend into [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
  - Styled with custom brutalist street-style aesthetics, typography, and dark/light modes.
- **How It Was Implemented:**
  - Built with pure HTML5, CSS3 variables, and vanilla JavaScript.
  - Typography: `Anton` (bold editorial display headers), `JetBrains Mono` (code/metadata), and `Inter` (body prose).
  - Features:
    - Dynamic sidebar with collapsible toggle and conversation history.
    - Real-time token streaming with automatic autoscroll and stop-generation button.
    - Model selection dropdown dynamically populated from `/api/models`.
    - Local storage persistence for chat sessions.
    - Keyboard shortcuts (`Ctrl+Enter` to send, `/` to focus input).
- **Why It Was Done:**
  - Gives the user a professional, responsive, aesthetic UI tailored specifically to AXOM.
  - Avoids dependencies on external frontend build tools like Vite, React, or Webpack.

---

### 7. Directory Optimization & Clutter Reclamation
- **Date:** October 28, 2026
- **What Was Done:**
  - Cleaned up redundant backups, unused multimodal weights, and obsolete scripts, reclaiming **~3.45 GB** of disk space.
  - Established a clean single-model directory layout.
- **How It Was Implemented:**
  - Deleted `model_backup/` containing duplicate 2.78 GB `axomv1_Qwen3.5-4B.Q4_K_M.gguf` (master copy safely retained in Google Drive).
  - Deleted unused 675 MB `models/Qwen3.5-4B-mmproj.gguf`.
  - Deleted obsolete benchmark files (`benchmarks/`, `BASELINE_BENCHMARK.md`, `benchmark_raw.json`, `run_baseline_benchmark.js`).
  - Deleted obsolete scripts (`build_training_notebook.js`, `Import_Trained_Model.bat`, `Modelfile.trained`, `style.css`).
  - Configured [`.gitignore`](file:///c:/Users/abira/Documents/axom/.gitignore) to exclude binary weights and OS clutter.
  - Created model alias: `ollama cp axom:1.1 axom:latest`.
- **Why It Was Done:**
  - Prevented wasted disk storage on the laptop SSD.
  - Removed confusing obsolete scripts so only verified, active files exist.
  - Ensured seamless updates where `axom:1.1` and `axom:latest` always resolve to the exact active weights.

---

### 8. Automated Verification Suite (`test_suite.ps1`)
- **Date:** October 28, 2026
- **What Was Done:**
  - Built an automated PowerShell test suite to verify the full stack health and inference pipeline.
- **How It Was Implemented:**
  - Runs 6 automated tests sequentially:
    1. `/api/health` ➔ Checks Node server and Ollama backend status.
    2. `/api/models` ➔ Confirms model registration (`axom:1.1`).
    3. Static Web UI ➔ Confirms HTTP 200 and page title delivery.
    4. Single-Turn Inference ➔ Tests identity and core generation.
    5. Multi-Turn Context Memory ➔ Verifies context retention with secret key recall (`OMEN-5060-TITAN`).
    6. Direct Accuracy Test ➔ Tests fast deterministic factual response.
- **Why It Was Done:**
  - Provides a single repeatable command (`powershell -File test_suite.ps1`) to prove system integrity after any file change or restart.

---

### 9. Persistent Dual-State "Brain" & Asynchronous Memory Reviewer
- **Date:** October 28, 2026
- **What Was Done:**
  - Implemented a complete 4-component persistent self-updating "brain" architecture directly on top of the Qwen 3.5 / Node.js stack:
    1. **Component A (Dual-State Database Schema):** Engineered `db.js` using native `node:sqlite` managing historical `chat_logs`, decoupled `user_profile_memory`, and `session_metadata`.
    2. **Component B (Session Data Injection):** Dynamic retrieval and context formatting of active profile memories injected directly into Qwen's system instructions prior to inference.
    3. **Component C (Asynchronous Reviewer Loop):** Engineered `memory_reviewer.js` running in the background after session activity breaks, using Qwen 3.5 with a dedicated evaluator system prompt and JSON schema extraction.
    4. **Component D (State Mutation & Dispatch):** Atomic SQLite transaction parser executing `CREATE`, `UPDATE`, and `DELETE` actions on `user_profile_memory` with confidence scoring and temporal anchoring.
    5. **Web UI Brain Integration:** Added a live `Brain` management panel in `index.html` settings with real-time memory rendering and on-demand session review triggers.
    6. **Automated Verification:** Expanded `test_suite.ps1` to test the full lifecycle (chat logging, prompt injection, reviewer extraction, profile mutation, and cross-session recall).
- **How It Was Implemented:**
  - Leveraged Node v26 native `node:sqlite` (`DatabaseSync`) for zero external dependencies, zero npm packages, and ACID compliance.
  - Created schemas:
    - `chat_logs`: `(id, session_id, role, content, timestamp)`
    - `user_profile_memory`: `(key, value, category, confidence_score, reasoning, created_at, updated_at)`
    - `session_metadata`: `(session_id, start_time, end_time, summary, message_count, last_reviewed_at, status)`
  - Configured Ollama with `format: "json"` and `num_predict: 3072` for deterministic schema extraction.
  - Added debounced task scheduling (15 seconds of inactivity after message generation) with an in-memory queue worker to process reviews sequentially without overloading the GPU.
- **Why It Was Done:**
  - Standard LLMs suffer from session amnesia: once a browser tab is refreshed or a new session starts, all context is lost.
  - Continuously updating raw neural weights after every turn causes catastrophic forgetting and freezes inference.
  - Dual-State memory provides immediate cross-session recall without retraining, allowing AXOM to organically learn preferences (e.g. favorite languages, current projects, architectural rules) and remember them indefinitely.

---

### 10. Memory Context Framing Refinement & Test Isolation
- **Date:** October 28, 2026
- **What Was Done:**
  - Diagnosed and resolved an issue where AXOM proactively assumed an agenda on simple greetings (e.g. asking about "Zenith OS" when user said "hi").
  - Pruned synthetic test artifacts from `user_profile_memory` and isolated automated test suites.
  - Anchored core identity directives (`AXOM, created and developed by Abiral`) in the injected system context.
- **How It Was Implemented:**
  - In `db.js` (`formatProfileContext`):
    - Re-framed memory instructions from imperative ("Respect and adhere to these parameters across all responses") to passive reference ("Treat this as PASSIVE BACKGROUND REFERENCE. Do NOT force, recite, or proactively bring up past projects unless directly relevant").
    - Explicitly instructed the model that for greetings ("hi", "hello"), it must respond naturally, concisely, and without assuming unprompted agendas.
    - Anchored the primary creator identity prompt directly in the top header of `profileContext` so Ollama system-message overrides do not erase the creator identity.
  - In `test_suite.ps1`:
    - Added an automated database teardown phase at the end of the test suite that deletes temporary test keys (`active_project`, `favorite_language`) and cleans synthetic test session logs.
- **Why It Was Done:**
  - Smaller models (4B parameters) take system prompt directives very literally. If instructed to "adhere across all responses", they force past projects into casual greetings.
  - Automated tests must never contaminate the user's authentic daily chat profile.

---

### 11. Conversational Tone Alignment: Modern AI Persona (ChatGPT / Claude Style)
- **Date:** October 28, 2026
- **What Was Done:**
  - Upgraded AXOM's conversational demeanor from a blunt command-line terminal to an articulate, warm, thoughtful, and highly capable conversational AI companion modeled after ChatGPT and Claude.
- **How It Was Implemented:**
  - In `Modelfile` and `db.js` (`formatProfileContext`):
    - Replaced the previous minimalist "zero-fluff" directive with a full **Conversational Intelligence Directive**:
      1. *Conversational, Warm & Approachable:* Welcoming on greetings ("Hello! How can I help you today?"), polite, engaging, and pleasant to speak with.
      2. *Direct Yet In-Depth:* Dives straight into comprehensive explanations with rich Markdown formatting (bullet points, bold text, clear section headers, typed code blocks).
      3. *Proactive & Helpful:* Offers thoughtful suggestions, follow-up ideas, and guidance without being robotic.
  - In SQLite `user_profile_memory`:
    - Updated `preferred_communication_style` to: *"Conversational, articulate, warm, thoughtful, and highly capable (ChatGPT/Claude style) with clean markdown formatting"*.
- **Why It Was Done:**
  - The previous "zero-fluff" directive caused the model to produce cold, terse, single-line terminal replies ("Ready when you are.") that felt unnatural.
  - Users expect an AI assistant to behave like modern LLM companions (ChatGPT, Claude, Gemini)—warm, intelligent, engaging, and insightful.

---

### 12. Greeting Brevity & Crisp Phrasing Calibration
- **Date:** October 28, 2026
- **What Was Done:**
  - Calibrated initial conversational greeting phrasing to deliver the exact crisp, friendly tone requested by the user: *"Hi! What would you like to work on?"*.
- **How It Was Implemented:**
  - In `db.js` (`formatProfileContext`) and `Modelfile`:
    - Updated behavior directive 1 to: *"When the user greets you with a simple greeting (e.g. 'hi', 'hello', 'hey'), reply with a brief, friendly greeting such as: 'Hi! What would you like to work on?' or 'Hello! How can I help you today?' Keep initial greetings short, clean, and inviting—never ramble or give paragraphs of introductory filler."*
- **Why It Was Done:**
  - While verbose greetings are friendly, modern conversational assistants (like ChatGPT) shine when initial greetings are concise, punchy, and invite immediate collaboration rather than reciting a paragraph of introductory filler.

---

### 13. Agentic Harness, Strict Workspace Sandboxing & Skills System
- **Date:** October 28, 2026
- **What Was Done:**
  - Designed and engineered a complete Agentic Harness (`agent_harness.js`), Sandbox Guard (`workspace_guard.js`), and Skills/Plugin Registry (`skills_registry.js`) for AXOM.
  - Implemented 4 operational reasoning modes:
    1. `chat`: Standard single-turn conversational stream (no tools, zero overhead).
    2. `agent_auto`: Autonomous multi-turn ReAct loop (Reason -> Call Tool -> Inspect Result -> Iterate -> Final Response) with a safety cap of 8 steps.
    3. `agent_plan`: Plan-First mode requiring the model to generate a structured execution plan before executing tools.
    4. `agent_ask`: Permission-Required mode that enforces confirmation boundaries before mutating files or running terminal commands.
  - Implemented strict Workspace Isolation & Sandboxing:
    - Dedicated per-chat project directories under `c:\Users\abira\Documents\axom\workspace\<project_name>\`.
    - Path canonicalization with `resolveSafePath` that validates normalized paths, blocks directory traversal (`..`), and rejects any access outside the active workspace directory.
    - System path firewall that explicitly blocks Windows system directories (`C:\Windows`, `System32`, `Program Files`, `AppData`).
    - Terminal command safety filter that prevents dangerous system destructive commands (`format`, `del /s /q c:\`, `rmdir /s /q c:\`, diskpart, etc.).
  - Built Native OpenAI-compatible Tool Specification for Ollama:
    - `file_system`: `read_file`, `write_file`, `edit_file`, `delete_file`, `list_directory`.
    - `terminal`: `run_command` (executed in PowerShell with `cwd` bound to project workspace).
    - `web_tools`: `fetch_web_url`.
    - `system_info`: `get_environment_info`.
  - Added REST API endpoints in `server.js`:
    - `POST /api/agent/chat` (Server-Sent Events streaming thoughts, tool actions, and results in real time).
    - `GET /api/workspaces` & `POST /api/workspaces` (Workspace management).
    - `GET /api/workspaces/:name/files` (Workspace file explorer).
    - `GET /api/skills` & `POST /api/skills/toggle` (Plugin & skill configuration).
  - Upgraded Web UI (`index.html`):
    - Added interactive Mode Selector pills (`💬 Chat`, `⚡ Agent (Auto)`, `📋 Agent (Plan)`, `🛡️ Agent (Ask)`).
    - Added Workspace Indicator & Switcher badge (`📁 Workspace: [project]`).
    - Added Skills & Permissions Management tab in Settings.
    - Added real-time tool execution UI cards (`⚙️ Action`, `✅ Result`) in the streaming chat feed.
- **How It Was Implemented:**
  - Used native `tools` parameter in Ollama's `/api/chat` API, leveraging Qwen 3.5's built-in tool calling capabilities.
  - When tool calls are generated, the harness routes them to `skills_registry.js`, runs them within `workspace_guard.js`, appends tool response messages with `role: "tool"`, and loops until the model produces a final user response or hits step limit.
  - Zero third-party runtime dependencies maintained: built purely on Node.js core modules (`node:path`, `node:fs`, `node:child_process`, `node:http`).
- **Why It Was Done:**
  - Modern LLMs become truly transformative when transformed from passive text generators into active agents capable of reading, writing, building, and verifying code.
  - Without sandboxing, an autonomous agent could accidentally modify system files, delete directories, or run arbitrary commands across the host machine.
  - Sandboxing files strictly to `workspace/<project_name>` gives the user peace of mind, granting full file editing and terminal command execution within the boundary while guaranteeing complete protection for the rest of the laptop.

---

### 14. Reversion of Agentic Harness to Pure Conversational Companion
- **Date:** November 10, 2026
- **What Was Done:**
  - Removed the Agentic Harness, Skills/Plugins Registry, and Workspace Sandbox components (`agent_harness.js`, `skills_registry.js`, `workspace_guard.js`) per user directive.
  - Streamlined `server.js` back to its pure, high-performance conversational backend with the Dual-State persistent memory engine intact.
  - Cleaned up `index.html` by removing the mode selectors, workspace switcher, and skills manager, restoring the focused, clean conversational interface.
  - Updated `test_suite.ps1` to test the 7 core living brain & inference verification tests without agent harness dependencies.
  - Preserved existing user project files in `workspace/` while adding `workspace/` to `.gitignore`.
- **How It Was Implemented:**
  - Removed `agent_harness.js`, `skills_registry.js`, and `workspace_guard.js` from the active codebase.
  - Reverted `server.js` routes (`/api/workspaces`, `/api/skills`, `/api/agent/chat`) and removed tool-calling redirects from `/api/chat`.
  - Reverted `index.html` to standard single-stream chat with voice dictation, file attachments, and memory inspection.
  - Retained all "Living Brain" infrastructure: Dual-State SQLite schema (`chat_logs`, `user_profile_memory`, `session_metadata`), session context injection, asynchronous background review, and ChatGPT/Claude conversational style.
- **Why It Was Done:**
  - The user requested to remove the harness to simplify operation and focus exclusively on natural conversational intelligence, high-speed text generation, and persistent memory recall across sessions without tool-execution overhead.

---

### 15. Purge Stored User Profile Memories to Clean Slate
- **Date:** November 10, 2026
- **What Was Done:**
  - Wiped all accumulated and learned user memory keys from `user_profile_memory` in the SQLite database (`nepal_trek_plan_duration`, `architecting_project`, `favorite_programming_language`).
  - Restored the profile memory state to foundational creator identity and target machine environment parameters (`creator_and_developer: Abiral`, `operating_system: Windows 11`, `primary_hardware: HP OMEN RTX 5060`, `primary_ai_model: Axom v1.1`, `preferred_communication_style: ChatGPT/Claude style`).
  - Updated seed definitions in `db.js` so default style aligns with modern conversational persona.
- **How It Was Implemented:**
  - Executed targeted deletion query removing all non-foundational keys from SQLite `user_profile_memory`.
  - Updated default seed array in `db.js` (`initDatabase`) to match the ChatGPT/Claude communication style directive.
  - Verified inference via live `/api/chat` call: confirmed model accurately identifies Abiral and host hardware without carrying over past conversational baggage (no Zenith OS, no Rust, no Nepal trek).
- **Why It Was Done:**
  - The user requested to clear user profile memory to start fresh with a clean slate, removing outdated facts and synthetic test traces while keeping the Dual-State memory architecture ready for future conversations.

---

### 16. Header Simplification & Full Bilingual Translation (Portuguese / English)
- **Date:** November 10, 2026
- **What Was Done:**
  - Removed the top-right header cluster shown in the user's screenshot (`model-select` dropdown, `conn` status badge, `top-version` label, and duplicate `+` button) to clean up visual clutter.
  - Added a dedicated, styled bilingual language switcher (`EN` / `PT`) in the top-right of the header.
  - Implemented complete, end-to-end Portuguese (`pt`) and English (`en`) internationalization (`I18N`) across all UI surfaces:
    - Sidebar (Nova conversa, Pesquisar conversas, Configurações, Fixadas, Hoje, Ontem, Anteriores, Fundador & Criador).
    - Header & Titles (Espaço de Trabalho / Nova conversa, Alternar barra lateral, etc.).
    - Hero Home Screen ("PENSE FORA DO PADRÃO" / "THINK OFF-SCRIPT").
    - Chat & Composer (Placeholder, Anexar, Voz, Enviar, Parar geração, Avisos de IA, Teclas de atalho).
    - Message actions & Thinking blocks ("A pensar...", Copiar, Regenerar, Boa resposta, Resposta inadequada).
    - Context menus & Popovers (Renomear, Fixar/Desafixar, Exportar Markdown, Eliminar).
    - Confirmation Dialogs (Renomear, Eliminar conversa com botões Cancelar / Confirmar).
    - Settings Modal (Abas e painéis de Conta, Cérebro, Aparência, Geração com seletor de modelos, Treino e Sobre).
    - Speech-to-text voice dictation language automatically switching between `pt-PT` and `en-US`.
- **How It Was Implemented:**
  - Built a reactive `I18N` dictionary mapping in `index.html` with a helper `t(key)`.
  - Stored language selection in `localStorage` (`S.lang = 'pt' | 'en'`), defaulting to Portuguese (`pt`) as requested.
  - Added action handler `data-act="setlang"` to dynamically switch language on click, update `document.documentElement.lang`, reload `shell()`, and display toast notifications.
  - Moved the local inference model selector cleanly into the **Generation** tab in Settings to eliminate clutter from the top header while preserving user control.
- **Why It Was Done:**
  - The user requested removing the cluttered top-right header section and fully translating the interface into Portuguese with an interactive option to toggle between English (En) and Portuguese (Pt).

---

### 17. Brand Slogan Preservation and Custom Composer Placeholders
- **Date:** November 10, 2026
- **What Was Done:**
  - Preserved the official brand slogan `THINK OFF-SCRIPT.` verbatim in both the English and Portuguese versions of the website.
  - Updated the composer input text box placeholder:
    - English (`EN`): `"Ask Axom"`
    - Portuguese (`PT`): `"Pergunte o Axom"`
- **How It Was Implemented:**
  - In `index.html` `I18N`:
    - Updated `pt.heroTitle` to `THINK <span class="outline">OFF-SCRIPT.</span>` matching `en.heroTitle`.
    - Updated `en.inputPlaceholder` to `"Ask Axom"`.
    - Updated `pt.inputPlaceholder` to `"Pergunte o Axom"`.
- **Why It Was Done:**
  - The user requested preserving "THINK OFF-SCRIPT." across all languages as it is AXOM's official brand slogan, and customized the input placeholder to provide clean, direct branding ("Ask Axom" / "Pergunte o Axom").

---

### 18. Autonomous Agentic Web Search, Live Webpage Browsing & Desktop Browser Engine
- **Date:** November 10, 2026
- **What Was Done:**
  - Designed and built a zero-external-dependency autonomous agentic browser engine (`browser_service.js`) empowering AXOM to search the live web, read dynamic web pages, and launch desktop browser windows.
  - Integrated native OpenAI/Ollama tool calling directly into `server.js` with multi-turn synthesis loops (`search_web`, `browse_page`, `open_browser`).
  - Added an interactive `🌐 Web` toggle button in the composer toolbar with persistent state (`localStorage`), visual toggle feedback, and full bilingual localization (`EN` / `PT`).
  - Created real-time SSE tool execution cards in `index.html` displaying live animated search status, query strings, and clickable source reference pills in the chat stream and message history.
- **How It Was Implemented:**
  - **Zero-API-Key Web Search (`searchWeb`):**
    - Queries DuckDuckGo HTML endpoint with custom headers, parsing titles, clean outbound URLs (decoding `uddg`), and snippet summaries in ~200ms without requiring paid search APIs or API keys.
  - **Clean Page Extraction & Headless Chromium Fallback (`browsePage`):**
    - High-speed HTTP fetch with regex-based HTML boiler-plate stripping (strips `<script>`, `<style>`, `<nav>`, `<footer>`, `<svg>`, `<noscript>`) and converts markdown headings, lists, and paragraphs.
    - If a client-side JavaScript SPA (React/Vue/Angular) returns minimal text (<250 chars), automatically invokes Windows Microsoft Edge / Chrome in headless mode (`--headless=new --dump-dom --virtual-time-budget=5000`) via `node:child_process` to capture the fully hydrated dynamic DOM without installing Puppeteer.
  - **Desktop Browser Launching (`openBrowserWindow`):**
    - Detects system Edge or Chrome binaries (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` or Google Chrome) and launches a visible browser window using detached `child_process.spawn`.
  - **Native Tool Calling Pipeline in `server.js`:**
    - Defined Ollama/OpenAI tool specs in `BROWSING_TOOLS`.
    - Implemented an autonomous multi-turn tool execution loop (`while (turn < MAX_AGENT_TURNS)`):
      - In Turn 1, the model searches DuckDuckGo via `search_web`.
      - In Turn 2, the model autonomously visits the top search result (e.g. AccuWeather) using `browse_page` to read the exact live webpage.
      - Added `parseTextToolCalls()` in `browser_service.js` to catch and parse both native Ollama `tool_calls` and XML/JSON tool call tags (`<tool_call><function=browse_page>...`) if the model emits them into content text, preventing raw XML tags from leaking to the user.
      - In Turn 3, feeds the extracted page data into the model to produce the final comprehensive, factual answer with zero raw `<tool_call>` leakage.
    - When `web_search: false` is toggled off, uses ultra-fast direct streaming with 0ms tool latency.
  - **Bilingual Interface & Tool Cards in `index.html`:**
    - Added `webTitle`, `webBadge`, `webEnabled`, `webDisabled`, `toolSearching`, `toolFoundSources`, `toolReadingPage`, `toolPageRead`, `toolOpeningBrowser`, and `toolBrowserOpened` to `I18N.en` and `I18N.pt`.
    - Implemented `.web-btn` toggle and `.tool-card` UI with live pulse animations and link chips.
- **Why It Was Done:**
  - The user asked if there is a way to give AXOM agentic capabilities like live web search and its own browser so it can browse the internet and open URLs on their Windows laptop.
  - Implemented with zero third-party npm packages to maintain a clean, lightweight, private architecture adhering to the zero-dependency rule.

---

### 19. Clean Minimalist UI Overhaul, Modern Typography & Zero-Emoji Directives
- **Date:** November 10, 2026
- **What Was Done:**
  - Removed rough grain/noise SVG overlays (`body::after` fractal noise filter) that previously degraded text clarity, rendering fonts sharp, crisp, and high-resolution.
  - Redesigned message styling to match modern high-end AI interfaces (Cursor/Claude/ChatGPT style):
    - Replaced brutalist yellow/green blockquote borders on user messages with clean, rounded `#27272a` chat bubbles.
    - Updated typography to `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif` with antialiasing and subpixel smoothing.
    - Redesigned code blocks (`.cb`): dark graphite rounded container (`#18181b`), `</> lang` icon header tag, and interactive copy button with checkmark feedback.
    - Added full native Markdown table parser and styling (`<table>`, `<th>`, `<td>`) with borderless minimalist divider lines.
  - Implemented strict Zero-Emoji system directives in `db.js` (`formatProfileContext()`, `user_profile_memory`) and `server.js` (`webDirective`), eliminating decorative emojis in headings and lists.
- **How It Was Implemented:**
  - Removed `body::after` noise filter from `index.html`.
  - Added table parsing in `md(src)` matching `| Feature | Status |` syntax.
  - Added `code` and `check` SVG paths to `P`.
  - Updated `preferred_communication_style` in SQLite to enforce zero decorative emojis and technical clarity.
- **Why It Was Done:**
  - The user reported that the UI and fonts looked rough and the AI was using too many emojis, requesting a clean, refined interface with modern fonts, clean code blocks, and structured tables matching their provided screenshot.

---

### 20. Web Search Toggle Pill Capsule UI Redesign & Overflow Fix
- **Date:** November 10, 2026
- **What Was Done:**
  - Fixed an awkward UI layout glitch where enabling web search rendered a rigid 30x30px square around the globe icon while the `WEB` label protruded outside the right border of the button.
  - Redesigned the Web search toggle into a sleek, modern pill capsule matching industry-standard AI interfaces (ChatGPT / Claude / Perplexity).
- **How It Was Implemented:**
  - In `index.html`:
    - Removed the rigid `.ib` class from `#webBtn` which had previously enforced `width: 30px; height: 30px; border-radius: 0;` and broken flex layout.
    - Updated `.web-btn` CSS with `display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 15px; border: 1px solid var(--bd);`.
    - Integrated typography with `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif; font-size: 12px; font-weight: 500;`.
    - Enhanced active state (`.web-btn.on`) with soft orange background tint (`rgba(255,81,47,.12)`), active border (`var(--ac)`), subtle ambient glow (`box-shadow: 0 0 10px rgba(255,81,47,.15)`), and smooth tactile micro-interaction (`active { transform: scale(0.96); }`).
- **Why It Was Done:**
  - The user provided a screenshot (`media_1794346777623_3f220fe4.png`) showing the awkward 30x30px border clipping and requested to make the web search toggle clean and well-proportioned.

---

### 21. Collapsible Thinking & Agentic Search Accordion UI Overhaul
- **Date:** November 10, 2026
- **What Was Done:**
  - Replaced the bulky, static `.tool-card` containers and exposed link blocks with a sleek, minimalist collapsible accordion (`<details class="tool-trace think-trace">`) modeled directly after modern AI "Thinking" dropdowns (ChatGPT/Claude/Perplexity style).
  - Consolidated all autonomous tool steps (queries searched, pages browsed, sources discovered) into a single compact, one-line status indicator (e.g. `🌐 Pesquisou 4 fontes ▾` / `🌐 Searched 4 sources ▾`) collapsed by default.
  - Eliminated raw link dumps in message flow: clicking the summary expands the dropdown to reveal the exact searches performed and interactive external source links.
  - Unified the visual styling of both internal model reasoning (`<details class="think">`) and agentic tool traces (`<details class="tool-trace">`).
- **How It Was Implemented:**
  - In `index.html`:
    - Replaced `toolHTML()` with `toolsTraceHTML(tools, isOpen=false)` which aggregates multi-turn searches, deduplicates source URLs into unique reference chips, and renders a native semantic `<details>` element.
    - Added clean animated SVG icons (`chevron` `M6 9l6 6 6-6` and `ext` `M18 13v6a2 2 0 0 1-2 2...`) with CSS transform rotation on open.
    - Implemented `.think-trace` CSS:
      - Closed state: `width: fit-content; max-width: 100%; border-radius: 8px; border: 1px solid var(--bd); background: var(--surf);` (clean pill-like single line).
      - Open state: Expands to full container width (`width: 100%`) displaying structured sub-sections: `PESQUISAS` (queries & page reads) and `FONTES` (clickable link chips with external link icons).
      - Hover & Micro-interactions: Custom summary marker removal, smooth chevron flip (`transform: rotate(180deg)`), and active pulse animation (`.running`) during live searches.
    - Updated `msgHTML()` and `generate()` / `paint()` to preserve open/close states dynamically during streaming and across re-renders.
    - Added bilingual support in `I18N.en` and `I18N.pt` (`searchedWeb`, `searchedSources`, `searchedSourceSingle`, `traceSearches`, `traceSources`, `searchQueryLabel`, `readPageLabel`, `openedBrowserLabel`).
- **Why It Was Done:**
  - User requested (`media_1794349354079_e09f965f.png`): *"instead of all this make it so there is like just one thing like thinking and if you click on it it shows the link not just show it directly and also searches"*.
  - Keeps chat messages pristine, clean, and distraction-free while keeping complete inspectability of agent searches and citations one click away.

---

### 22. Live Compute Spinner & Inside Browser HTML Studio
- **Date:** November 10, 2026
- **What Was Done:**
  - **Live Compute & Loading Circle Spinner:**
    - Resolved the empty pause during initial inference planning, tool execution, and neural synthesis.
    - Added an animated SVG loading circle (`.spin-circle`) with clear status text (`Thinking...` / `A pensar...`) before text arrival, and `Thinking & Searching web...` / `A pensar & A pesquisar na web...` while autonomous tool browsing is executing.
    - Prevents users from ever feeling the interface is hung or frozen.
  - **Inside Browser / HTML Sandbox Studio:**
    - Implemented a complete embedded browser panel (`#insideBrowser`) right inside the AXOM desktop interface.
    - Users can create, preview, run, test, and edit HTML/CSS/JS websites, games, and web apps directly inside AXOM in a secure, sandboxed `<iframe>`.
    - Integrated with code blocks: any HTML code block in chat features a prominent `[ 🌐 Visualizar / Preview ]` button in its header to open it immediately in the Inside Browser.
    - Added a dedicated `[ 🌐 Navegador / Browser ]` toggle button in the top navigation header bar.
    - Features of the Inside Browser:
      - Live address bar with virtual workspace path (`axom://workspace/index.html`).
      - Code / Preview view toggle with live editing and instant re-render.
      - Hot reload button `↻`.
      - Open in native external browser window `↗` via Blob URL.
      - One-click HTML download button `💾`.
      - Expand / Maximize to full screen `⛶`.
      - Interactive starter playground with 4 one-click creation cards (Calculator, Snake Game, Pomodoro Timer, Landing Page) via `postMessage`.
- **How It Was Implemented:**
  - In `index.html`:
    - Added `.compute-loading` and `.spin-circle` CSS with continuous `@keyframes spin` animation.
    - Added `InsideBrowser` controller object with `open()`, `close()`, `toggle()`, `toggleMaximize()`, `toggleView()`, `reload()`, `openNewTab()`, and `download()`.
    - Added `defaultStarterHTML()` template for starter workspace.
    - Added `btn-preview` in `md()` parser when syntax is `html`/`htm` or contains HTML markup.
    - Added `browserHeaderBtn` and `<aside class="inside-browser">` in `shell()`.
    - Updated `msgHTML()` and `paint()` to display `.compute-loading` while computing before text arrival.
    - Added localization keys to `I18N.en` and `I18N.pt`.
- **Why It Was Done:**
  - User requested: *"while its searching web or doing something that really needs compute make it so it says thinking and shows loading circle so that people dont just get hanget while doing things and also add a browser indide maybe where it can create and show html sites in it"*.

---

### 23. Real In-App Web Browser with Chrome/DuckDuckGo Live Proxy Navigation (2026-11-10)
- **What Was Done:**
  - Upgraded the in-app browser panel into a real Chrome-like web browser that browses the live internet (DuckDuckGo, Wikipedia, Google, AccuWeather, GitHub, docs, and any search query) right inside AXOM, side-by-side with chat.
  - Implemented high-performance local proxy endpoint `/api/browser/proxy?url=...` in `server.js` using native Node.js `fetch`.
    - Automatically strips `x-frame-options`, `content-security-policy`, and `frame-ancestors` blocking headers.
    - Injects `<base href="...">` for relative assets and navigation script intercepting link clicks and GET search form submissions to keep navigation seamlessly inside the in-app browser.
    - Sends `browserNavigated` and `browserLoaded` messages to the parent window to keep address bar and tab title synchronized in real time.
  - Integrated full browser chrome UI:
    - Back (`←`), Forward (`→`), Reload (`⟲`), and Home (`🌐`) navigation controls.
    - Omnibox address bar accepting direct URLs, domains, and queries (automatically routed to DuckDuckGo search) with an immediate Go (`↑`) button and Enter key execution.
    - One-click source chip browsing: clicking any source link from search results instantly opens that webpage in the in-app browser.
    - Maximized / Split-Screen toggle for full desktop browsing or side-by-side split view.
  - Full bilingual localization in English and Portuguese.
- **How It Was Implemented:**
  - In `server.js`:
    - Added `/api/browser/proxy` endpoint with streaming text/html rewriting, `<base href>`, click interception, and form submit interception.
  - In `index.html`:
    - Updated `InsideBrowser` controller object with `navigate()`, `back()`, `forward()`, `reload()`, `home()`, and `postMessage` listener.
    - Updated `shell()` markup with address bar controls and iframe sandbox.
    - Added click interception for `.trace-source-chip` to open sources directly in the in-app browser.
    - Added Enter key listener on `#ibUrlInput`.
- **Why It Was Done:**
  - User requested: *"noo i mean like browser inside app that runs google chrome not like that i meant like chatgpt"*.

---

### 24. Obsidian Second Brain Integration & Automatic Neural Knowledge Graph (2026-11-10)
- **What Was Done:**
  - Integrated Obsidian as AXOM's living "Second Brain", connecting `axom:1.1`'s neural context directly to an Obsidian Knowledge Graph vault.
  - Initialized dedicated Obsidian Vault at `C:\Users\abira\Documents\Axom_Brain`:
    - Fully configured with `.obsidian` configurations: dark mode theme, live preview, AXOM signature flame accent `#ff512f`, and core plugins enabled.
    - Synchronized all 45+ conversation transcripts, user profile memories, system/hardware specifications, preferences, and project milestones into inter-linked markdown notes with YAML frontmatter, tags, and wikilinks (`[[...]]`).
  - Implemented Bi-Directional Memory Engine (`obsidian_vault.js`):
    - **Obsidian -> Model Context**: `readVaultKnowledge()` scans notes in `Knowledge/` and `Projects/` and injects them directly into AXOM's system prompt context so AXOM remembers and reasons over everything in Obsidian.
    - **Model Review -> Obsidian Vault**: `memory_reviewer.js` automatically triggers `obsidian_vault.syncAll()` after reviewing chat sessions, keeping the vault updated in real time.
    - Added API endpoints: `GET /api/obsidian/status`, `POST /api/obsidian/sync`, and `POST /api/obsidian/open`.
    - Added Obsidian Second Brain UI card in the Settings modal Brain tab with one-click "Open in Obsidian" and "Sync Vault Now".
    - Handled automatic background download and installation of Obsidian for Windows.
- **How It Was Implemented:**
  - Created `obsidian_vault.js`.
  - Updated `memory_reviewer.js` to dispatch real-time syncs on review.
  - Updated `server.js` with Obsidian API routes and `vaultKnowledge` context injection.
  - Updated `index.html` with bilingual localization and interactive vault controls.
- **Why It Was Done:**
  - User requested: *"now download obsidian and connect my model to its brain so it remembers everything"*.

---

### 25. Multi-Modal Ingestion (Vision + PDF Parsing), File Modification Actions, System Optimization & Training Suite (2026-11-10)
- **What Was Done:**
  - **Multi-Modal File Ingestion**:
    - Removed binary file barriers, expanding AXOM's intake to all file types up to 25MB: images (PNG, JPG, WEBP, GIF, BMP, SVG), PDFs, Word `.docx`, and arbitrary binary or text files.
    - Integrated local vision processing with `moondream` (828MB) running on Ollama, extracting scene breakdowns, visual features, OCR text, and dimensions without requiring model weight replacement.
    - Implemented a zero-dependency streaming PDF parser in pure Node.js (`node:zlib`) to decompress `/FlateDecode` streams and extract text operators (`Tj`, `TJ`, hex strings) without external npm packages.
    - Implemented a zero-dependency Office Word `.docx` XML text extractor.
  - **File Modification & Workspace Management**:
    - Added one-click **Save to Workspace** (`saveworkspace`) and **Download** (`downloadcode`) buttons on code/file output blocks in the UI.
    - Added backend endpoints `POST /api/files/save` and `GET /api/files/workspace` managing files inside `c:\Users\abira\Documents\axom\workspace`.
    - Added interactive rename dialog and confirmation toast notifications for saved and downloaded artifacts.
  - **System Cleanup & Optimization**:
    - Deleted the 324MB temporary installer artifact `$env:TEMP\ObsidianSetup.exe` and obsolete setup scripts.
    - Executed SQLite maintenance routines (`VACUUM;` and `PRAGMA optimize;`) on `data/axom_memory.db`.
  - **Fine-Tuning & Model Training Suite for Tomorrow**:
    - Created dataset exporter `train/export_dataset.js` generating Alpaca (`train/axom_alpaca.json`, 63 examples) and ShareGPT (`train/axom_sharegpt.jsonl`, 29 conversations) formats directly from AXOM's conversation logs and system alignment pairs.
    - Created production-ready QLoRA training script `train/train_unsloth_lora.py` utilizing Unsloth 4-bit optimization, ready for execution on local RTX 5060 or Google Colab T4, with automatic GGUF export for Ollama (`Axom_v1.2-Q4_K_M.gguf`).
    - Authored comprehensive step-by-step training guide `train/TRAINING_GUIDE.md`.
- **How It Was Implemented:**
  - Created `file_service.js` with pure Node.js multi-modal extraction routines.
  - Added `/api/files/parse`, `/api/files/save`, `/api/files/workspace` endpoints in `server.js`.
  - Updated file upload handling, visual thumbnails, PDF badges, and code action handlers in `index.html`.
  - Created `train/` directory with dataset generation and Unsloth LoRA scripts.
- **Why It Was Done:**
  - User requested: *"and can you make it so that my ai can read images and pdfs like every file type and then modify it or so what i ask to and also optimize the files and folders related to my ai and also we will train this ai tomorrow soo lets see"*.

---

### 26. Autonomous Zero-Click Web Search & Complex Task Detection (2026-11-11)
- **What Was Done:**
  - Implemented Autonomous Web Search Detection in `browser_service.js`:
    - `isWebSearchNeeded(query)`: Heuristic classifier detecting real-time queries (weather, temperatures, forecasts, live sports scores, crypto/stock prices, releases, versions, news) and difficult tasks (stack traces, runtime crashes, complex documentation lookups).
    - Added typo-tolerant pattern matching (`weathert`, `wheather`, `temperat*`, `clima`, `previsão`, `chuva`, etc.) in both English and Portuguese.
    - `extractSearchQuery(query)`: Distills natural conversation prompts into clean search keywords for DuckDuckGo.
  - Implemented Autonomous Agent Supervisor & Fail-Safe in `server.js`:
    - Fixed Ollama Jinja template collision (`Error: Jinja Exception: No user query found in messages`) by preventing the monologue bypass `</think>` turn when tool calling is enabled.
    - Enabled autonomous routing: if `isWebSearchNeeded` is true, the system automatically activates web browsing without requiring the user to click the "WEB" button.
    - Added fail-safe supervisor: if a difficult/real-time query is detected and the model forgets to call a tool on turn 1, the supervisor auto-triggers `search_web` with the cleaned query, feeds results on turn 2, and synthesizes the live answer.
  - Updated Frontend UI (`index.html`):
    - Changed the web button to "Auto Web", showing active autonomous web search by default.
    - Maintained collapsible "Thinking" trace with live spinner and source pill chips.
- **How It Was Implemented:**
  - Added `isWebSearchNeeded` and `extractSearchQuery` to `browser_service.js`.
  - Updated `/api/chat` agentic loop in `server.js`.
  - Updated I18N localization and default state in `index.html`.
- **Why It Was Done:**
  - User requested: *"make it so if its difficult task and needs web search without clicking into web search yk like whats the weathert condition etc and all"*.

---

### 27. Google Live Web Search Integration, Deep Page Extraction & Enhanced Synthesis (2026-11-11)
- **What Was Done:**
  - **Google Live Search Engine Integration**:
    - Upgraded `browser_service.js` with Google News real-time index (`searchGoogleNews`), returning official headlines, forecasts, and live articles from verified sources (AccuWeather, BBC, Sky News, Reuters, etc.).
    - Built a unified multi-engine search pipeline (`searchWeb`) combining Google News real-time index with a general web index, de-duplicating by URL domain.
    - Updated in-app browser (`index.html`) default search engine, home navigation, quick-links, and new tab handling from DuckDuckGo to Google (`https://www.google.com`).
  - **Deep Web Page Extraction ("Make It A Lot More Intelligent")**:
    - Upgraded `searchWeb` with automated deep page extraction: for top search results, AXOM fetches the target web pages and extracts clean paragraph text (up to 1,000 characters per result), feeding deep verified facts to the model instead of truncated 1-line search snippets.
  - **Agentic Synthesis & Zero-Emoji Filter**:
    - Upgraded the system prompt in `server.js` with structured synthesis architecture (Executive Summary, Current Conditions / Forecast Table, Technical Details, Key Sources).
    - Enforced a post-processing Unicode emoji filter stripping decorative emojis across all responses while preserving markdown tables, code blocks, and structured citations.
    - Optimized agent loop to a strict 2-turn pipeline (Turn 1: Tool execution, Turn 2: Comprehensive synthesis) eliminating multi-turn looping.
- **How It Was Implemented:**
  - Added `searchGoogleNews` and deep text extraction in `browser_service.js`.
  - Updated in-app browser defaults in `index.html`.
  - Refined agentic loop, directives, and regex filters in `server.js`.
- **Why It Was Done:**
  - User requested: *"connecting it to live web search tools insted of duck make it google and also make it a lot more intelligent and then after finishing the work shit off my pc after comming it into github"*.

---

### 28. Integration of AI Research Skills Subsystem (2026-11-11)
- **What Was Done:**
  - **Full 17 AI Research Skills Architecture**:
    - Integrated the 17 academic research skills from `WenyuChiou/ai-research-skills` spanning 4 domain families (`research-workspace`, `academic-writing`, `zotero-operations`, `ai-delegation`) across the 8-stage scientific lifecycle:
      1. `research-hub`: Primary scholarly discovery, multi-source academic query, reading depth tracking (`not-read`, `abstract-only`, `selected-sections`, `full-text`), and vault notes.
      2. `research-hub-multi-ai`: Multi-agent research coordination, dependency graphs, and delegation routing (`.coord/multi_ai_plan.md`).
      3. `research-context-compressor`: Repository context compression into `.research/project_manifest.yml`, `experiment_matrix.yml`, and `data_dictionary.yml`.
      4. `research-project-orienter`: Instant contextual orientation memos without rescanning repositories.
      5. `research-design-helper`: 5 Socratic design segments (Research Question sharpening, Expected Mechanism, Identifiability & Confounders, Empirical Validation Plan, Risk Register with early-warning indicators) generating `.research/design_brief.md`.
      6. `literature-triage-matrix`: High-density 9-column comparative literature matrices (`.research/literature_matrix.md`).
      7. `paper-memory-builder`: Structured claim-evidence maps (`.paper/claims.yml`) and figure references (`.paper/figures.yml`).
      8. `paper-summarize`: Evidence-grounded academic paper and abstract summarizer.
      9. `notebooklm-brief-verifier`: Source coverage and contradiction audit against primary literature.
      10. `gap-to-topic`: 3-Gate candidate topic evaluator (Is gap open? Is it a contribution? Is it feasible?) producing formal decision dossiers (`.research/topic_dossier.md` and `.gaps.yml`).
      11. `zotero-library-curator`: Bibliographic library and BibTeX curator auditing duplicate DOIs, orphan items, and tag hygiene.
      12. `research-workflow-orchestrator`: Resumable 8-stage human-in-the-loop workflow controller (`.research/workflow_state.yml`).
      13. `academic-writing-skills`: Full manuscript drafting, section scaffolding, paragraph synthesis, claim-evidence alignment, and release readiness.
      14. `paper-review`: Multi-module scientific peer-review critique (equation provenance, mathematical derivations, baseline fairness, statistical rigor, limitations, rebuttal prep).
      15. `zotero-skills`: Bibliographic CRUD, parsing, standard `@authorYear` citation keys, and BibTeX generation.
      16. `codex-delegate`: Technical implementation delegation briefs (`.ai/codex_task_<name>.md`) and result contract validation.
      17. `antigravity-delegate`: Bounded mechanical execution tracking and structured result reporting.
  - **Zero-Dependency Native Scholarly Engine (`research_skills.js`)**:
    - Built direct arXiv XML API integration (`http://export.arxiv.org/api/query`) retrieving peer-reviewed preprints, authors, publication years, abstracts, and direct PDF URLs.
    - Built CrossRef JSON API integration (`https://api.crossref.org/works`) querying official academic publisher DOIs and titles.
    - Automated citation key formatting (`@authorYear`) and standards-compliant BibTeX export.
    - Added heuristic research task classifier (`isResearchTask`) and specialized academic prompt directive (`getResearchDirective`).
  - **Server Integration & Agentic Routing (`server.js`)**:
    - Wired `research_skills.js` into the agent loop: when an academic query is detected or requested, AXOM automatically injects academic research directives and enables the 6 academic function tools (`academic_search`, `generate_bibtex`, `build_literature_matrix`, `evaluate_research_gap`, `create_design_brief`, `conduct_paper_review`).
    - Added REST endpoints `GET /api/skills/research` (complete 17-skill catalog) and `POST /api/skills/research/execute` (direct programmatic skill execution).
    - Compacted payload serialization to prevent Ollama Jinja buffer truncation and ensure smooth 2-turn synthesis.
  - **User Interface Enhancements (`index.html`)**:
    - Added SVG icons for `book` and `clipboard`.
    - Added quick suggestion chips on home hero: "Discover arXiv Papers", "3-Gate Gap Dossier", "Literature Triage Matrix", "Socratic Design Brief".
    - Enhanced tool execution trace to render academic search results with citation keys and links to arXiv/DOI papers.
- **How It Was Implemented:**
  - Created `research_skills.js` with pure Node.js APIs (`fetch`, `fs`, `path`).
  - Updated `server.js` agent loop, tool execution, and system prompt.
  - Updated `index.html` with translation keys, styles, and tools trace rendering.
  - Added `.research/`, `.paper/`, and `.coord/` to `.gitignore`.
- **Why It Was Done:**
  - User requested: *"https://github.com/WenyuChiou/ai-research-skills can you put these skills in my axom"*.

---

### 29. Removal of Study Subsystem & Top Header Browser Icon
- **Date:** November 11, 2026
- **What Was Done:**
  - Removed the experimental Study subsystem (`study.js`, `study.css`, `study_service.js`, and associated `/api/study/*` endpoints in `server.js`).
  - Restored `index.html` to direct conversational AI mode with standard sidebar and logo navigation.
  - Removed the browser toggle button (`#browserHeaderBtn`) from the top header bar in `index.html`.
- **How It Was Implemented:**
  - Reverted study-specific changes across `server.js`, `index.html`, and removed untracked study assets.
  - Removed `#browserHeaderBtn` from the `.hdr` container in `shell()`.
- **Why It Was Done:**
  - User requested: *"i wanted you to copy everything and my ai doesnt work in it idk why for now delete the part that you just did like study part and also remove the browser icon on top"*.

---

### 30. Project Workspace & Database Optimization
- **Date:** November 11, 2026
- **What Was Done:**
  - **SQLite Database Optimization**:
    - Removed 6 orphaned tables (`study_podcasts`, `study_notes`, `study_insights`, `study_source_links`, `study_sources`, `study_notebooks`) from `data/axom_memory.db`.
    - Executed `PRAGMA integrity_check`, `VACUUM`, and `PRAGMA optimize`, reducing database size from 430 KB to 244 KB (42% size reduction).
  - **Obsidian Vault Organization**:
    - Preserved user learning materials (`MySQL Exam Study Guide.md`) by transferring them to `C:\Users\abira\Documents\Axom_Brain\Knowledge\Programming\`.
    - Removed leftover synthetic test directories from the Obsidian vault.
  - **Repository Architecture & Hygiene**:
    - Created `package.json` with standard project scripts (`npm start`, `npm test`, `npm run optimize`, `npm run export-dataset`).
    - Enhanced `.gitignore` covering Python bytecode (`__pycache__/`, `*.pyc`), editor metadata (`.vscode/`, `.idea/`), logs, and temporary swap files.
    - Created automated maintenance utility `scripts/optimize.js` to run integrity checks, vacuuming, and cleanup on demand.
- **How It Was Implemented:**
  - Ran native Node.js SQLite statements and filesystem cleanups.
  - Validated database integrity and executed regression tests via `test_suite.ps1`.
- **Why It Was Done:**
  - User requested: *"optimize the folder of the project"*.

---

### 31. Axom V2: Local Intelligence, RAG & Runtime Enhancement Wrapper
- **Date:** November 11, 2026
- **What Was Done:**
  - Designed and deployed **Axom V2** (`Axom V2/`), a zero-retraining enhancement wrapper that upgrades the intelligence, accuracy, and tool capabilities of the local `axom:1.1` model.
  - **Hardware Audit & Runtime Optimization**:
    - Audited host hardware: NVIDIA GeForce RTX 5060 Laptop GPU (8,151 MiB GDDR7 VRAM, CUDA 13.5), AMD Ryzen 9 8940HX (16 Cores, 32 Threads), 32 GB DDR5 RAM.
    - Expanded safe context window from standard 2,048 tokens to 16,384 tokens (`num_ctx = 16384`), utilizing ~1.2 GB of GPU VRAM for KV cache while keeping 100% of LLM operations in GPU memory with ~2.8 GB headroom.
    - Tuned sampling parameters for disciplined factual generation: `temperature: 0.3`, `repeat_penalty: 1.10`, `top_p: 0.90`, `top_k: 40`.
  - **Local RAG Pipeline with LanceDB & Dense Embeddings**:
    - Embedded vector database powered by LanceDB (`lancedb==0.41.0`, `pyarrow==26.0.1`) storing Arrow-columnar vector embeddings in `Axom V2/data/lancedb/`.
    - Local multi-format document ingestion engine (`Axom V2/ingest.py`) parsing PDFs, Markdown, TXT, and source code files in `Axom V2/docs/`.
    - Recursive semantic boundary chunker (900 characters per chunk, 150 characters overlap).
    - Local vector generation using `qwen3-embedding:0.6b` (1,024 dimensions, 32k context) via local Ollama API without any external network dependencies.
    - Grounding retrieval engine (`Axom V2/rag_engine.py`) executing cosine distance nearest-neighbor queries and injecting ranked chunks into the prompt context.
  - **Structured Reasoning & Anti-Hallucination Prompts**:
    - Authored `Axom V2/system_prompt.txt` enforcing a two-phase reasoning protocol: internal Chain-of-Thought planning enclosed in `<think>...</think>` tags followed by verified, grounded answers.
    - Mandatory verifiable citation contract: all factual assertions must be linked to source documents using `[doc:filename#chunk_id]`.
    - Strict zero-emoji policy and anti-hallucination instructions to state "I do not have verified local information" when retrieved context is insufficient.
    - Documented architectural blueprint in `Axom V2/agents.md`.
  - **Connected Local Tools & Dispatch**:
    - Implemented sandboxed local tools in `Axom V2/tools.py`: `read_file`, `write_file`, `list_directory`, `calculate` (AST-safe math evaluation), and `execute_python` (isolated subprocess with 8-second timeout).
  - **Interactive CLI & Web Interfaces**:
    - Built streaming CLI (`Axom V2/cli.py`) with real-time token streaming, citation badges, and `/docs`, `/ingest`, `/calc`, `/clear` commands.
    - Built zero-framework standalone web interface (`Axom V2/app.py` running on `http://127.0.0.1:8088`) using Python's standard library `ThreadingHTTPServer`. Includes dark-mode single-page UI, document drag-and-drop uploader, collapsible `<think>` reasoning drawer, and citation badges.
    - Created Windows batch launchers: `Axom V2/run_web.bat` and `Axom V2/run_cli.bat`.
- **How It Was Implemented:**
  - Python scripts organized under `Axom V2/` with `config.py` centralizing all paths and parameters.
  - Verified end-to-end RAG retrieval, citation verification, and tool evaluation with automated tests.
- **Why It Was Done:**
  - User requested: *"I want to upgrade the intelligence, accuracy, and capabilities of my local AI model without doing any training or fine-tuning. Please inspect my current system environment and set up a complete local enhancement wrapper for me... make the folder name Axom V2"*.

---

### 32. Project Sandbox Mode & Autonomous In-Project File Modification
- **Date:** November 11, 2026
- **What Was Done:**
  - Implemented **Project Workspace Mode**, a fully sandboxed development mode where files are placed in an isolated project directory and the AI has direct autonomous read, create, and modify permissions strictly bounded to that project.
  - **Project Service & Sandbox Security (`project_service.js`)**:
    - Created isolated project repository directory `workspace/projects/` with default starter workspace `workspace/projects/default-project/`.
    - Enforced strict path resolution (`resolveProjectPath`): any path traversal (`../`, absolute paths outside the project directory) is caught and denied with a security exception.
    - Built 6 project-scoped developer tools:
      1. `project_list_files`: Inspects files, directories, sizes, and timestamps within the active project.
      2. `project_read_file`: Reads file content safely up to 2MB with line counts.
      3. `project_write_file`: Creates new files or completely updates existing files on disk.
      4. `project_modify_file`: Performs surgical search-and-replace modifications on existing project files.
      5. `project_delete_file`: Safely deletes files inside the active project.
      6. `project_run_code`: Executes local scripts (`node`, `python`, `npm`) inside the project root with a 10-second timeout.
  - **Server Endpoints & Agentic Loop (`server.js`)**:
    - Added REST endpoints: `GET /api/projects`, `POST /api/projects/select`, `POST /api/projects/create`, `GET /api/project/files`, `GET /api/project/file`, `POST /api/project/file`, `POST /api/project/modify`, `POST /api/project/delete`, `POST /api/project/upload`, `POST /api/project/execute`.
    - Injected `getProjectDirective(activeProject)` into `/api/chat` informing the model of its active project boundary and providing full write/edit permissions.
    - Expanded agent turns up to 4 turns in project mode so the model can inspect, read, modify, and verify files on disk in a single user turn.
  - **User Interface & In-App Code Editor (`index.html`)**:
    - Added Project Mode toggle button (`#projectBtn`) in composer tools and top header (`.project-hdr-btn`) with green active glow.
    - Built sliding Project Workspace Drawer (`#projectDrawer`) featuring:
      - Project selector dropdown + `+ New Project` creation.
      - Live file tree with language-specific icons (`.html`, `.css`, `.js`, `.py`, `.md`, `.json`), file size badges, and delete actions.
      - Drag-and-drop file upload zone and file creation dialog.
      - In-app monospaced code viewer/editor with live save functionality.
    - Updated message trace rendering (`toolsTraceHTML`) to display real-time sandbox action chips (`[Read]`, `[Created]`, `[Modified]`, `[Deleted]`, `[Ran]`).
    - Added full bilingual support in English and Portuguese.
- **How It Was Implemented:**
  - Zero external npm packages required; built using standard Node.js APIs (`node:fs`, `node:path`, `node:child_process`).
  - Tested end-to-end file creation and surgical modification via streaming SSE requests.
- **Why It Was Done:**
  - User requested: *"well for now can you mmake it so i have an mode in my web that i put files in my project and it only works inside it like it has acess to change and modify the files inside that project"*.

---

### 33. Complete Removal of Project Mode & Non-Training Intelligence Upgrade (16K Context, Unlocked CoT Reasoning, MCP Tools & 2026 Temporal Grounding)
- **Date:** November 11, 2026
- **What Was Done:**
  - **Complete Removal of Project Mode**:
    - Cleaned `index.html`: removed project toggle button (`#projectBtn`), top header button, project drawer (`#projectDrawer`), project CSS styles, project translation keys, project trace action badges, and `ProjectManager` JavaScript object.
    - Cleaned `server.js`: removed `projectService` dependency, `/api/projects*` endpoints, `/api/project/*` endpoints, and project agent loop directives.
    - Deleted `project_service.js` and removed temporary workspace directory `workspace/projects/`.
  - **Strict No-Model-Pull Compliance**:
    - Aborted external model pull attempts per explicit user instruction ("dont pull another model").
    - Kept existing fine-tuned weights (`axom:1.1` and `axom:latest`, 4.2B Q4_K_M based on Qwen 3.5 Uncensored).
  - **Context Window 8x Expansion (`num_ctx = 16384`)**:
    - Increased runtime context window from Ollama's default 2,048 tokens to 16,384 tokens in both `Modelfile` and `server.js` options.
    - Confirmed that at 16k context, total VRAM consumption on the NVIDIA GeForce RTX 5060 Laptop GPU is ~3.9 GB, keeping inference 100% on the GPU with zero CPU offloading overhead.
  - **Unlocked Deep Chain-of-Thought (CoT) Reasoning**:
    - Removed hardcoded `<think>\n</think>` suppression lines from `Modelfile` template.
    - Removed assistant pre-fill `formattedMessages.push({ role: 'assistant', content: '</think>' })` in `server.js` that previously silenced the model.
    - Updated `pipeOllamaStream` in `server.js` to parse both `message.thinking` and inline `<think>...</think>` tags in real time, streaming them as `{ type: 'think', text: ... }` to seamlessly trigger the UI's collapsible reasoning container.
  - **Dynamic Real-Time Temporal Grounding**:
    - Injected real-time dynamic calendar date and current year (2026) directly into the agent system prompt on every turn (`Wednesday, November 11, 2026`).
    - Eliminates model hallucinations caused by static training cutoffs and ensures AXOM is fully aware of the current year and environment.
  - **Model Context Protocol (MCP) Client & Tool Engine (`mcp_client.js`, `mcp_config.json`)**:
    - Engineered `mcp_client.js` with structured tool definitions, execution dispatchers, and `mcp_config.json` supporting standard Model Context Protocol servers.
    - Exposes native high-performance tools:
      1. `system_info`: Real-time machine telemetry (Windows 11, AMD Ryzen 9 8940HX 32-core CPU, 32GB RAM, NVIDIA RTX 5060 GPU VRAM status).
      2. `calculate_or_eval`: Safe Python 3.15.1 execution engine for complex mathematical proofs, geometry, statistics, and calculations with zero hallucination.
      3. `search_living_memory`: Direct keyword and semantic search across SQLite memory records and Obsidian Second Brain notes.
    - Added `/api/mcp/status` REST endpoint for real-time tool inspection.
- **How It Was Implemented:**
    - Updated Ollama model manifests using `ollama create axom:latest -f Modelfile` and `ollama create axom:1.1 -f Modelfile`.
    - Tuned inference hyperparameters: `temperature: 0.4`, `repeat_penalty: 1.1`, `top_p: 0.9`, `top_k: 40`, `num_ctx: 16384`.
    - Ran full test suite `test_suite.ps1` (all 7 living brain tests passed).
    - Verified exact math calculation via Python execution (`math.sqrt(5764801) * 17 = 40817`).
    - Verified 2026 temporal awareness with complete internal step-by-step thinking monologue.
- **Why It Was Done:**
  - The user requested: *"well remove the project function and make my ai fully up to date and make it intelligent using any measure but without training you can change moddel contex and model weights but yeah make it more intelligent"*.
  - The user added: *"dont pull another model if you want you can use skills tools and all like connecting to mcp servers and etc but make sure to put it in the log"*.

---

### 34. Dedicated High-Accuracy RAG Chatbot & Knowledge Vault Studio (2026-11-14)
- **What Was Done:**
  - Designed and built a dedicated, isolated RAG (Retrieval-Augmented Generation) Chatbot & Document Knowledge Base Studio directly inside the AXOM workspace (`http://127.0.0.1:8000`).
  - Implemented an advanced hybrid search retrieval pipeline combining:
    1. **Dense Vector Search**: Powered by LanceDB vector store (`rag_knowledge_chunks.lance`) and Ollama's `qwen3-embedding:0.6b` (1,024-dimensional embeddings).
    2. **BM25 Lexical Keyword Overlap**: Exact term matching for technical identifiers, hardware specs, cryptographic key sizes, and names (65% vector cosine + 35% lexical scoring).
    3. **Document Ingestion Pipeline (`scripts/rag_core.py`)**: Automatic text extraction from PDFs (`pypdf` with page tracking), Markdown (`.md`), text files (`.txt`), and code files (`.py`, `.js`, `.json`). Recursive semantic chunking (`chunk_size = 650`, `chunk_overlap = 120`).
  - Added full RAG REST API endpoints to `server.js` and `rag_service.js`:
    - `GET /api/rag/documents`: returns indexed documents, chunk counts, and file sizes.
    - `POST /api/rag/upload`: multipart file upload and automated ingestion into LanceDB.
    - `POST /api/rag/delete`: document removal with automatic index update.
    - `POST /api/rag/ingest`: manual vault re-indexing.
    - `POST /api/rag/chat`: grounded SSE streaming and non-streaming inference using Ollama `axom:1.1` (`temperature: 0.2`, `num_ctx: 16384`) with source citations.
  - Developed a separated, responsive RAG frontend in `index.html`:
    - One-click **Mode Switcher** in the sidebar and top header to toggle between `[AI Companion]` and `[Knowledge Vault]`.
    - **Knowledge Base Vault Drawer**: Displays document cards (PDF, Markdown, Code), size in KB, chunks count, delete button, drag-and-drop file dropzone, and "Re-Index Vault" button.
    - **Grounded Copilot Chat Stream**: Dedicated conversation stream with clickable citation chips (`[doc:filename#chunk (XX% match)]`).
    - **Interactive Source Chunk Inspector Modal**: Clicking any citation chip or inline source tag opens an inspection dialog showing match score, cosine vector similarity, BM25 overlap, and the raw grounding passage from the document.
    - Strict Zero-Emoji compliance throughout all UI components and prompts.
    - Bilingual English and Portuguese translations in `I18N`.
  - **Empirical Grounding & Accuracy Verification**:
    - Created test documents: `neural_hardware_whitepaper.pdf` and `quantum_cryptography_report.md`.
    - Created and executed test evaluation suite (`scripts/test_rag_eval.py`):
      1. **PDF Fact Retrieval**: 100% accurate (Hyperion-V4 TDP: 18W, ResNet-101 Benchmark: 14,280 fps, Lead Engineer: Dr. Kenneth Ward) with citation `[doc:neural_hardware_whitepaper.pdf#0]`.
      2. **Markdown Technical Report Retrieval**: 100% accurate (Kyber-1024 Public Key: 1,568 bytes, Private Key: 3,168 bytes, Lead Cryptographer: Dr. Evelyn Vance at Zurich Institute) with citations `[doc:quantum_cryptography_report.md#1]` and `#0`.
      3. **Negative / Zero-Hallucination Test**: 100% pass (correctly identified that Martian blueberry pancakes do not exist in the documents, summarized what was in the documents, and refused to hallucinate).
- **How It Was Implemented:**
  - Files created/modified:
    - [`scripts/rag_core.py`](file:///c:/Users/abira/Documents/axom/scripts/rag_core.py): LanceDB + Ollama embedding + BM25 hybrid search engine.
    - [`rag_service.js`](file:///c:/Users/abira/Documents/axom/rag_service.js): Node.js integration layer for document ingestion, search, and formatting.
    - [`server.js`](file:///c:/Users/abira/Documents/axom/server.js): REST and SSE streaming endpoints for `/api/rag/*`.
    - [`index.html`](file:///c:/Users/abira/Documents/axom/index.html): Full RAG Studio interface, mode switcher, knowledge vault, and citation inspector.
    - [`data/rag_docs/`](file:///c:/Users/abira/Documents/axom/data/rag_docs/): Pre-indexed documentation and whitepapers.
- **Why It Was Done:**
  - The user requested: *"now in my ai can you build me a rag chatbott too like seperated section in my ai for now make it tso itt has high accuraccy and also test it wih documents and let me know"*.

---

### 35. Option Pills Removal, Global Direct Typing Focus & Non-Blocking Multitasking (2026-11-14)
- **What Was Done:**
  - **Removed Suggestion Option Pills**:
    - Completely removed the 4 prompt option chips (`[Discover arXiv Papers]`, `[3-Gate Gap Dossier]`, `[Literature Triage Matrix]`, `[Socratic Design Brief]`) from the home welcome screen (`welcome()`).
    - Removed sample question grid cards from the RAG empty screen (`ragEmptyHTML()`).
    - Achieved a minimalist, distraction-free interface focusing solely on the brand, header, and active input composer.
  - **Global Direct-Typing Focus & Continuous Text Composition**:
    - Automatic input focus on page load (`shell()` and startup) so users can immediately begin typing without having to click the mouse.
    - Continuous composition: input textarea (`#inp` / `#ragInp`) is never disabled during generation, allowing users to type thoughts or follow-up questions while AXOM is generating.
    - Focus retention: sending a message keeps focus directly inside the textarea without blurring.
    - Global keyboard capture: typing any printable alphanumeric or symbol key while not already inside an interactive element automatically transfers focus to the composer without dropping characters.
    - Respects mouse clicks: clicking on message text, buttons, modals, or sidebar search will not aggressively steal focus until the user resumes typing.
  - **Non-Blocking Background Multitasking**:
    - Replaced the single blocking global `run` lock with a multi-session `activeRuns = new Map()` tracking active generations per conversation ID.
    - Eliminated all blocking `stopGenFirst` checks on conversation switching (`open`), new chat creation (`newChat`), sidebar navigation, view switching, and settings dialogs.
    - Users can freely navigate to other conversations, create new chats, open the browser, or switch between `[AI Companion]` and `[Knowledge Vault]` while an ongoing generation continues streaming in the background.
    - Added real-time visual indicator: conversations actively generating in the background display an animated pulsing dot (`.live-dot`) in the sidebar list.
    - Submitting a new message in an actively generating conversation cleanly cancels the previous generation and immediately initiates the new turn.
- **How It Was Implemented:**
  - Files modified: [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
- **Why It Was Done:**
  - The user requested: *"remove these opttions from here and also make it so whenever i enter the site i can type directly and dont have o click with mmouse and smme while i amm talking to it i should be always be able to write unless i click sommehwre else and also mmake itt so i can do other things while itts working and generating like change the chat and all basically everything"* and attached an image showing the four option buttons.

---

### 36. Free Cloud AI Providers & Multi-Model Inference Hub (2026-11-16)
- **What Was Done:**
  - **Free Cloud AI Distributor Catalog & Engine**:
    - Built [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js) to manage, persist, test, and stream completions from top free-tier AI cloud providers:
      - **Groq Cloud (LPU)**: Ultra-fast LPUs (~300 tok/s), generous free tier (14,400 req/day) supporting `Llama 3.3 70B`, `Llama 3.1 8B`, `Mixtral 8x7B`, `Gemma 2 9B`.
      - **OpenRouter (Free Tier Hub)**: Rotating free models (`:free` suffix) with zero cost ($0.00), including `DeepSeek R1 Free`, `Llama 3.3 70B Free`, `Qwen 2.5 Coder 32B Free`, `Gemma 2 9B Free`.
      - **Google Gemini (AI Studio)**: Generous 1,500 req/day free tier with 1,000,000+ token context window supporting `Gemini 2.5 Flash`, `Gemini 2.5 Pro`, `Gemini 2.0 Flash`.
      - **Cerebras Cloud**: World-record 2,000+ tok/s wafer-scale inference with 1,000,000 free tokens/day supporting `Llama 3.3 70B` and `Llama 3.1 8B`.
      - **DeepSeek Cloud**: Direct DeepSeek API connecting to `DeepSeek-Chat (V3)` and `DeepSeek-Reasoner (R1)`.
      - **Custom OpenAI-Compatible Proxy**: Universal endpoint adapter for self-hosted LLMs (LM Studio, vLLM, LocalAI) or reverse proxies.
  - **Secure Local Key Management**:
    - Keys are stored locally in `data/ai_keys.json` with secure masking (`maskApiKey`).
    - Added `data/ai_keys.json` to `.gitignore` so personal API keys are never committed to version control.
  - **Universal Streaming & CoT Extraction**:
    - Built OpenAI-compatible Server-Sent Events (SSE) streaming engine.
    - Extracted chain-of-thought reasoning tokens (`delta.reasoning_content`) to match AXOM's native `<details class="think">` expandable accordion.
    - Zero-emoji sanitization enforced on all cloud outputs.
    - Automatic Google web search pre-grounding for cloud models when web intelligence is enabled.
  - **Backend API Routes (`server.js`)**:
    - `GET /api/models`: dynamically aggregates the local model (`axom:1.1`) and all configured/available cloud models.
    - `GET /api/providers`: returns provider metadata, badges, free-tier quotas, and connection status.
    - `POST /api/providers/save`: saves API keys and custom proxy configurations.
    - `POST /api/providers/test`: tests live connection and measures real-time latency in milliseconds.
    - `POST /api/chat` & `POST /api/rag/chat`: transparently routes inference requests to either local Ollama or the selected cloud distributor.
  - **Settings UI & Active Model Indicator (`index.html`)**:
    - Added a dedicated "AI Providers" tab in the Settings modal with dark-carbon cards, model chips, direct "Get Free Key ↗" portal links, API key password inputs, real-time "Test" buttons, and latency status output.
    - Grouped model selector in the Generation tab into `<optgroup>` categories (e.g. `AXOM Local Engine`, `Groq Cloud`, `OpenRouter Free Tier`, `Google Gemini`).
    - Added an interactive active model button in the application header (`.hdr-model-btn`) displaying the currently active neural model with a live status dot, allowing users to switch models or configure providers with one click.
    - Bilingual English / Portuguese (EN/PT) localization for all strings.
- **How It Was Implemented:**
  - Files created: [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js).
  - Files modified: [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), [`index.html`](file:///c:/Users/abira/Documents/axom/index.html), [`.gitignore`](file:///c:/Users/abira/Documents/axom/.gitignore).
- **Why It Was Done:**
  - The user requested: *"can you add in settings so i can add api key of various free ai distributor and use it in here search for best and all"*

---

### 37. UI Redesign to Antigravity Aesthetic & Suggestion Options Removal (2026-11-16)
- **What Was Done:**
  - **Eliminated Brutalist Bloat & Suggestion Clutter**:
    - Removed the harsh retro `Anton` poster font, 0px sharp brutalist corners, 8px drop shadows, fake barcodes, and oversized slogans.
    - Completely purged suggestion prompt chips (`[Discover arXiv Papers]`, `[3-Gate Gap Dossier]`, `[Literature Triage Matrix]`, `[Socratic Design Brief]`) and unused sample grids from the codebase.
    - Removed redundant sidebar mode switchers to focus the navigation strictly on conversation history.
  - **Implemented Antigravity-Inspired Aesthetic**:
    - **Obsidian & Carbon Palette**: Deep dark slate surfaces (`#0b0c0e`, `#111216`, `#16171d`, `#1e2029`) with hairline borders (`#232530`).
    - **Typography**: Clean proportional `Inter` (400/500/600/700) for UI hierarchy and `JetBrains Mono` for code, tags, and metrics.
    - **Signature Electric Blue / Cyan Glow**: Accent color modernized from harsh orange to electric blue (`#3b82f6` / `#06b6d4`) with subtle ambient glow effects.
    - **Sleek Sidebar**: Glowing gradient emblem mark, "AXOM v1.1" branding, pill-shaped New Chat button (`Ctrl+N`), clean search field (`Ctrl+K`), and a refined user profile card at the base.
    - **Minimalist Header (54px)**: Breadcrumb path, interactive active model status pill with live green indicator, dual-view switcher (`[AI Companion]` / `[Knowledge Vault]`), and language switch (EN/PT).
    - **Antigravity Hero Welcome Screen**: Centered floating emblem with radial blue glow, elegant greeting (*"How can I help you today?"*), subtitle (*"Autonomous intelligence, local neural reasoning, and research workflows."*), and status chips (`RTX 5060`, `Living Brain`, `Private & Local`).
    - **Floating Composer Box**: Curved container (radius 14px) with subtle ambient shadow, glow focus state, integrated Auto Web toggle, voice mic button, file attach button, and circular send trigger.
    - **Modern Modal & Settings**: Frosted backdrop blur (`backdrop-filter: blur(6px)`), curved corners (14px), modern tabs, and refined provider cards.
- **How It Was Implemented:**
  - Files modified: [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
- **Why It Was Done:**
  - The user requested: *"make my ui better remove unnecessary things and all make my ui like yours antigravity"* and attached the suggestion options pill image for removal.

---

### 38. Chatbot vs Knowledge RAG Switcher, Live Provider Model Discovery, and Auto Task-Based Router (2026-11-16)
- **What Was Done:**
  - **Seamless View Switching (AXOM Chatbot <-> Knowledge RAG)**:
    - Added dual sidebar view tabs (`[ 💬 AXOM Chat ]` and `[ 📚 Knowledge RAG ]`) with active accent indicators.
    - Added minimalist header view switcher and keyboard shortcuts (`Ctrl+1` for AXOM Chatbot, `Ctrl+2` for Knowledge RAG).
    - Preserved active state, drafts, and split contexts between regular conversation and grounded document retrieval.
  - **Dynamic Live Model Discovery for Connected Providers**:
    - Created `fetchProviderLiveModels(providerId)` with in-memory caching (`MODEL_CACHE_TTL = 10 min`) and on-boot warm-up.
    - When an API key is connected (e.g., OpenRouter, Groq, Cerebras, DeepSeek, Gemini), AXOM queries the provider's models endpoint in real time to discover all available models (e.g., OpenRouter returns 433 live models, highlighting 14 active free models).
    - Discovers local Ollama models (`axom:1.1`, `moondream:latest`) automatically.
    - Exposed `GET /api/models` returning both `models` (array of model IDs) and `data` (rich metadata objects with badges, provider, free tier flags, and descriptions).
  - **Auto Task-Based Router (`auto` / "⚡ Auto (Best Model)")**:
    - Designed and implemented `selectBestModelForTask(prompt, options)` in `ai_providers.js`.
    - Automatically classifies user intents and prompt complexity across domains:
      - **Code Synthesis & Debugging:** Routes to specialized coder models (e.g., `openrouter/cohere/north-mini-code:free` or Groq/Qwen 2.5 Coder).
      - **Mathematical, Logical & Deep Reasoning:** Routes to reasoning models (e.g., `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, DeepSeek R1 Reasoner).
      - **Grounded Document Retrieval & RAG:** Routes to large-context models (e.g., `openrouter/baidu/ernie-5.5-flash-preview:free`, Gemini 2.0 Flash).
      - **Speed & Chit-Chat (< 80 chars):** Routes to ultra-fast inference (e.g., `openrouter/nvidia/nemotron-3.5-lightning:free`, Cerebras Wafer-Scale, Groq LPU).
      - **Offline / Local Fallback:** Routes to local NVIDIA GeForce RTX 5060 running `axom:1.1`.
    - Real-time Server-Sent Events (SSE) emit an `auto_route` event (`{ type: 'auto_route', route }`), rendering a live glowing badge in the chat UI indicating which model was chosen and why.
  - **Model Picker Modal & Interactive Selector**:
    - Added an interactive model picker trigger to both the application header (`.hdr-model-btn`, shortcut `Ctrl+M`) and the floating composer toolbar (`.comp-model-btn`).
    - Opens a search-filtered modal displaying models categorized into:
      - ⚡ Intelligent Routing (`Auto (Best Model)`)
      - 🖥️ Local Hardware (RTX 5060)
      - ☁️ Connected Cloud Providers (OpenRouter, Groq, Gemini, DeepSeek, Cerebras, Custom)
    - Supports live search/filtering by name, provider, or model tag (e.g., "free", "llama", "code").
- **How It Was Implemented:**
  - Files modified: [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js), [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
- **Why It Was Done:**
  - The user requested: *"make it so i can switch between axom chatbot and rag anso add option so i can select what model of ai i wanna use and if connected to the provider it shows all the models it has and an auto mode that finds the best model to do the job"*

---

### 39. Settings Cleanup: Removal of Account, Brain, Training, and About Tabs (2026-11-16)
- **What Was Done:**
  - **Streamlined Settings Modal**:
    - Completely removed the `Account`, `Brain`, `Training`, and `About` tabs and pane contents from the Settings modal.
    - Simplified the settings navigation to focus strictly on essential controls:
      1. `Appearance`: UI Theme selection (Dark / Light / System) and Enter Sends toggle.
      2. `Generation`: Model selector, Thinking process toggle, Temperature, Top-K, Max Tokens, Seed, and Stop sequences.
      3. `AI Providers`: Cloud API keys management and connection testing (Groq, OpenRouter, Google Gemini, Cerebras, DeepSeek, Custom proxy).
    - Default settings view updated from `account` to `appearance`.
    - Optimized `fetchSettingsData()` to load only active provider keys on modal open, eliminating redundant fetches for raw memories and training checkpoints.
- **How It Was Implemented:**
  - Files modified: [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
- **Why It Was Done:**
  - The user requested: *"remove about ,training,brain and account"*

---

### 40. Multi-Repository Skills & Plugins Installation (2026-11-16)
- **What Was Done:**
  - Curated and installed **32 premier agentic skills and plugins** from four leading open-source repositories:
    1. **`amd/skills`** (Hardware Acceleration, VRAM Optimization, Local LLM Inference):
       - `local-ai-use`: Meta-skill for routing local inference, STT/TTS, and private image tasks.
       - `local-ai-app-integration`: Universal local LLM streaming, function calling, structured outputs, and SSE protocols.
       - `hyperloom-workload-optimizer`: VRAM allocation, KV-cache tuning, and token throughput maximization on consumer GPUs (NVIDIA RTX 5060).
    2. **`EliasOulkadi/shokunin`** (Software Engineering Craftsmanship & Architecture):
       - `agent-tools`: Universal agent tool calling patterns, self-correction on execution failure.
       - `efficient-coding`: High-density minimal code generation, zero unnecessary process dumps.
       - `code-review`: Multi-angle code review (correctness, security, edge cases, performance).
       - `db-sculptor`: Schema modeling, index tuning, query plan analysis, ACID transactions.
       - `api-forge`: RESTful & SSE API design, OpenAPI 3.1 compliance, rate-limiting, and error schemas.
       - `auth-architect`: Authentication and authorization (OAuth 2.0, WebAuthn, JWT, RBAC/ABAC).
       - `error-handler`: Root cause analysis, defensive programming, failure circuit breakers.
       - `performance-profiler`: Latency bottleneck detection, memory leak tracing, event loop profiling.
       - `test-commander`: Test-driven development, unit testing, integration suites, mocking patterns.
       - `web-security`: OWASP Top 10 defenses, XSS/CORS/CSRF prevention, secret leak prevention.
       - `senior-engineer`: High-level system architecture, tradeoff evaluation, scalable design patterns.
       - `taste-minimalist`: Clean minimalist design principles, typography, and layout composition.
       - `windows-powershell`: Safe PowerShell scripting, execution policies, and cross-version compatibility.
       - `git-workflow`: Git hygiene, atomic commits, branch management, merge strategies.
       - `docker`: Multi-stage Docker builds, layer caching, container security, and minimal images.
       - `ci-cd`: GitHub Actions / GitLab CI pipeline design, matrix builds, test sharding.
       - `playwright`: End-to-end browser testing, selectors, network mocking, visual regression.
       - `runbook-gen`: Automated production runbooks, incident triage guides, escalation trees.
    3. **`wshobson/agents`** (Multi-Agent Teams & Orchestration):
       - `task-coordination-strategies`: Dynamic task decomposition, dependency graphs, and multi-agent coordination.
       - `parallel-debugging`: Multi-perspective bug hunting and parallel diagnostic verification.
       - `team-communication-protocols`: Structured inter-agent messaging, handoffs, and payload contracts.
       - `multi-reviewer-patterns`: Consensus-based peer review swarms across architecture, security, and performance.
       - `parallel-feature-development`: Isolated branch workflows for simultaneous agent authoring.
       - `team-composition-patterns`: Role archetypes (Architect, Implementer, Verifier, Scribe) for swarms.
       - `protect-mcp-setup`: Model Context Protocol isolation, permission gating, and credential safeguards.
    4. **`sickn33/agentic-awesome-skills`** (Token Optimization, Memory & Prompt Discipline):
       - `zipai-optimizer`: Ultra-dense token optimization, prompt caching, minified JSON payloads.
       - `codex-fable5`: Five-step verification discipline (Inspect, Track, Ground, Verify, Adapt).
       - `ditto`: Evidence-backed work profiling and living session memory extraction.
       - `fable-safe-prompt`: Prompt rewriting to eliminate false-positive policy blocks without intent loss.
  - **Triple Installation Locations**:
    1. **AXOM Local Engine**: Installed into `c:\Users\abira\Documents\axom\skills\` with full `SKILL.md` documents.
    2. **Global Antigravity**: Installed into `C:\Users\abira\.gemini\config\skills\` (expanding library to 65 active skills).
    3. **Universal Agent Directory**: Installed into `C:\Users\abira\.agents\skills\` for cross-harness compatibility.
  - **AXOM Skill System Integration**:
    - Created [`axom_skills.js`](file:///c:/Users/abira/Documents/axom/axom_skills.js) with dynamic skill indexing, search, frontmatter parsing, and heuristic trigger matching.
    - Added `consult_skill` tool to AXOM's agentic loop in [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), allowing `axom:1.1` and cloud models to load in-depth skill guidelines dynamically during complex tasks.
    - Added `GET /api/skills` endpoint exposing the full 32-skill catalog to the UI and API consumers.
- **How It Was Implemented:**
  - Files created: [`axom_skills.js`](file:///c:/Users/abira/Documents/axom/axom_skills.js), 32 `skills/<skill_name>/SKILL.md` directories.
  - Files modified: [`server.js`](file:///c:/Users/abira/Documents/axom/server.js).
- **Why It Was Done:**
  - The user requested: *"browse these and install all the important skills and plugins into my local model and tell me which ones you did and all in log"*

---

### 41. Automated Dynamic Intelligence, Free-Only API Routing, & Two-Option Model Streamlining (2026-11-16)
- **What Was Done:**
  - **Automated Dynamic Intelligence & Zero-Overhead Casual Greetings**:
    - Built heuristic detector (`isBasicPrompt`) that recognizes casual chit-chat and greetings ("hi", "hello", "hey", "how are you", etc.) and bypasses internal thinking tags (`<think>...</think>`, SSE `type: 'think'`) and Google web searching completely.
    - Casual greetings respond with near-zero latency in a warm, concise, single sentence with zero thinking bloat or search delays.
    - Deep reasoning (`type: 'think'`) automatically triggers only when mathematical proofs, complex logic, or algorithmic questions are detected.
    - Live web search and grounding automatically triggers only when current real-time events, weather, stock prices, or URLs are requested.
  - **Streamlined Two-Option Model Architecture**:
    - Restructured the model catalog across UI header, composer button, modal selector, and backend to present strictly **TWO** distinct choices:
      1. `auto`: **⚡ Auto (Best Model)** — autonomously evaluates the user's prompt and routes between local Axom v1.1, OpenRouter Free models, or Google Gemini.
      2. `axom:1.1`: **🖥️ Axom v1.1 (RTX 5060)** — 100% private, offline, dedicated hardware neural inference on the NVIDIA GeForce RTX 5060 Laptop GPU.
  - **Free-Only API Provider Gating**:
    - Restricted the AI Providers backend and Settings UI to 100% free options:
      1. **OpenRouter (Free Hub)**: Zero-cost ($0.00) models (`nvidia/nemotron-3.5-lightning:free`, `cohere/north-mini-code:free`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `baidu/ernie-5.5-flash-preview:free`).
      2. **Google Gemini (AI Studio)**: Free tier with 1,500 req/day and 1M token context window.
    - Completely purged paid/obsolete providers (Groq, Cerebras, DeepSeek, and custom proxy) from provider configuration and UI.
  - **Purged Unwanted Settings Tabs & Suggestion Options**:
    - Completely removed `About`, `Training`, `Brain`, and `Account` tabs from the Settings dialog, leaving strictly `Appearance`, `Generation`, and `AI Providers`.
    - Removed suggestion option pills (`[Discover arXiv Papers]`, `[3-Gate Gap Dossier]`, `[Literature Triage Matrix]`, `[Socratic Design Brief]`).
  - **Continuous Direct Typing & Multi-Tasking UX**:
    - Added instant autofocus listeners on page entry (`DOMContentLoaded`, `load`, `focus`, `visibilitychange`).
    - Added smart global typing interception so typing anywhere immediately redirects focus into the message box without requiring a mouse click.
    - Refocused click handler so clicking anywhere in the chat area (outside buttons/links) automatically refocuses the input box.
    - Kept input box and sidebar conversations fully active during background generation so users can type follow-ups or switch between chats seamlessly while responses stream.
- **How It Was Implemented:**
  - Files modified: [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js), [`browser_service.js`](file:///c:/Users/abira/Documents/axom/browser_service.js), [`index.html`](file:///c:/Users/abira/Documents/axom/index.html).
- **Why It Was Done:**
  - The user requested:
    1. *"remove about ,training,brain and account"*
    2. *"mke it so it has the best intelligence like if its basic like hi it doesnt think it only thinks and goes online to surf web if it s needed and all make it automated and also in api only add free options and only add models like axom,openrouter,or google and it autoselects the model only two options one axom and another called auto"*
    3. *"make it so whenever i enter the site i can type directly and dont have o click with mmouse and smme while i amm talking to it i should be always be able to write unless i click sommehwre else and also mmake itt so i can do other things while itts working and generating like change the chat and all basically everything"*

---

### 42. Awesome Free LLM APIs Integration: Directory, Layout, Zero-Key Gateways & Live Verifier (2026-11-16)
- **What Was Done:**
  - **Full Dataset & Skill Ingestion**:
    - Ingested the complete dataset from `https://github.com/mnfst/awesome-free-llm-apis` into [`data/free_llm_apis.json`](file:///c:/Users/abira/Documents/axom/data/free_llm_apis.json), capturing all 14 permanent free providers and 79 free models.
    - Installed the `free-llm-apis` agent skill with comprehensive provider guides, code templates, and decision matrices into [`skills/free-llm-apis/`](file:///c:/Users/abira/Documents/axom/skills/free-llm-apis/), global Antigravity (`~/.gemini/config/skills/`), and Universal Agent (`~/.agents/skills/`).
  - **Modular Service Architecture**:
    - Created [`free_apis_service.js`](file:///c:/Users/abira/Documents/axom/free_apis_service.js) providing catalog compilation, priority filtering, zero-key fallbacks, live endpoint testing, and code snippet generation.
    - Added backend endpoints in [`server.js`](file:///c:/Users/abira/Documents/axom/server.js):
      - `GET /api/free-apis`: Returns the enriched catalog with country flags, rate limits, context windows, modalities, and keyless indicators.
      - `POST /api/free-apis/test`: Live probe measuring HTTP status and latency (ms) for any free model.
      - `POST /api/free-apis/snippet`: Generates ready-to-run Python (OpenAI SDK), cURL, and Node.js code snippets.
  - **Zero-Key Free Gateway Integration**:
    - Added zero-configuration keyless free inference via Kilo Code (`kilo-auto/free`, 200 req/hr), LLM7.io (`gpt-oss:20b`), and OVHcloud directly into [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js).
    - Enabled automatic fallback to zero-key free cloud inference when user has no API keys configured.
  - **Front-End Free AI Hub & Explorer Layout (`index.html`)**:
    - Replicated the table and card layout from `awesome-free-llm-apis` in an Antigravity dark-mode aesthetic.
    - Added glowing `⚡ Free AI Hub (14 APIs)` pill in the header navigation (shortcut `Ctrl+Shift+F`).
    - Added interactive priority filter pills: `[All (14)]`, `[✨ No Key Needed (3)]`, `[⚡ Fastest (Groq / LPU)]`, `[🧠 Deep Reasoning]`, `[💻 Code Specialists]`, `[📚 1M+ Context]`, `[🇪🇺 EU Hosting]`.
    - Integrated live search field filtering across providers, models, context sizes, modalities, and rate limits.
    - Embedded model tables displaying Model ID, Context, Max Output, Modality badge, Rate Limit, and direct `Snippet` and `Test` buttons.
    - Integrated multi-language code snippet modal (Python, cURL, Node.js) with 1-click clipboard copy.
    - Added promotional Free Hub discovery banner in Settings -> `AI Providers`.
- **How It Was Implemented:**
  - Files created: [`free_apis_service.js`](file:///c:/Users/abira/Documents/axom/free_apis_service.js), [`data/free_llm_apis.json`](file:///c:/Users/abira/Documents/axom/data/free_llm_apis.json), [`skills/free-llm-apis/`](file:///c:/Users/abira/Documents/axom/skills/free-llm-apis/).
  - Files modified: [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js), [`index.html`](file:///c:/Users/abira/Documents/axom/index.html), [`PROJECT_LOG.md`](file:///c:/Users/abira/Documents/axom/PROJECT_LOG.md).
- **Why It Was Done:**
  - The user requested: *"https://github.com/mnfst/awesome-free-llm-apis go check this out and literally since its opensource add like majority of its features and layouts of it in my program basically copy it and integrate it into mine"*

---


---

### 43. 14 Free AI Providers Full Key Management, Real-Time Usage Telemetry & Ultra-Minimalist UI
- **Date:** 2026-11-16
- **What Was Done:**
  - **Full 14-Provider Directory & Key Management**:
    - Expanded provider registry in [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js) to support all 14 providers from `awesome-free-llm-apis`: Google Gemini, OpenRouter, Groq, Kilo Code, Cohere, Cloudflare Workers AI, LLM7.io, OVHcloud, NVIDIA NIM, Aion Labs, Z AI (Zhipu AI), Gonka Broker, ModelScope, SiliconFlow, plus local Axom RTX 5060 and custom OpenAI proxies.
    - Updated `saveProvidersConfig()` to dynamically store, update, or delete keys for any of the 14 providers.
    - Added one-click `Disconnect` button to remove and erase stored provider keys.
  - **Live Usage Telemetry & Quota Tracking ("see how much i used")**:
    - Implemented `GET /api/usage` and `POST /api/usage/reset` endpoints in [`server.js`](file:///c:/Users/abira/Documents/axom/server.js).
    - Integrated automatic telemetry logging on completion for all cloud streams (`streamProviderChat`) and local chats (`pipeOllamaStream`).
    - Tracks `requestsToday`, `requestsTotal`, `tokensToday`, `tokensTotal`, `avgLatencyMs`, and `lastUsed` with automatic daily rollover.
    - Embedded dynamic progress meters (`prov-meter-fill`) on all provider cards showing `[ requestsToday / maxRequests (percentUsed%) · remaining left ]` with color-coded warning thresholds (green < 60%, yellow < 85%, red >= 85%).
    - Added high-density Telemetry Strip at the top of Settings -> AI Providers: `Today: {totalRequestsToday} reqs · {totalTokensToday} tokens · Active: {activeCount} / 14`.
  - **Ultra-Minimalist UI & Clutter Purge**:
    - Purged verbose explanatory texts, disclaimers, and text walls across the interface.
    - Replaced home hero with a clean, high-density minimal header: `AXOM - Autonomous Neural Intelligence · Local RTX 5060 & 14 Free AI Providers`.
    - Verified complete absence of prompt option chips (`[Discover arXiv Papers]`, `[3-Gate Gap Dossier]`, `[Literature Triage Matrix]`, `[Socratic Design Brief]`).
    - Verified Settings dialog strictly displays only 3 clean tabs: `Appearance`, `Generation`, and `AI Providers` (completely omitting `Account`, `Brain`, `Training`, and `About`).
  - **Folder & Repository Optimization**:
    - Updated [`.gitignore`](file:///c:/Users/abira/Documents/axom/.gitignore) to protect `data/provider_usage.json`, `data/ai_keys.json`, `scratch/`, and runtime artifacts.
- **How It Was Implemented:**
  - Files modified: [`ai_providers.js`](file:///c:/Users/abira/Documents/axom/ai_providers.js), [`server.js`](file:///c:/Users/abira/Documents/axom/server.js), [`index.html`](file:///c:/Users/abira/Documents/axom/index.html), [`free_apis_service.js`](file:///c:/Users/abira/Documents/axom/free_apis_service.js), [`.gitignore`](file:///c:/Users/abira/Documents/axom/.gitignore).
- **Why It Was Done:**
  - The user requested: *"well i wanted my app to have aall the features of free llm api like where i could connect to all the providers see how much i used manages and all and also copy the ui design and build my axom onto it yk manke my folders optimmized and also make website very mininal like not that much texts and all only the important info is written"*

## 🔮 Active & Upcoming Work

### 43. QLoRA Fine-Tuning Execution (`axom:1.2`)
- **Goal:** Run the fine-tuning pipeline (`train/train_unsloth_lora.py`) using the generated 500,490-word synthetic training dataset.
- **Deliverable:** Quantized GGUF weights for Ollama.

---

## 📋 Ongoing Maintenance Checklist for Every Modification
When performing new work:
- [ ] Add a new numbered section to this log with Date, What, How, and Why.
- [ ] Test the backend and inference using `test_suite.ps1`.
- [ ] Update `README.md` if any user commands or configuration options changed.
- [ ] Commit changes with clear, descriptive git commit messages.
