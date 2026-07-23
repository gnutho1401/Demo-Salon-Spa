import os
from pathlib import Path

import torch
from diffusers import StableDiffusionInpaintPipeline


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
CACHE = Path(os.getenv("HAIR_MODEL_CACHE", PROJECT_ROOT / ".ai-models")).resolve()
MODEL_ID = os.getenv("HAIR_DIFFUSION_MODEL", "sd2-community/stable-diffusion-2-inpainting")
MODEL_REVISION = os.getenv("HAIR_MODEL_REVISION", "5f74973cbb64c8568780732c17f43eb269d63a0d")


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {MODEL_ID} into {CACHE}")
    StableDiffusionInpaintPipeline.from_pretrained(
        MODEL_ID,
        revision=MODEL_REVISION,
        cache_dir=str(CACHE),
        torch_dtype=torch.float16,
        variant=os.getenv("HAIR_MODEL_VARIANT", "fp16"),
        use_safetensors=True,
        low_cpu_mem_usage=True,
    )
    print("Diffusion model is ready.")


if __name__ == "__main__":
    main()
