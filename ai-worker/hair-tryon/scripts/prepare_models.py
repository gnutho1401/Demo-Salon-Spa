import os
from pathlib import Path

import torch
from diffusers import AutoPipelineForInpainting


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
CACHE = Path(os.getenv("HAIR_MODEL_CACHE", PROJECT_ROOT / ".ai-models")).resolve()
MODEL_ID = os.getenv("HAIR_DIFFUSION_MODEL", "diffusers/stable-diffusion-xl-1.0-inpainting-0.1")


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {MODEL_ID} into {CACHE}")
    pipeline = AutoPipelineForInpainting.from_pretrained(
        MODEL_ID,
        cache_dir=str(CACHE),
        torch_dtype=torch.float16,
        variant=os.getenv("HAIR_MODEL_VARIANT", "fp16"),
        use_safetensors=True,
        low_cpu_mem_usage=True,
    )
    
    print("Downloading LCM LoRA for SDXL...")
    pipeline.load_lora_weights("latent-consistency/lcm-lora-sdxl", cache_dir=str(CACHE))
    print("Diffusion models and LoRAs are ready.")


if __name__ == "__main__":
    main()
