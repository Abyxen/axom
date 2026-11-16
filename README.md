# DeepSeek Harness + AXOM

English | [中文](README.zh.md)

**DeepSeek Harness (`dsh`)** is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com), rebuilt with **AXOM Independent Intelligence** — an autonomous neural workspace with Living Brain SQLite & Obsidian persistence, local NVIDIA RTX 5060 GPU acceleration, and multi-tier cascading cloud failover.

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

---

## Architecture: Agent = Model + Harness

DeepSeek Harness formalizes the **Three-Role Pattern**:
1. **Service Definition (Capability Seams)**: Interface invariants and contract validation (`MODEL`, `MEMORY`, `FILESYSTEM`, `SANDBOX`, `BROWSER`, `SUBAGENTS`).
2. **Service Providers (`dsh-provider-*`)**: Concrete implementations across local RTX 5060 Ollama, SQLite living brain memory, Obsidian markdown vault, and subprocess sandboxes.
3. **Consumer (`dsh-consumer-tools`)**: Dynamic schema compiler and unified tool execution dispatcher.

### Core Capability Seams

| Seam | Interface Contract | Concrete Provider |
|---|---|---|
| `MODEL` | `chat()`, `stream()` | Local RTX 5060 (Ollama `axom:1.1`) + Cascading Cloud Router |
| `MEMORY` | `getProfile()`, `getVaultKnowledge()`, `saveMessage()` | SQLite `user_profile_memory` + Obsidian `Axom_Brain` vault |
| `FILESYSTEM` | `createFolder()`, `writeFile()`, `readFile()` | Local Desktop & Workspace Path Resolver |
| `SANDBOX` | `runCode()` | Subprocess Execution with 6-second watchdog timer |
| `BROWSER` | `searchWeb()`, `browseUrl()` | Google Live Search & DOM Text Extractor |
| `SUBAGENTS` | `getSubagents()`, `invoke()` | 7 Specialized Personas (Coder, Research, Designer, Security, etc.) |

---

## Run

### Run DeepSeek Harness Web UI
```sh
pnpm dsh web
```
The command starts the Web UI at `http://127.0.0.1:3080` by default.

### Run AXOM Autonomous Server
```sh
npm run axom:server
```
Starts the AXOM Living Brain backend at `http://127.0.0.1:8000` with real-time agentic tool calling and SQLite profile memory.

### Run Tests
```powershell
powershell -ExecutionPolicy Bypass -File test_suite.ps1
```

---

## Repository Structure

```
├── apps/               # Web, CLI, and Desktop applications
│   ├── cli/            # dsh CLI executable
│   ├── desktop/        # Electron desktop client
│   └── web/            # Browser frontend
├── packages/           # Monorepo modular capability packages
│   ├── core/           # Agent loop, session, tools, system-prompt
│   ├── llm/            # LLM streaming adapters & provider interfaces
│   ├── fs/             # Filesystem seams and guard rails
│   ├── browser-use/    # Web navigation and DOM automation
│   ├── sandbox/        # Subprocess and container execution
│   ├── subagent/       # Multi-agent persona orchestration
│   ├── skill/          # Skill system and prompt injections
│   ├── mcp/            # Model Context Protocol client
│   └── storage/        # Persistence and session storage
├── harness/            # Cordis microkernel integration & capability seams
│   ├── kernel.js       # Cordis HarnessContext microkernel core
│   ├── seams.js        # 3-Role Capability Seams specification
│   ├── plugins/        # Modular service providers & consumer tools
│   └── index.js        # Harness bootstrapper & telemetry
├── skills/             # 76 indexed engineering craftsmanship skills
├── server.js           # AXOM backend server wired into DeepSeek Harness
├── index.html          # Dark glassmorphic interface with Harness Inspector
└── test_suite.ps1      # End-to-end verification test suite
```

---

## License

[MIT](LICENSE)
