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

## 🔮 Active & Upcoming Work

### 10. Periodic LoRA Fine-Tuning Pipeline (Neural Weight Evolution)
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
