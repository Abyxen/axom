import os
import sys
import time
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any

import requests
import pyarrow as pa
import lancedb

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

import config

def get_file_hash(filepath: Path) -> str:
    """Calculate SHA256 hash of a file for cache tracking."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def extract_text_from_file(filepath: Path) -> str:
    """Extract clean text content from supported file formats."""
    suffix = filepath.suffix.lower()
    
    if suffix == ".pdf":
        if not PdfReader:
            print(f"[WARN] pypdf not installed, skipping PDF: {filepath.name}")
            return ""
        try:
            reader = PdfReader(str(filepath))
            pages = []
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(f"--- Page {idx + 1} ---\n{text.strip()}")
            return "\n\n".join(pages)
        except Exception as e:
            print(f"[ERR] Failed to parse PDF {filepath.name}: {e}")
            return ""
            
    # Text, Markdown, Code, Data
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        print(f"[ERR] Failed to read {filepath.name}: {e}")
        return ""

def recursive_chunk_text(text: str, chunk_size: int = config.CHUNK_SIZE, overlap: int = config.CHUNK_OVERLAP) -> List[str]:
    """Split text recursively on natural semantic boundaries."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    separators = ["\n## ", "\n### ", "\n\n", "\n", ". ", " "]
    
    def split_with_sep(content: str, sep: str) -> List[str]:
        parts = content.split(sep)
        chunks = []
        current = ""
        
        for part in parts:
            candidate = current + (sep if current else "") + part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    chunks.append(current.strip())
                current = part
        if current:
            chunks.append(current.strip())
        return chunks

    chunks = [text]
    for sep in separators:
        new_chunks = []
        for c in chunks:
            if len(c) > chunk_size:
                new_chunks.extend(split_with_sep(c, sep))
            else:
                new_chunks.append(c)
        chunks = new_chunks
        if all(len(c) <= chunk_size * 1.25 for c in chunks):
            break

    # Apply overlap smoothing
    final_chunks = []
    for i, c in enumerate(chunks):
        if not c:
            continue
        if i > 0 and overlap > 0 and len(final_chunks) > 0:
            overlap_prefix = final_chunks[-1][-overlap:]
            c = overlap_prefix + " ... " + c
        final_chunks.append(c)

    return final_chunks

def get_ollama_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate dense embeddings via local Ollama API."""
    if not texts:
        return []
        
    url = f"{config.OLLAMA_BASE_URL}/api/embed"
    batch_size = 32
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        payload = {
            "model": config.EMBEDDING_MODEL,
            "input": batch
        }
        try:
            res = requests.post(url, json=payload, timeout=90)
            res.raise_for_status()
            data = res.json()
            embeddings = data.get("embeddings", [])
            if len(embeddings) != len(batch):
                raise ValueError(f"Expected {len(batch)} embeddings, got {len(embeddings)}")
            all_embeddings.extend(embeddings)
        except Exception as e:
            print(f"[ERR] Embedding generation failed: {e}")
            raise
            
    return all_embeddings

def build_schema() -> pa.Schema:
    """Define Arrow schema for LanceDB table."""
    return pa.schema([
        pa.field("id", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), config.EMBEDDING_DIM)),
        pa.field("text", pa.string()),
        pa.field("filename", pa.string()),
        pa.field("source", pa.string()),
        pa.field("chunk_index", pa.int32()),
        pa.field("total_chunks", pa.int32()),
        pa.field("char_count", pa.int32()),
        pa.field("created_at", pa.string()),
    ])

def ingest_directory(docs_dir: Path = config.DOCS_DIR) -> Dict[str, Any]:
    """Ingest, chunk, embed, and store all documents in docs_dir."""
    start_time = time.time()
    supported_extensions = {
        ".pdf", ".md", ".markdown", ".txt", ".csv", ".json",
        ".py", ".rs", ".js", ".ts", ".html", ".css", ".sql", ".sh", ".bat", ".ps1"
    }

    print(f"\n[INGEST] Scanning {docs_dir.resolve()}...")
    files = [f for f in docs_dir.rglob("*") if f.is_file() and f.suffix.lower() in supported_extensions]

    if not files:
        print("[INGEST] No supported documents found. Add PDFs, Markdown, TXT, or code files to docs/.")
        return {"status": "empty", "files_count": 0, "chunks_count": 0}

    print(f"[INGEST] Found {len(files)} document(s) to process.")

    chunks_data = []
    for filepath in files:
        rel_path = filepath.relative_to(docs_dir).as_posix()
        text = extract_text_from_file(filepath)
        if not text.strip():
            continue

        raw_chunks = recursive_chunk_text(text)
        total_chunks = len(raw_chunks)
        print(f" -> {rel_path}: {len(text)} chars | {total_chunks} chunks")

        for idx, chunk_text in enumerate(raw_chunks):
            chunk_id = f"{filepath.stem}_{idx}"
            chunks_data.append({
                "id": chunk_id,
                "text": chunk_text,
                "filename": filepath.name,
                "source": rel_path,
                "chunk_index": idx,
                "total_chunks": total_chunks,
                "char_count": len(chunk_text),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })

    if not chunks_data:
        print("[INGEST] No valid text content extracted from documents.")
        return {"status": "no_content", "files_count": len(files), "chunks_count": 0}

    print(f"\n[INGEST] Generating embeddings for {len(chunks_data)} chunks using {config.EMBEDDING_MODEL}...")
    texts = [c["text"] for c in chunks_data]
    embeddings = get_ollama_embeddings(texts)

    for i, emb in enumerate(embeddings):
        chunks_data[i]["vector"] = emb

    # Connect to LanceDB and create/replace table
    db = lancedb.connect(str(config.LANCEDB_DIR))
    schema = build_schema()

    existing_tables = list(db.list_tables()) if hasattr(db, "list_tables") else db.table_names()
    if config.TABLE_NAME in existing_tables:
        db.drop_table(config.TABLE_NAME)

    table = db.create_table(config.TABLE_NAME, data=chunks_data, schema=schema)
    elapsed = time.time() - start_time

    print(f"\n[INGEST] Completed successfully in {elapsed:.2f}s!")
    print(f" -> Indexed: {len(files)} files, {len(chunks_data)} chunks into LanceDB table '{config.TABLE_NAME}'")

    return {
        "status": "success",
        "files_count": len(files),
        "chunks_count": len(chunks_data),
        "elapsed_seconds": round(elapsed, 2)
    }

if __name__ == "__main__":
    ingest_directory()
