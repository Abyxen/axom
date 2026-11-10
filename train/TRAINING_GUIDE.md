# 🧠 AXOM v1.2 Neural Weight Training Guide

This guide prepares you for tomorrow's training session to evolve **AXOM v1.1** into **AXOM v1.2**.

---

## 🎯 What Training Does
Training bakes your actual conversational history, coding style, developer preferences, zero-emoji formatting rules, and permanent memories directly into the neural weights of the model.

- **Current Model**: `axom:1.1` (Base Qwen 3.5 4B + living SQLite/Obsidian context)
- **Target Model**: `axom:1.2` (Fine-tuned QLoRA with baked-in knowledge + visual vision capabilities)

---

## 📂 Step 1: Export Fresh Conversation Data
Before you begin training tomorrow, run this command in terminal to export the very latest memories and chats from SQLite:

```bash
node train/export_dataset.js
```

This updates:
- `train/axom_alpaca.json`
- `train/axom_sharegpt.jsonl`

---

## 🚀 Step 2: Choose Your Training Environment

### Option A: Free Google Colab (Recommended & Easiest)
You can train in about 5 minutes using a free Google Colab T4 GPU:

1. Open [Google Colab](https://colab.research.google.com/) and create a new notebook.
2. In Colab menu: click **Runtime ➔ Change runtime type ➔ T4 GPU**.
3. Install Unsloth:
   ```python
   !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
   !pip install --no-deps trl peft accelerate bitsandbytes
   ```
4. Upload `train/axom_alpaca.json` and `train/train_unsloth_lora.py`.
5. Run the training script:
   ```python
   !python train_unsloth_lora.py
   ```
6. Download the resulting `Axom_v1.2-Q4_K_M.gguf` file to your PC!

---

### Option B: Local Training on your NVIDIA RTX 5060 (8GB VRAM)
Your HP OMEN with NVIDIA GeForce RTX 5060 Laptop GPU can train 4-bit QLoRA natively:

1. Open PowerShell and install PyTorch with CUDA:
   ```powershell
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
   pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
   pip install --no-deps trl peft accelerate bitsandbytes
   ```
2. Run training:
   ```powershell
   python train/train_unsloth_lora.py
   ```
3. The GGUF file will be exported directly into `c:\Users\abira\Documents\axom\models\axom_v1.2_gguf/`.

---

## 📥 Step 3: Register `axom:1.2` with Ollama

Once you have your `Axom_v1.2-Q4_K_M.gguf` file:

1. Place the GGUF file into `c:\Users\abira\Documents\axom\models\`.
2. Update the `FROM` line in `Modelfile`:
   ```dockerfile
   FROM ./models/Axom_v1.2-Q4_K_M.gguf
   ```
3. Run the registration command in PowerShell:
   ```powershell
   ollama create axom:1.2 -f Modelfile
   ```
4. AXOM's interface will instantly recognize `axom:1.2` in the Model selector dropdown!
