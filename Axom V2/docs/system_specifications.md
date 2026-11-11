# Host System Hardware Specifications

## Hardware Inventory
- **Host GPU**: NVIDIA GeForce RTX 5060 Laptop GPU
  - Dedicated VRAM: 8,151 MiB (~8 GB GDDR7)
  - Driver Version: 621.01
  - CUDA Capability: CUDA 13.5
  - Memory Bandwidth: High-speed GDDR7 memory bus
- **Host CPU**: AMD Ryzen 9 8940HX
  - Physical Cores: 16 Cores
  - Logical Processors: 32 Threads
  - Base / Boost Clocks: Up to 5.2 GHz high-performance computing
- **System Memory**: 32 GB Physical DDR5 RAM (approximately 19.5 GB free for operating workloads)
- **Operating Environment**: Microsoft Windows 11 64-bit

## VRAM Allocation Budget
- Base OS and display overhead: ~800 MB
- `axom:1.1` Model Weights (4.2B Q4_K_M): ~2,700 MB
- 16,384 Token KV Cache (`num_ctx = 16384`): ~1,200 MB
- `qwen3-embedding:0.6b` Embedding Weights: ~600 MB
- Remaining Safety Headroom: ~2,800 MB (prevents VRAM spillover to system memory)

This hardware configuration allows 100% of LLM operations, vector operations, and embeddings to execute strictly on the local GPU with zero disk paging or RAM offloading.
