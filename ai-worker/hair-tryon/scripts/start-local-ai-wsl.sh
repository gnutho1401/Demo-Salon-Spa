#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon"
RUNTIME="/opt/salon-ai"
PYTHON="$RUNTIME/venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Linux AI runtime is missing. Run setup-local-ai.ps1 first." >&2
  exit 1
fi

export HAIR_MODEL_CACHE="$RUNTIME/models"
export HF_HOME="$RUNTIME/huggingface"
export HAIR_FACE_MODEL="$ROOT/models/resnet18.onnx"
export HAIR_OFFLINE_MODE=true
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
cd "$ROOT"
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8189
