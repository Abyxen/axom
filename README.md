# AXOM — Powered by DeepSeek Harness Microkernel

**AXOM** is an autonomous AI assistant and neural workspace built on top of the **DeepSeek Harness (`dsh`)** Cordis microkernel architecture. It runs 100% locally and privately on Windows 11 with local NVIDIA RTX 5060 GPU acceleration, SQLite Living Brain persistence, bi-directional Obsidian vault synchronization, and a multi-tier cascading cloud failover router.

---

## Architecture: Agent = Model + Harness

AXOM formalizes the **Three-Role Capability Seams** pattern from DeepSeek Harness:

```
                   +---------------------------------------+
                   |              Model Layer              |
                   | (Ollama RTX 5060 / Cascading Routers) |
                   +-------------------+-------------------+
                                       |
                                Tool Call Loop
                                       v
+-----------------------------------------------------------------------------------------+
|                                DEEPSEEK HARNESS (dsh)                                   |
|                             Cordis Microkernel (kernel.js)                              |
+-----------------------------------------------------------------------------------------+
|  CONSUMER ROLE                                                                          |
|  - dsh-consumer-tools (Compiles tool calling schemas & dispatches execution)           |
+-----------------------------------------------------------------------------------------+
|  THREE-ROLE CAPABILITY SEAMS (seams.js)                                                 |
|  - MODEL      : chat(), stream()                                                        |
|  - MEMORY     : getProfile(), getVaultKnowledge(), saveMessage()                        |
|  - FILESYSTEM : createFolder(), writeFile(), readFile()                                 |
|  - SANDBOX    : runCode()                                                               |
|  - BROWSER    : searchWeb(), browseUrl()                                                |
|  - SUBAGENTS  : getSubagents(), invoke()                                                |
+-----------------------------------------------------------------------------------------+
|  MODULAR SERVICE PROVIDERS (plugins/)                                                   |
|  - dsh-provider-filesystem (Local workspace & Desktop alias path resolver)              |
|  - dsh-provider-sandbox    (Subprocess code execution with watchdog timer)              |
|  - dsh-provider-memory     (Dual-state SQLite profile facts & Obsidian vault bridge)    |
|  - dsh-provider-browser    (Google search extraction & DOM proxy)                       |
|  - dsh-provider-subagents  (7-persona delegation: Coder, Research, Designer, etc.)     |
|  - dsh-provider-model      (Local GPU neural inference & multi-cloud failover)          |
+-----------------------------------------------------------------------------------------+
```

### Core Capability Seams

| Seam | Invariants & Contract | Concrete Provider |
| :--- | :--- | :--- |
| **`MODEL`** | `chat()`, `stream()` | Local RTX 5060 (Ollama `axom:1.1`) + Cascading Cloud AI |
| **`MEMORY`** | `getProfile()`, `getVaultKnowledge()`, `saveMessage()` | SQLite `user_profile_memory` + Obsidian `Axom_Brain` Vault |
| **`FILESYSTEM`** | `createFolder()`, `writeFile()`, `readFile()` | Desktop & Local Workspace File Resolver |
| **`SANDBOX`** | `runCode()` | Subprocess code runner with 6-second watchdog timer |
| **`BROWSER`** | `searchWeb()`, `browseUrl()` | Google Live Search & DOM content extractor |
| **`SUBAGENTS`** | `getSubagents()`, `invoke()` | 7 Specialized Personas (Coder, Research, Designer, Security, etc.) |

---

## Optimized Directory Structure

```
axom/
├── data/               # SQLite persistent memory & vector indexes
│   └── axom_brain.db   # Living Brain SQLite database
├── harness/            # DeepSeek Harness Core Engine
│   ├── kernel.js       # Cordis HarnessContext microkernel core
│   ├── seams.js        # 3-Role Capability Seams specification
│   ├── plugins/        # Modular service providers & consumer tools
│   │   ├── provider_model.js      # Neural inference provider (Ollama + Cloud)
│   │   ├── provider_memory.js     # Living Brain SQLite + Obsidian bridge
│   │   ├── provider_fs.js         # Filesystem & desktop operations
│   │   ├── provider_sandbox.js    # Subprocess execution sandbox
│   │   ├── provider_browser.js    # Web navigation & Google search
│   │   ├── provider_subagents.js  # 7 specialized personas orchestrator
│   │   └── consumer_tools.js      # Schema compiler & unified dispatcher
│   └── index.js        # Root harness bootstrapper & telemetry
├── skills/             # 76 Craftsmanship engineering & local AI skills
├── scripts/            # AXOM operational scripts
│   ├── optimize.js     # Token & memory optimizer
│   ├── rag_core.py     # Hybrid search core
│   └── test_rag_eval.py# RAG evaluation suite
├── train/              # QLoRA fine-tuning datasets and export scripts
│   ├── axom_alpaca.json
│   ├── axom_sharegpt.jsonl
│   └── export_dataset.js
├── workspace/          # Sandboxed execution directory
├── server.js           # AXOM backend server powered by DeepSeek Harness
├── index.html          # Modern dark glassmorphic web UI with Harness Inspector
├── db.js               # SQLite Living Brain persistence driver
├── obsidian_vault.js   # Obsidian markdown knowledge sync
├── subagents.js        # Autonomous specialized personas engine
├── browser_service.js  # Live web navigation & Google search extractor
├── local_tools.js      # Desktop & filesystem agentic execution tools
├── ai_providers.js     # Multi-tier cascading cloud failover router
├── free_apis_service.js# 14 Free AI APIs hub
├── rag_service.js      # Semantic document retrieval studio
├── test_suite.ps1      # End-to-end verification test suite
├── Start_AXOM.bat      # One-click launcher
└── Stop_AXOM.bat       # Shutdown utility
```

---

## Hardware & System Profile

- **Operating System:** Windows 11 Home / Pro
- **Hardware:** HP OMEN Gaming Laptop
- **GPU Acceleration:** NVIDIA GeForce RTX 5060 Laptop GPU (8GB VRAM, Blackwell Architecture)
- **Local Model:** `axom:1.1` (based on Qwen 3.5 4B Uncensored, Q4_K_M quantization)
- **Inference Speed:** ~85–100+ tokens/second on RTX 5060

---

## Quick Start

### 1. Launch AXOM
Double-click `Start_AXOM.bat` or run:
```powershell
node server.js
```
The server will start at `http://127.0.0.1:8000`.

### 2. Open in Browser
Navigate to `http://127.0.0.1:8000`.

### 3. Inspect DeepSeek Harness Architecture
Press `Ctrl + K` in the web interface and select **"DeepSeek Harness: Microkernel & Seams Inspector"** to view real-time status of all capability seams and mounted plugins.

### 4. Run Verification Suite
```powershell
powershell -ExecutionPolicy Bypass -File test_suite.ps1
```

---

## License

[MIT](LICENSE)
