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

## 🔮 Active & Upcoming Work

### 15. Periodic LoRA Fine-Tuning Pipeline (Neural Weight Evolution)
- **Goal:** Periodically bake long-term conversational data directly into updated neural weights (`axom:1.2`, `axom:1.3`).
- **Architecture Strategy:**
  1. Export curated `chat_logs` into Alpaca / ShareGPT JSONL training datasets.
  2. One-click script to execute local LoRA fine-tuning or trigger Google Colab Unsloth runs.
  3. Auto-convert and merge LoRA adapters into quantized GGUF weights.

---

## 📋 Ongoing Maintenance Checklist for Every Modification
When performing new work:
- [ ] Add a new numbered section to this log with Date, What, How, and Why.
- [ ] Test the backend and inference using `test_suite.ps1`.
- [ ] Update `README.md` if any user commands or configuration options changed.
- [ ] Commit changes with clear, descriptive git commit messages.
