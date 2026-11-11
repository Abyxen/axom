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

## 🔮 Active & Upcoming Work

### 29. QLoRA Fine-Tuning Execution (`axom:1.2`)
- **Goal:** Run the fine-tuning pipeline (`train/train_unsloth_lora.py`) using the generated 500,490-word synthetic training dataset.
- **Deliverable:** Quantized GGUF weights for Ollama.

---

## 📋 Ongoing Maintenance Checklist for Every Modification
When performing new work:
- [ ] Add a new numbered section to this log with Date, What, How, and Why.
- [ ] Test the backend and inference using `test_suite.ps1`.
- [ ] Update `README.md` if any user commands or configuration options changed.
- [ ] Commit changes with clear, descriptive git commit messages.
