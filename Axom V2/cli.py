import sys
import os
import time
from pathlib import Path

import config
from rag_engine import RAGEngine
import ingest
import tools

def print_banner():
    print("=" * 64)
    print(" AXOM V2 — LOCAL COGNITIVE ENHANCEMENT SUITE")
    print("=" * 64)
    print(f" LLM Model:         {config.LLM_MODEL} (Qwen 3.5 4B Uncensored)")
    print(f" Context Window:    {config.NUM_CTX:,} tokens (Safe 16k expansion)")
    print(f" Vector Database:   LanceDB (Table: '{config.TABLE_NAME}')")
    print(f" Embedding Engine:  {config.EMBEDDING_MODEL} (1,024 dimensions)")
    print(f" Hardware Profile:  NVIDIA GeForce RTX 5060 (8GB VRAM) / AMD Ryzen 9")
    print("=" * 64)
    print(" Commands: /ingest (Index docs) | /docs (List docs) | /clear | /exit")
    print("=" * 64 + "\n")

def main():
    print_banner()
    rag = RAGEngine()
    chat_history = []

    # Check if index exists; if not, trigger initial scan
    table = rag._get_table()
    if not table:
        print("[INIT] LanceDB table not found. Ingesting documents in docs/...")
        ingest.ingest_directory()
        rag._table = None # Reset table cache

    while True:
        try:
            prompt = input("\nUser > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting Axom V2.")
            break

        if not prompt:
            continue

        cmd = prompt.lower()
        if cmd in ("/exit", "/quit"):
            print("Exiting Axom V2.")
            break
        elif cmd == "/clear":
            chat_history.clear()
            print("[STATE] Chat session history cleared.")
            continue
        elif cmd == "/ingest":
            print("[ACTION] Re-indexing documents...")
            ingest.ingest_directory()
            rag._table = None
            continue
        elif cmd == "/docs":
            docs = list(config.DOCS_DIR.glob("*"))
            print(f"\n[DOCS] {len(docs)} file(s) in {config.DOCS_DIR.resolve()}:")
            for d in docs:
                if d.is_file():
                    print(f" - {d.name} ({d.stat().st_size} bytes)")
            continue

        # Check for tool intent (e.g. calculation)
        if prompt.startswith("/calc "):
            expr = prompt[6:].strip()
            res = tools.dispatch_tool("calculate", expression=expr)
            print(f"[TOOL: calculate] {expr} = {res}")
            continue

        # Execute RAG query
        print("\nRetrieving knowledge & generating response...\n")
        try:
            chunks = rag.search(prompt, top_k=config.TOP_K_RETRIEVAL)
            if chunks:
                print("--- Retrieved Citations ---")
                for c in chunks:
                    print(f" * {c['citation_tag']} (Relevance: {c['score']})")
                print("---------------------------\n")

            print("Axom V2 > ", end="", flush=True)

            in_think = False
            full_response = ""

            for chunk_data in rag.query(prompt, chat_history=chat_history, stream=True):
                if chunk_data.get("type") == "token":
                    token = chunk_data.get("token", "")
                    full_response += token
                    
                    # Highlight <think> tags if desired
                    if "<think>" in token:
                        in_think = True
                    sys.stdout.write(token)
                    sys.stdout.flush()
                    if "</think>" in token:
                        in_think = False

            sys.stdout.write("\n")
            chat_history.append({"role": "user", "content": prompt})
            chat_history.append({"role": "assistant", "content": full_response})

        except Exception as e:
            print(f"\n[ERR] Query failed: {e}")

if __name__ == "__main__":
    main()
