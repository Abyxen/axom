import json
from pathlib import Path
from typing import List, Dict, Any, Generator, Optional

import requests
import lancedb

import config

class RAGEngine:
    def __init__(self):
        self.db_dir = str(config.LANCEDB_DIR)
        self.table_name = config.TABLE_NAME
        self.system_prompt_path = config.BASE_DIR / "system_prompt.txt"
        self._table = None
        self._load_system_prompt()

    def _load_system_prompt(self):
        if self.system_prompt_path.exists():
            with open(self.system_prompt_path, "r", encoding="utf-8") as f:
                self.system_prompt = f.read().strip()
        else:
            self.system_prompt = (
                "You are Axom V2, a local cognitive AI. Perform reasoning in <think>...</think> tags. "
                "Cite all facts from local documents as [doc:filename#chunk_id]. Zero-emoji policy."
            )

    def _get_table(self):
        if self._table is None:
            db = lancedb.connect(self.db_dir)
            existing_tables = list(db.list_tables()) if hasattr(db, "list_tables") else db.table_names()
            if self.table_name in existing_tables:
                self._table = db.open_table(self.table_name)
            else:
                self._table = None
        return self._table

    def embed_query(self, query: str) -> List[float]:
        """Embed user query via local Ollama embedding endpoint."""
        url = f"{config.OLLAMA_BASE_URL}/api/embed"
        payload = {
            "model": config.EMBEDDING_MODEL,
            "input": query
        }
        res = requests.post(url, json=payload, timeout=30)
        res.raise_for_status()
        data = res.json()
        embeddings = data.get("embeddings", [])
        if not embeddings:
            raise ValueError("No embeddings returned by Ollama.")
        return embeddings[0]

    def search(self, query: str, top_k: int = config.TOP_K_RETRIEVAL) -> List[Dict[str, Any]]:
        """Retrieve top-k relevant document chunks from LanceDB."""
        table = self._get_table()
        if not table:
            return []

        try:
            query_vector = self.embed_query(query)
            # LanceDB vector similarity search
            results = table.search(query_vector).limit(top_k).to_list()
            
            formatted = []
            for r in results:
                # LanceDB distance is typically L2 or cosine distance; convert to relevance score
                distance = r.get("_distance", 0.0)
                score = max(0.0, 1.0 - (distance / 2.0))
                
                formatted.append({
                    "id": r["id"],
                    "filename": r["filename"],
                    "source": r["source"],
                    "chunk_index": r["chunk_index"],
                    "text": r["text"],
                    "score": round(score, 3),
                    "citation_tag": f"[doc:{r['filename']}#{r['chunk_index']}]"
                })
            return formatted
        except Exception as e:
            print(f"[RAG] Search error: {e}")
            return []

    def format_context_block(self, chunks: List[Dict[str, Any]]) -> str:
        """Assemble retrieved chunks into a clean, numbered context prompt."""
        if not chunks:
            return "NO RELEVANT LOCAL DOCUMENTS FOUND IN KNOWLEDGE BASE."

        lines = ["# LOCAL KNOWLEDGE BASE (GROUNDING CONTEXT):"]
        for idx, chunk in enumerate(chunks, 1):
            tag = chunk["citation_tag"]
            lines.append(f"--- Document Source {idx}: {tag} (Relevance: {chunk['score']}) ---")
            lines.append(chunk["text"])
            lines.append("")
        return "\n".join(lines)

    def query(
        self,
        prompt: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = config.TOP_K_RETRIEVAL,
        stream: bool = False
    ) -> Any:
        """Full RAG execution: search, context assembly, and LLM query."""
        chunks = self.search(prompt, top_k=top_k)
        context_block = self.format_context_block(chunks)

        full_system_prompt = f"{self.system_prompt}\n\n{context_block}"

        messages = [{"role": "system", "content": full_system_prompt}]
        if chat_history:
            messages.extend(chat_history[-6:])
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": config.LLM_MODEL,
            "messages": messages,
            "stream": stream,
            "options": {
                "num_ctx": config.NUM_CTX,
                "temperature": config.TEMPERATURE,
                "top_p": config.TOP_P,
                "repeat_penalty": config.REPEAT_PENALTY,
                "top_k": config.TOP_K
            }
        }

        url = f"{config.OLLAMA_BASE_URL}/api/chat"

        if stream:
            return self._stream_response(url, payload, chunks)
        else:
            res = requests.post(url, json=payload, timeout=120)
            res.raise_for_status()
            data = res.json()
            raw_content = data.get("message", {}).get("content", "")
            return {
                "content": raw_content,
                "citations": chunks,
                "model": config.LLM_MODEL,
                "context_chunks_count": len(chunks)
            }

    def _stream_response(self, url: str, payload: dict, chunks: List[Dict[str, Any]]) -> Generator[Dict[str, Any], None, None]:
        """Stream chunks from Ollama with real-time token yielding."""
        yield {"type": "metadata", "citations": chunks}

        with requests.post(url, json=payload, stream=True, timeout=120) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if line:
                    chunk_json = json.loads(line.decode("utf-8"))
                    token = chunk_json.get("message", {}).get("content", "")
                    done = chunk_json.get("done", False)
                    yield {"type": "token", "token": token, "done": done}
                    if done:
                        break
