# Axom Local Architecture Specification

## Overview
Axom is a fully local, privacy-first AI intelligence engine designed to operate completely offline without external cloud dependencies. Axom combines local quantized LLM inference with retrieval-augmented generation (RAG) and local tool dispatch.

## Core System Components
1. **Primary Model Runtime**: Axom utilizes `axom:1.1`, a 4.2-billion parameter model quantized with Q4_K_M precision (2.7 GB disk footprint). It is orchestrated through Ollama on local port 11434.
2. **Hardware Acceleration**: Full GPU offloading on the NVIDIA GeForce RTX 5060 Laptop GPU (8GB GDDR7 VRAM, CUDA 13.5). The model fits entirely in VRAM with an expanded 16,384 token context window (`num_ctx = 16384`), utilizing approximately 1.2 GB of VRAM for KV cache.
3. **Retrieval Engine**: LanceDB vector database storing Arrow-columnar embeddings. LanceDB executes zero-server in-process vector searches using cosine metric distance.
4. **Local Embedding Model**: `qwen3-embedding:0.6b` running locally via Ollama generating 1,024-dimensional dense vectors.
5. **Tool Dispatch Engine**: Sandboxed local execution capabilities including safe file reading, file modification, directory traversal, scientific math evaluation, and Python script execution.

## Inference Parameters
- Temperature: 0.3 (deterministic, focused reasoning)
- Top-P: 0.90
- Repetition Penalty: 1.10
- Top-K: 40
- Context Window: 16,384 tokens

## Chain-of-Thought Reasoning
Axom enforces structured reasoning using `<think>` and `</think>` tags before emitting the final answer. Inside the think block, Axom analyzes the user query, evaluates retrieved context, detects missing facts, and outlines verified assertions before composing the output.
