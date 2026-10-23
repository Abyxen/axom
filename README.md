# ⚡ AXOM — Personal Local AI Assistant

**AXOM** is your completely local, private, instruction-tuned AI assistant tailored for coding, learning, brainstorming, and daily computer workflows. It runs 100% offline on your Windows 11 PC without any external API fees, telemetry, or cloud dependency.

---

## 🖥️ System & Hardware Architecture

- **Operating System:** Windows 11 Home / Pro
- **Hardware Profile:** HP OMEN Gaming Laptop
- **GPU Acceleration:** NVIDIA GeForce RTX 5060 Laptop GPU (8 GB VRAM, Blackwell Architecture)
- **CUDA Acceleration:** CUDA 12.0 / 13.4 with 100% GPU layer offload (~70+ tokens/second)
- **System Memory:** 32 GB RAM
- **Local Model Engine:** [Ollama](https://ollama.com/) (Version 0.40.4)
- **Local Application Server:** Node.js (v26+ zero-dependency lightweight HTTP server)
- **Frontend:** AXOM Custom Dark/Light Web Interface with responsive layout and conversation history

---

## 🧠 Selected Model Details

| Attribute | Specification |
|---|---|
| **Primary Model Alias** | `axom-chat` |
| **Foundation Base Model** | `qwen2.5:7b` (Qwen 2.5 7B Instruct) |
| **Model Size on Disk** | 4.7 GB (Q4_K_M quantization) |
| **VRAM Footprint** | ~5.2 GB (fits comfortably within the 8 GB RTX 5060 VRAM) |
| **Context Window** | 4,096 tokens (up to 32k supported) |
| **Inference Speed** | ~70 – 85 tokens/sec on RTX 5060 GPU |
| **Strengths** | Instruction-following, code generation, debugging, structured reasoning |

---

## 🚀 How to Launch AXOM

### The Easy Way (One-Click)
Double-click:
```bat
Start_AXOM.bat
```

What the launcher does automatically:
1. Detects your Node.js and Ollama installations.
2. Starts the Ollama model engine in the background if it is not already running.
3. Checks that your `axom-chat` model is ready.
4. Starts the AXOM local backend server at `http://127.0.0.1:8000`.
5. Opens your AXOM web interface in your default browser.
6. Displays a status console and keeps services alive while you chat.

---

## ⏹️ How to Stop AXOM

You have two simple options:

1. **From the launcher window:** Press any key in the active `Start_AXOM.bat` terminal window. It will cleanly shut down the backend.
2. **Dedicated script:** Double-click:
   ```bat
   Stop_AXOM.bat
   ```
   This immediately terminates the AXOM backend running on port 8000.

*(Note: Ollama remains available in your Windows system tray so subsequent launches start instantly. You can right-click the Ollama llama icon in your taskbar tray and click "Quit" if you wish to exit Ollama entirely).*

---

## 🛠️ How to Start Manually (If the .bat file ever fails)

If Windows prevents batch scripts from executing or you prefer manual terminal control:

### Step 1: Start Ollama (Terminal 1)
```powershell
ollama serve
```

### Step 2: Start AXOM Backend (Terminal 2)
Navigate to your project folder:
```powershell
cd C:\Users\abira\Documents\axom
node server.js
```

### Step 3: Open in Browser
Open Google Chrome, Edge, or Brave and navigate to:
```
http://127.0.0.1:8000
```

---

## 🎯 Fine-Tuning AXOM with Unsloth (Coding & Chatting)

You can train your own customized weights for AXOM using **Unsloth (QLoRA 4-bit)** to excel at programming and conversational reasoning.

### 📊 Dataset Recipe (Balanced Dual Engine)
1. **Coding Knowledge (~47%)**: 2,000 curated programming tasks from `sahil2801/CodeAlpaca-20k` covering Python, JavaScript, algorithms, bug fixes, and software architecture.
2. **Conversational Reasoning (~47%)**: 2,000 multi-turn dialogues and reasoning challenges from `mlabonne/FineTome-100k`.
3. **AXOM Identity (~6%)**: Clean grounding that AXOM is created by Abiral and runs locally on your HP OMEN laptop, without drowning out coding accuracy.

### 🚀 How to Train:
1. Open Google Colab in your browser and load:
   `G:\My Drive\Colab Notebooks\Axom.ipynb`
2. Ensure hardware accelerator is set to **T4 GPU** (`Runtime -> Change runtime type -> T4 GPU`).
3. Click **Runtime -> Run all**.
4. The notebook installs Unsloth, downloads the datasets, fine-tunes with response loss masking in ~15 minutes, evaluates test prompts, and exports GGUF (`Q4_K_M`) to `G:\My Drive\AXOM_Model\`.

### 📥 How to Import Your Trained Model to Desktop:
Once training is done, double-click:
```bat
Import_Trained_Model.bat
```
This automatically links the newly exported GGUF file from your Google Drive into your local Ollama library under `axom-chat`. The next time you run `Start_AXOM.bat`, your website will immediately use your newly trained model!

---

## 🔄 How to Change or Add Models Later

AXOM's backend dynamically queries all models installed in your local Ollama library.

### 1. Download another model
Open PowerShell and pull any model you want to try, for example:
- `ollama pull qwen2.5-coder:7b` (Specialized in code generation)
- `ollama pull qwen2.5:3b` (Ultra-lightweight 2GB model)
- `ollama pull llama3.2:3b` (Meta's lightweight model)
- `ollama pull deepseek-r1:7b` (Reasoning-focused model)

### 2. Switch models in the UI
Refresh the AXOM interface at `http://127.0.0.1:8000`. The model selector dropdown in the top header will automatically display all installed models. Simply click and choose the model you want to chat with.

### 3. Customize AXOM's persona (`Modelfile`)
To update AXOM's instructions:
1. Edit the file `Modelfile` in this folder.
2. Rebuild the alias by running:
   ```powershell
   ollama create axom-chat -f Modelfile
   ```

---

## 🔍 Troubleshooting & Diagnostics

### 1. Backend Status Shows "Offline"
- Run `curl http://127.0.0.1:8000/api/health` in PowerShell.
- If it fails, start the backend with `node server.js`.
- If the backend says `ollama: unreachable`, make sure Ollama is running (`ollama serve`).

### 2. Port 8000 Conflict
If another program is using port 8000:
- Run `Stop_AXOM.bat` to terminate old instances.
- Or check what is using it:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess
  ```

### 3. GPU Acceleration Verification
Verify that your NVIDIA RTX 5060 Laptop GPU is processing inference:
1. Open PowerShell and run:
   ```powershell
   nvidia-smi
   ```
2. While AXOM is responding to a prompt, you will see GPU utilization increase and ~5.2 GB of VRAM allocated to Ollama.

---

## 📁 Project File Directory

```
C:\Users\abira\Documents\axom\
├── index.html        # AXOM responsive web interface (HTML, CSS, JS)
├── server.js         # Zero-dependency local backend & API adapter (Node.js)
├── Modelfile         # Ollama model definition & persona for axom-chat
├── Start_AXOM.bat    # One-click Windows startup script
├── Stop_AXOM.bat     # Clean shutdown script
├── test_suite.ps1    # Automated verification test suite
└── README.md         # Documentation & user guide
```
