# Axom V2: Local Enhancement Architecture

Axom V2 is a self-contained local AI intelligence wrapper designed to elevate model accuracy, depth of reasoning, and factual grounding without requiring parameter fine-tuning.

---

## 1. System Components

```
Axom V2/
├── config.py             # Runtime and hardware configuration parameters
├── system_prompt.txt     # Chain-of-Thought and anti-hallucination contract
├── ingest.py             # Document parser, semantic chunker, and local vector embedder
├── rag_engine.py         # Vector similarity retrieval and prompt context assembly
├── tools.py              # Local tools: file I/O and sandboxed Python calculations
├── cli.py                # Streaming interactive terminal interface with citation chips
├── app.py                # Standalone local web interface (http://127.0.0.1:8088)
├── docs/                 # Drop-in local knowledge base (PDF, Markdown, TXT, Code)
└── data/lancedb/         # Embedded serverless vector storage
```

---

## 2. Hardware Allocation (RTX 5060 8GB VRAM)

* **LLM Engine**: `axom:1.1` (Qwen 3.5 4.2B, Q4_K_M quantization).
  * Static weight footprint: ~2.7 GB VRAM.
  * Context Window: Expanded from 2,048 tokens to **16,384 tokens (16k)**.
  * KV Cache footprint: ~1.2 GB VRAM.
  * Headroom: ~4.1 GB VRAM remaining for Windows display and OS operations.
* **Embedding Engine**: `qwen3-embedding:0.6b` (Q8_0 quantization).
  * Dimension: 1,024 vector coordinates.
  * Speed: Sub-50ms batch embedding per chunk locally via Ollama `/api/embed`.
* **Vector Database**: LanceDB (embedded, disk-backed, zero background daemon overhead).

---

## 3. Grounding & Anti-Hallucination Pipeline

1. **Ingestion**:
   * Reads `.pdf` (via `pypdf`), `.md`, `.txt`, `.csv`, `.json`, and code files (`.py`, `.rs`, `.js`, etc.).
   * Splits into 900-character semantic chunks with 150-character overlap.
   * Embeds chunks via local `qwen3-embedding:0.6b` and stores them in `data/lancedb/`.
2. **Retrieval**:
   * Incoming user queries are embedded in real time.
   * Cosine distance query against LanceDB identifies the top-4 most relevant chunks.
   * Injected into prompt as structured context with unique identifiers: `[doc:filename#chunk_index]`.
3. **Reasoning & Synthesis**:
   * The model undergoes a 2-stage generation:
     * **Phase 1 (`<think>...</think>`)**: Internal reasoning, verifying facts, mapping citations.
     * **Phase 2 (Final Answer)**: Professional output with clickable/verifiable citation tags and zero emojis.

---

## 4. Local Tools

* `read_file(path)`: Safely inspects files in the workspace or `docs/`.
* `write_file(path, content)`: Creates or updates local files deterministically.
* `list_files(directory)`: Explores directory hierarchies.
* `execute_python(code)`: Executes Python calculations, math proofs, or data manipulations in a clean sandboxed runner.
