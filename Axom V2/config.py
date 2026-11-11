import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = BASE_DIR / "docs"
DATA_DIR = BASE_DIR / "data"
LANCEDB_DIR = DATA_DIR / "lancedb"

# Ensure essential directories exist
DOCS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
LANCEDB_DIR.mkdir(parents=True, exist_ok=True)

# Ollama Runtime Settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "axom:1.1")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen3-embedding:0.6b")
EMBEDDING_DIM = 1024

# Optimized Hardware Inference Parameters (Tailored for RTX 5060 8GB VRAM)
# 16,384 tokens safe context expansion (consuming ~1.2 GB VRAM for KV cache)
NUM_CTX = 16384
TEMPERATURE = 0.3
TOP_P = 0.90
REPEAT_PENALTY = 1.10
TOP_K = 40

# RAG / Vector Settings
TABLE_NAME = "knowledge_chunks"
CHUNK_SIZE = 900          # Characters per chunk (~200 tokens)
CHUNK_OVERLAP = 150       # Characters overlap
TOP_K_RETRIEVAL = 4       # Top relevant chunks injected into prompt
SIMILARITY_THRESHOLD = 0.30

# Web Server Settings
WEB_HOST = "127.0.0.1"
WEB_PORT = 8088
