#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon"
RUNTIME="/opt/salon-ai"
VENV="$RUNTIME/venv"
SKIP_MODEL="${1:-}"

export DEBIAN_FRONTEND=noninteractive
export PIP_NO_CACHE_DIR=1
export HAIR_MODEL_CACHE="$RUNTIME/models"
export HF_HOME="$RUNTIME/huggingface"

if ! /usr/lib/wsl/lib/nvidia-smi >/dev/null 2>&1; then
  echo "WSL cannot access the NVIDIA GPU." >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends python3-venv python3-pip ca-certificates curl

mkdir -p "$RUNTIME" "$HAIR_MODEL_CACHE" "$HF_HOME" "$ROOT/models"
if [[ ! -x "$VENV/bin/python" ]]; then
  python3 -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install \
  torch==2.7.1 torchvision==0.22.1 \
  --index-url https://download.pytorch.org/whl/cu126
"$VENV/bin/python" -m pip install -r "$ROOT/requirements.txt"

FACE_MODEL="$ROOT/models/resnet18.onnx"
if [[ ! -f "$FACE_MODEL" ]]; then
  curl --fail --location \
    "https://github.com/yakhyo/face-parsing/releases/download/weights/resnet18.onnx" \
    --output "$FACE_MODEL"
fi

"$VENV/bin/python" -c \
  "import torch; assert torch.cuda.is_available(); print('CUDA ready:', torch.cuda.get_device_name(0), torch.version.cuda)"

if [[ "$SKIP_MODEL" != "--skip-model" ]]; then
  "$VENV/bin/python" "$ROOT/scripts/prepare_models.py"
fi

echo "SalonAI Linux runtime is ready."
