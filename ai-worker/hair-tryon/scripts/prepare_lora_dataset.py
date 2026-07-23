"""Prepare a consented, licensed salon-photo dataset for natural-hair LoRA training."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.engine import ENGINE  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare licensed hair images and BiSeNet masks for LoRA training.")
    parser.add_argument("--manifest", type=Path, required=True, help="JSONL source manifest.")
    parser.add_argument("--output", type=Path, required=True, help="Output dataset directory.")
    parser.add_argument("--size", type=int, default=512, choices=(384, 512, 640))
    return parser.parse_args()


def read_manifest(path: Path) -> list[dict]:
    records = []
    for line_number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        record = json.loads(raw)
        if record.get("consent") is not True:
            raise ValueError(f"Line {line_number}: consent=true is required.")
        if not str(record.get("license") or "").strip():
            raise ValueError(f"Line {line_number}: license/source permission is required.")
        audience = str(record.get("audience") or "").upper()
        if audience not in {"MALE", "FEMALE", "UNISEX"}:
            raise ValueError(f"Line {line_number}: audience must be MALE, FEMALE or UNISEX.")
        caption = str(record.get("caption") or "").strip()
        if len(caption) < 20:
            raise ValueError(f"Line {line_number}: caption is too short.")
        source = Path(record.get("image_path") or "")
        if not source.is_absolute():
            source = (path.parent / source).resolve()
        if not source.is_file():
            raise FileNotFoundError(f"Line {line_number}: image does not exist: {source}")
        records.append({**record, "audience": audience, "caption": caption, "source": source})
    if not records:
        raise ValueError("The manifest has no usable records.")
    return records


def prepare_record(record: dict, index: int, output: Path, size: int) -> dict:
    image = ImageOps.exif_transpose(Image.open(record["source"])).convert("RGB")
    if min(image.size) < 512:
        raise ValueError(f"Image {record['source']} is below the recommended 512 px minimum.")

    image = ImageOps.pad(image, (size, size), method=Image.Resampling.LANCZOS, color=(224, 220, 216))
    ENGINE.ensure_segmenter_loaded()
    labels = ENGINE._parse_face(image)  # The trainer and runtime intentionally share the exact segmenter.
    hair = (labels == 17).astype(np.uint8) * 255
    ratio = float(cv2.countNonZero(hair) / max(1, size * size))
    if ratio < 0.008:
        raise ValueError(f"Image {record['source']} does not contain a sufficiently clear hair region.")

    kernel_size = max(5, int(size * 0.018) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    hair = cv2.morphologyEx(hair, cv2.MORPH_CLOSE, kernel)
    hair = cv2.dilate(hair, kernel, iterations=1)
    protected_features = np.isin(labels, np.arange(2, 14))
    hair[protected_features] = 0

    stem = f"hair-{index:05d}"
    image_relative = Path("images") / f"{stem}.jpg"
    mask_relative = Path("masks") / f"{stem}.png"
    image.save(output / image_relative, format="JPEG", quality=96, subsampling=0)
    Image.fromarray(hair, mode="L").save(output / mask_relative, format="PNG")
    return {
        "image": image_relative.as_posix(),
        "mask": mask_relative.as_posix(),
        "caption": record["caption"],
        "audience": record["audience"],
        "style_code": record.get("style_code"),
        "license": record["license"],
        "source_id": record.get("source_id"),
        "hair_ratio": round(ratio, 4),
    }


def main() -> None:
    args = parse_args()
    records = read_manifest(args.manifest.resolve())
    output = args.output.resolve()
    (output / "images").mkdir(parents=True, exist_ok=True)
    (output / "masks").mkdir(parents=True, exist_ok=True)
    prepared = [prepare_record(record, index, output, args.size) for index, record in enumerate(records, 1)]
    metadata = output / "metadata.jsonl"
    metadata.write_text("\n".join(json.dumps(item, ensure_ascii=False) for item in prepared) + "\n", encoding="utf-8")
    counts = {audience: sum(item["audience"] == audience for item in prepared) for audience in ("MALE", "FEMALE", "UNISEX")}
    print(json.dumps({"records": len(prepared), "audience_counts": counts, "metadata": str(metadata)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
