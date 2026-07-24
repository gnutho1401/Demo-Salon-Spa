import os
from huggingface_hub import hf_hub_download

os.makedirs("models/ip-adapter", exist_ok=True)

print("Downloading IP-Adapter SDXL...")
try:
    hf_hub_download(
        repo_id="h94/IP-Adapter",
        filename="sdxl_models/ip-adapter_sdxl.bin",
        local_dir="models/ip-adapter"
    )
    print("Download completed successfully!")
except Exception as e:
    print(f"Failed to download IP-Adapter: {e}")
