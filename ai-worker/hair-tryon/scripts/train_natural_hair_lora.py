"""Fine-tune a small SD2-inpainting LoRA on a prepared, licensed salon dataset."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import torch
import torch.nn.functional as F
from accelerate import Accelerator
from diffusers import AutoencoderKL, DDPMScheduler, StableDiffusionInpaintPipeline, UNet2DConditionModel
from diffusers.utils import convert_state_dict_to_diffusers
from peft import LoraConfig
from peft.utils import get_peft_model_state_dict
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms import functional as TF
from transformers import CLIPTextModel, CLIPTokenizer


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a natural-hair LoRA for the local inpainting worker.")
    parser.add_argument("--dataset", type=Path, required=True, help="Prepared directory containing metadata.jsonl.")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default=os.getenv("HAIR_DIFFUSION_MODEL", "sd2-community/stable-diffusion-2-inpainting"))
    parser.add_argument("--revision", default=os.getenv("HAIR_MODEL_REVISION", "5f74973cbb64c8568780732c17f43eb269d63a0d"))
    parser.add_argument("--cache", type=Path, default=Path(os.getenv("HAIR_MODEL_CACHE", ".ai-models")))
    parser.add_argument("--steps", type=int, default=1800)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--rank", type=int, default=4)
    parser.add_argument("--gradient-accumulation", type=int, default=4)
    parser.add_argument("--seed", type=int, default=2026)
    return parser.parse_args()


class HairDataset(Dataset):
    def __init__(self, root: Path, tokenizer: CLIPTokenizer):
        self.root = root
        self.tokenizer = tokenizer
        metadata = root / "metadata.jsonl"
        self.items = [json.loads(line) for line in metadata.read_text(encoding="utf-8").splitlines() if line.strip()]
        if len(self.items) < 20:
            raise ValueError("At least 20 licensed images are required; 80+ per audience is recommended.")

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        item = self.items[index]
        image = Image.open(self.root / item["image"]).convert("RGB")
        mask = Image.open(self.root / item["mask"]).convert("L")
        pixel_values = TF.pil_to_tensor(image).float() / 127.5 - 1.0
        mask_values = (TF.pil_to_tensor(mask).float() / 255.0 >= 0.5).float()
        tokens = self.tokenizer(
            item["caption"],
            max_length=self.tokenizer.model_max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        ).input_ids[0]
        return {"pixel_values": pixel_values, "mask": mask_values, "input_ids": tokens}


def main() -> None:
    args = parse_args()
    torch.manual_seed(args.seed)
    accelerator = Accelerator(
        gradient_accumulation_steps=args.gradient_accumulation,
        mixed_precision="fp16",
    )
    load_kwargs = {
        "revision": args.revision,
        "cache_dir": str(args.cache.resolve()),
        "local_files_only": True,
    }
    tokenizer = CLIPTokenizer.from_pretrained(args.model, subfolder="tokenizer", **load_kwargs)
    text_encoder = CLIPTextModel.from_pretrained(args.model, subfolder="text_encoder", **load_kwargs)
    vae = AutoencoderKL.from_pretrained(args.model, subfolder="vae", **load_kwargs)
    unet = UNet2DConditionModel.from_pretrained(args.model, subfolder="unet", **load_kwargs)
    noise_scheduler = DDPMScheduler.from_pretrained(args.model, subfolder="scheduler", **load_kwargs)

    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)
    unet.requires_grad_(False)
    unet.add_adapter(LoraConfig(
        r=args.rank,
        lora_alpha=args.rank,
        init_lora_weights="gaussian",
        target_modules=["to_k", "to_q", "to_v", "to_out.0"],
    ))
    unet.enable_gradient_checkpointing()
    try:
        unet.enable_xformers_memory_efficient_attention()
    except Exception:
        pass

    trainable = [parameter for parameter in unet.parameters() if parameter.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=args.learning_rate, betas=(0.9, 0.999), weight_decay=1e-2)
    dataset = HairDataset(args.dataset.resolve(), tokenizer)
    loader = DataLoader(dataset, batch_size=1, shuffle=True, num_workers=0, pin_memory=True)
    unet, optimizer, loader = accelerator.prepare(unet, optimizer, loader)
    weight_dtype = torch.float16
    vae.to(accelerator.device, dtype=weight_dtype)
    text_encoder.to(accelerator.device, dtype=weight_dtype)
    vae.enable_slicing()

    completed = 0
    unet.train()
    while completed < args.steps:
        for batch in loader:
            with accelerator.accumulate(unet):
                pixels = batch["pixel_values"].to(accelerator.device, dtype=weight_dtype)
                masks = batch["mask"].to(accelerator.device, dtype=weight_dtype)
                masked_pixels = pixels * (masks < 0.5)
                with torch.no_grad():
                    latents = vae.encode(pixels).latent_dist.sample() * vae.config.scaling_factor
                    masked_latents = vae.encode(masked_pixels).latent_dist.sample() * vae.config.scaling_factor
                    prompt_embeds = text_encoder(batch["input_ids"].to(accelerator.device))[0]
                noise = torch.randn_like(latents)
                timesteps = torch.randint(0, noise_scheduler.config.num_train_timesteps, (latents.shape[0],), device=latents.device).long()
                noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)
                latent_masks = F.interpolate(masks, size=latents.shape[-2:], mode="nearest")
                model_input = torch.cat([noisy_latents, latent_masks, masked_latents], dim=1)
                prediction = unet(model_input, timesteps, prompt_embeds).sample
                target = noise if noise_scheduler.config.prediction_type == "epsilon" else noise_scheduler.get_velocity(latents, noise, timesteps)
                loss = F.mse_loss(prediction.float(), target.float(), reduction="mean")
                accelerator.backward(loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(trainable, 1.0)
                optimizer.step()
                optimizer.zero_grad(set_to_none=True)
            if accelerator.sync_gradients:
                completed += 1
                if accelerator.is_main_process and completed % 25 == 0:
                    print(json.dumps({"step": completed, "loss": round(float(loss.detach()), 6)}))
            if completed >= args.steps:
                break

    accelerator.wait_for_everyone()
    if accelerator.is_main_process:
        output = args.output.resolve()
        output.mkdir(parents=True, exist_ok=True)
        trained_unet = accelerator.unwrap_model(unet)
        state = convert_state_dict_to_diffusers(get_peft_model_state_dict(trained_unet))
        StableDiffusionInpaintPipeline.save_lora_weights(
            save_directory=str(output),
            unet_lora_layers=state,
            safe_serialization=True,
        )
        (output / "training-metadata.json").write_text(json.dumps({
            "base_model": args.model,
            "revision": args.revision,
            "steps": args.steps,
            "rank": args.rank,
            "dataset_records": len(dataset),
            "seed": args.seed,
        }, indent=2), encoding="utf-8")
        print(json.dumps({"saved": str(output), "steps": completed}))


if __name__ == "__main__":
    main()
