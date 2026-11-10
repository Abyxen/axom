"""
AXOM v1.2 QLoRA Fine-Tuning Pipeline (Unsloth + PyTorch)
Optimized for NVIDIA GeForce RTX 5060 Laptop GPU (8GB VRAM) & Google Colab (Free T4)
"""

import os
import torch

def train():
    try:
        from unsloth import FastLanguageModel
        from trl import SFTTrainer
        from transformers import TrainingArguments
        from datasets import load_dataset
    except ImportError:
        print("[ERROR] Unsloth / TRL not installed.")
        print("Run: pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"")
        print("     pip install --no-deps trl peft accelerate bitsandbytes")
        return

    # Configuration
    max_seq_length = 2048
    dtype = None # Auto detect: Float16 for Turing/Ampere, Bfloat16 for Ada/Blackwell
    load_in_4bit = True # 4bit quantization saves 80% VRAM

    print("=========================================")
    print("⚡ Starting AXOM v1.2 Neural Weight Training")
    print(f"Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    print("=========================================")

    # 1. Load Pretrained Base Model
    # Default to Qwen2.5-3B-Instruct (matching Axom 4B footprint)
    model_name = "unsloth/Qwen2.5-3B-Instruct"
    print(f"[1/4] Loading base model: {model_name}...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = model_name,
        max_seq_length = max_seq_length,
        dtype = dtype,
        load_in_4bit = load_in_4bit,
    )

    # 2. Add LoRA Adapters
    print("[2/4] Injecting QLoRA adapters...")
    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha = 32,
        lora_dropout = 0, # Optimized to 0 for Unsloth fast kernels
        bias = "none",
        use_gradient_checkpointing = "unsloth",
        random_state = 3407,
    )

    # 3. Load Dataset
    dataset_file = os.path.join(os.path.dirname(__file__), "axom_alpaca.json")
    print(f"[3/4] Formatting dataset from {dataset_file}...")
    dataset = load_dataset("json", data_files=dataset_file)["train"]

    prompt_template = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""

    def formatting_prompts_func(examples):
        instructions = examples["instruction"]
        inputs = examples["input"]
        outputs = examples["output"]
        texts = []
        for instruction, inp, output in zip(instructions, inputs, outputs):
            text = prompt_template.format(instruction, inp, output) + tokenizer.eos_token
            texts.append(text)
        return { "text": texts }

    dataset = dataset.map(formatting_prompts_func, batched = True)

    # 4. Training Arguments & Trainer
    print("[4/4] Training with SFTTrainer...")
    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "text",
        max_seq_length = max_seq_length,
        dataset_num_proc = 2,
        packing = False,
        args = TrainingArguments(
            per_device_train_batch_size = 2,
            gradient_accumulation_steps = 4,
            warmup_steps = 5,
            max_steps = 60, # Quick convergence on small high-signal datasets
            learning_rate = 2e-4,
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 1,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "linear",
            seed = 3407,
            output_dir = "outputs",
        ),
    )

    trainer_stats = trainer.train()
    print("=========================================")
    print("✅ Training Complete!")
    print(trainer_stats)
    print("=========================================")

    # 5. Export to GGUF for Ollama
    output_gguf_dir = os.path.join(os.path.dirname(__file__), "..", "models", "axom_v1.2_gguf")
    print(f"Exporting GGUF (Q4_K_M) to: {output_gguf_dir}...")
    model.save_pretrained_gguf(output_gguf_dir, tokenizer, quantization_method = "q4_k_m")
    print("✨ GGUF Exported Successfully!")
    print(f"To register with Ollama run: ollama create axom:1.2 -f Modelfile")

if __name__ == "__main__":
    train()
