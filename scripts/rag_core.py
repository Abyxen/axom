#!/usr/bin/env python3
"""
AXOM High-Accuracy RAG Core Engine
Combines Dense Vector Search (LanceDB + Ollama Qwen Embeddings) with
BM25/Lexical Keyword Re-ranking for Maximum Document Retrieval Accuracy.
"""

import os
import sys
import json
import time
import re
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

import requests
import pyarrow as pa
import lancedb

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

# Base Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT_DIR / "data" / "rag_docs"
LANCEDB_DIR = ROOT_DIR / "data" / "rag_lancedb"
INDEX_META_PATH = ROOT_DIR / "data" / "rag_index_meta.json"

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "qwen3-embedding:0.6b")
EMBED_DIM = 1024
TABLE_NAME = "rag_knowledge_chunks"
CHUNK_SIZE = 650
CHUNK_OVERLAP = 120

def ensure_dirs():
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)

def get_file_hash(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def extract_text_from_file(filepath: Path) -> List[Dict[str, Any]]:
    """Extract text from supported files, preserving page numbers for PDFs."""
    suffix = filepath.suffix.lower()
    sections = []
    
    if suffix == ".pdf":
        if not PdfReader:
            print(f"[WARN] pypdf not installed, cannot read {filepath.name}", file=sys.stderr)
            return []
        try:
            reader = PdfReader(str(filepath))
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text() or ""
                txt = txt.strip()
                if txt:
                    sections.append({
                        "page_number": idx + 1,
                        "text": txt
                    })
        except Exception as e:
            print(f"[ERR] Failed to parse PDF {filepath.name}: {e}", file=sys.stderr)
            return []
    else:
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                content = f.read().strip()
                if content:
                    sections.append({
                        "page_number": 1,
                        "text": content
                    })
        except Exception as e:
            print(f"[ERR] Failed to read text file {filepath.name}: {e}", file=sys.stderr)
            return []
            
    return sections

def recursive_chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Recursively split text on natural markdown/paragraph/sentence boundaries."""
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    separators = ["\n# ", "\n## ", "\n### ", "\n\n", "\n", ". ", "? ", "! ", " "]
    
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
        if all(len(c) <= chunk_size * 1.3 for c in chunks):
            break

    # Apply overlap smoothing
    final_chunks = []
    for i, c in enumerate(chunks):
        if not c:
            continue
        if i > 0 and overlap > 0 and len(final_chunks) > 0:
            tail = final_chunks[-1][-overlap:]
            smoothed = tail + " " + c
            final_chunks.append(smoothed[:int(chunk_size * 1.3)])
        else:
            final_chunks.append(c)

    return final_chunks

def get_ollama_embeddings(texts: List[str], batch_size: int = 16) -> List[List[float]]:
    """Embed texts via Ollama /api/embed."""
    all_embeddings = []
    url = f"{OLLAMA_BASE_URL}/api/embed"
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        payload = {
            "model": EMBEDDING_MODEL,
            "input": batch
        }
        res = requests.post(url, json=payload, timeout=90)
        res.raise_for_status()
        data = res.json()
        embeddings = data.get("embeddings", [])
        if len(embeddings) != len(batch):
            raise ValueError(f"Expected {len(batch)} embeddings, got {len(embeddings)}")
        all_embeddings.extend(embeddings)
        
    return all_embeddings

def get_query_embedding(query: str) -> List[float]:
    embeddings = get_ollama_embeddings([query], batch_size=1)
    if not embeddings:
        raise ValueError("Could not embed query")
    return embeddings[0]

def ingest_all():
    """Ingest and index all documents in data/rag_docs."""
    ensure_dirs()
    t0 = time.time()
    
    supported_exts = {".pdf", ".md", ".txt", ".json", ".csv", ".py", ".js", ".ts", ".rs", ".html", ".css", ".yaml", ".yml"}
    doc_files = [f for f in DOCS_DIR.iterdir() if f.is_file() and f.suffix.lower() in supported_exts]
    
    if not doc_files:
        # Empty docs directory - create empty table if needed
        db = lancedb.connect(str(LANCEDB_DIR))
        schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("filename", pa.string()),
            pa.field("chunk_index", pa.int32()),
            pa.field("page_number", pa.int32()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
        ])
        db.create_table(TABLE_NAME, schema=schema, mode="overwrite")
        with open(INDEX_META_PATH, "w", encoding="utf-8") as f:
            json.dump({"total_documents": 0, "total_chunks": 0, "documents": []}, f, indent=2)
            
        print(json.dumps({
            "success": True,
            "total_documents": 0,
            "total_chunks": 0,
            "elapsed_seconds": round(time.time() - t0, 2),
            "message": "Knowledge base initialized (0 documents found in data/rag_docs)."
        }))
        return

    all_chunks_data = []
    doc_metadata_list = []
    
    for doc in doc_files:
        sections = extract_text_from_file(doc)
        doc_chunks = []
        chunk_idx = 0
        
        for sec in sections:
            page_no = sec["page_number"]
            raw_text = sec["text"]
            text_splits = recursive_chunk_text(raw_text)
            
            for piece in text_splits:
                piece_clean = piece.strip()
                if not piece_clean:
                    continue
                chunk_id = f"{doc.name}#c{chunk_idx}"
                doc_chunks.append({
                    "id": chunk_id,
                    "filename": doc.name,
                    "chunk_index": chunk_idx,
                    "page_number": page_no,
                    "text": piece_clean
                })
                chunk_idx += 1
                
        if doc_chunks:
            all_chunks_data.extend(doc_chunks)
            doc_metadata_list.append({
                "filename": doc.name,
                "size_bytes": doc.stat().st_size,
                "chunks_count": len(doc_chunks),
                "last_modified": doc.stat().st_mtime
            })

    if not all_chunks_data:
        print(json.dumps({
            "success": True,
            "total_documents": len(doc_files),
            "total_chunks": 0,
            "elapsed_seconds": round(time.time() - t0, 2),
            "message": "No text content found in documents to index."
        }))
        return

    # Generate Embeddings
    texts_to_embed = [item["text"] for item in all_chunks_data]
    embeddings = get_ollama_embeddings(texts_to_embed)
    
    # LanceDB Table creation
    rows = []
    for item, vec in zip(all_chunks_data, embeddings):
        rows.append({
            "id": item["id"],
            "filename": item["filename"],
            "chunk_index": item["chunk_index"],
            "page_number": item["page_number"],
            "text": item["text"],
            "vector": vec
        })

    db = lancedb.connect(str(LANCEDB_DIR))
    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("filename", pa.string()),
        pa.field("chunk_index", pa.int32()),
        pa.field("page_number", pa.int32()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
    ])
    table = db.create_table(TABLE_NAME, data=rows, schema=schema, mode="overwrite")

    # Save metadata summary
    meta = {
        "total_documents": len(doc_metadata_list),
        "total_chunks": len(rows),
        "documents": doc_metadata_list,
        "last_indexed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }
    with open(INDEX_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(json.dumps({
        "success": True,
        "total_documents": len(doc_metadata_list),
        "total_chunks": len(rows),
        "elapsed_seconds": round(time.time() - t0, 2),
        "documents": doc_metadata_list
    }))

def calculate_bm25_lexical_score(query: str, text: str) -> float:
    """Calculate normalized token-level keyword match score with phrase bonus."""
    q_tokens = [w for w in re.findall(r'\b\w+\b', query.lower()) if len(w) > 2]
    if not q_tokens:
        return 0.0
        
    t_lower = text.lower()
    matches = 0
    for tok in q_tokens:
        if tok in t_lower:
            matches += 1
            
    ratio = matches / len(q_tokens)
    # Exact multi-word phrase bonus
    if len(q_tokens) > 1 and query.lower() in t_lower:
        ratio = min(1.0, ratio + 0.35)
    return round(ratio, 3)

def search_chunks(query: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Hybrid search combining LanceDB dense vector similarity with lexical matching."""
    ensure_dirs()
    db = lancedb.connect(str(LANCEDB_DIR))
    existing_tables = list(db.list_tables()) if hasattr(db, "list_tables") else db.table_names()
    if TABLE_NAME not in existing_tables:
        return []

    table = db.open_table(TABLE_NAME)
    query_vec = get_query_embedding(query)
    
    # Over-fetch candidates for hybrid re-ranking
    candidates = table.search(query_vec).limit(top_k * 3).to_list()
    if not candidates:
        return []

    scored_results = []
    for cand in candidates:
        # Distance is cosine/L2; normalize distance to [0, 1]
        dist = cand.get("_distance", 1.0)
        vec_score = max(0.0, 1.0 - (dist / 2.0))
        lex_score = calculate_bm25_lexical_score(query, cand["text"])
        
        # Hybrid formula: 65% dense semantic vector + 35% exact keyword match
        hybrid_score = round((0.65 * vec_score) + (0.35 * lex_score), 3)
        
        scored_results.append({
            "id": cand["id"],
            "filename": cand["filename"],
            "chunk_index": cand["chunk_index"],
            "page_number": cand.get("page_number", 1),
            "text": cand["text"],
            "score": hybrid_score,
            "vector_score": round(vec_score, 3),
            "lexical_score": round(lex_score, 3),
            "citation_tag": f"[doc:{cand['filename']}#{cand['chunk_index']}]"
        })

    # Sort descending by hybrid_score
    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return scored_results[:top_k]

def list_documents() -> Dict[str, Any]:
    ensure_dirs()
    if INDEX_META_PATH.exists():
        try:
            with open(INDEX_META_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    doc_files = [f for f in DOCS_DIR.iterdir() if f.is_file()]
    return {
        "total_documents": len(doc_files),
        "total_chunks": 0,
        "documents": [{"filename": f.name, "size_bytes": f.stat().st_size} for f in doc_files]
    }

def main():
    parser = argparse.ArgumentParser(description="AXOM RAG Core Engine")
    parser.add_argument("--ingest", action="store_true", help="Ingest all files in data/rag_docs")
    parser.add_argument("--search", type=str, help="Search query")
    parser.add_argument("--top-k", type=int, default=4, help="Top K results")
    parser.add_argument("--list", action="store_true", help="List indexed documents")
    
    args = parser.parse_args()
    
    if args.ingest:
        ingest_all()
    elif args.search:
        results = search_chunks(args.search, top_k=args.top_k)
        print(json.dumps(results, indent=2))
    elif args.list:
        docs = list_documents()
        print(json.dumps(docs, indent=2))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
