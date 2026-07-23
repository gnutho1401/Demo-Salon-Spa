import base64
import io
import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parents[1]
MODEL_CACHE = Path(os.getenv("HAIR_MODEL_CACHE", PROJECT_ROOT / ".ai-models")).resolve()
FACE_MODEL = Path(os.getenv("HAIR_FACE_MODEL", ROOT / "models" / "resnet18.onnx")).resolve()
MODEL_ID = os.getenv("HAIR_DIFFUSION_MODEL", "sd2-community/stable-diffusion-2-inpainting")
MODEL_REVISION = os.getenv("HAIR_MODEL_REVISION", "5f74973cbb64c8568780732c17f43eb269d63a0d")
LORA_PATH = Path(os.getenv("HAIR_LORA_PATH", ROOT / "models" / "natural-hair-lora")).resolve()
LORA_WEIGHT = max(0.0, min(1.5, float(os.getenv("HAIR_LORA_WEIGHT", "0.75"))))
MAX_IMAGE_BYTES = 10 * 1024 * 1024

STYLE_PROMPTS = {
    "LAYER_FACE_FRAME": "medium-length layered haircut, soft face-framing layers, shoulder length, natural crown volume",
    "FRENCH_BOB": "elegant French bob haircut, chin length, clean rounded ends, subtle natural volume",
    "TEXTURED_PIXIE": "short textured pixie haircut, feathered fringe, natural volume, neat tapered sides",
    "LONG_SOFT_WAVES": "long glossy hair with large soft waves, natural movement, loose waves from cheekbones downward",
    "KOREAN_VOLUME": "shoulder-length Korean layered haircut, airy curtain bangs, root volume, soft C-curl ends",
    "MODERN_UNDERCUT": "modern undercut haircut, clean tapered sides, textured top swept gently to one side",
    "CHESTNUT_BROWN": "keep the exact hairstyle and recolor the hair warm natural chestnut brown with realistic roots",
    "ASH_BROWN": "keep the exact hairstyle and recolor the hair natural cool ash brown with realistic depth",
    "COPPER_GLOW": "keep the exact hairstyle and recolor the hair warm cinnamon copper with natural highlights",
    "PLATINUM_BEIGE": "keep the exact hairstyle and recolor the hair soft beige platinum with subtle dark natural roots",
    "BUTTERFLY_LAYERS_2026": "female butterfly haircut with long cascading face-framing layers, airy crown volume, feathered ends, natural movement",
    "GRADUATED_BOB_2026": "female graduated bob haircut, softly stacked nape, chin-skimming front, polished natural movement",
    "BIXIE_2026": "female modern bixie haircut, between pixie and bob length, soft side-swept texture, airy volume",
    "SOFT_SHAG_2026": "female commercial soft shag haircut, medium feathered layers, light curtain fringe, effortless air-dried texture",
    "SOFT_MODERN_MULLET_2026": "male soft modern mullet haircut, relaxed tousled texture, moderate length at the back, soft temple transition",
    "TEXTURED_CROP_TAPER_2026": "male textured crop haircut with soft low taper, choppy natural top texture, subtle forward fringe",
    "CURTAIN_FLOW_2026": "male medium curtain flow hairstyle, relaxed center part, layered swept-back sides, natural bend and movement",
    "BURST_FADE_MULLET_2026": "male burst fade mullet haircut, clean circular fade around ears, textured top, controlled length at the back",
    "MODERN_BUZZ_2026": "male modern buzz cut with subtle layered top, softly tapered sides, natural scalp coverage",
    "NATURAL_CURL_TAPER_2026": "male natural curl taper hairstyle, soft defined curls on top, low tapered sides, realistic curl clusters",
    "COPPER_ROSE_2026": "keep the exact hairstyle and recolor only the hair sun-warmed copper rose brunette with dimensional lowlights and natural roots",
}

NEGATIVE_PROMPT = (
    "changed face, different person, altered facial features, beauty filter, makeup, "
    "deformed eyes, distorted face, duplicate person, wig cap, plastic hair, blurry hair, "
    "helmet hair, painted hair, hard mask edge, halo around hair, floating strands, repeated curls, "
    "uniform strand pattern, fake shine, oversaturated hair, illustration, painting, text, watermark, logo"
)


@dataclass
class GenerationResult:
    image_bytes: bytes
    mime_type: str
    model: str
    latency_ms: int
    seed: int


class HairTryOnEngine:
    """Lazy-loads models and serializes jobs so a 4 GB GPU cannot be overcommitted."""

    def __init__(self) -> None:
        self._segmenter = None
        self._pipeline = None
        self._lora_loaded = False
        self._lora_name = None
        self._load_lock = threading.Lock()
        self.job_lock = threading.Lock()

    @property
    def loaded(self) -> bool:
        return self._pipeline is not None and self._segmenter is not None

    def status(self) -> dict[str, Any]:
        return {
            "loaded": self.loaded,
            "face_model_ready": FACE_MODEL.is_file(),
            "model_cache": str(MODEL_CACHE),
            "diffusion_model": MODEL_ID,
            "lora_loaded": self._lora_loaded,
            "lora_name": self._lora_name,
            "lora_path": str(LORA_PATH),
            "device_policy": "cuda-model-offload",
            "zero_api_cost": True,
        }

    def _load_segmenter(self):
        if not FACE_MODEL.is_file():
            raise RuntimeError(
                f"Thiếu model phân vùng tóc: {FACE_MODEL}. Hãy chạy scripts/setup-local-ai.ps1."
            )
        import onnxruntime as ort

        self._segmenter = ort.InferenceSession(
            str(FACE_MODEL), providers=["CPUExecutionProvider"]
        )

    def _load_pipeline(self):
        import torch
        from diffusers import StableDiffusionInpaintPipeline

        if not torch.cuda.is_available():
            raise RuntimeError("Không phát hiện CUDA. AI thử tóc local cần NVIDIA CUDA để đạt tốc độ sử dụng được.")

        MODEL_CACHE.mkdir(parents=True, exist_ok=True)
        self._pipeline = StableDiffusionInpaintPipeline.from_pretrained(
            MODEL_ID,
            revision=MODEL_REVISION,
            cache_dir=str(MODEL_CACHE),
            torch_dtype=torch.float16,
            variant=os.getenv("HAIR_MODEL_VARIANT", "fp16"),
            use_safetensors=True,
            local_files_only=os.getenv("HAIR_OFFLINE_MODE", "true").lower() == "true",
        )
        self._pipeline.enable_model_cpu_offload()
        self._pipeline.enable_attention_slicing("max")
        self._pipeline.enable_vae_slicing()
        self._pipeline.enable_vae_tiling()
        if LORA_PATH.exists():
            adapter_name = "salon-natural-hair"
            if LORA_PATH.is_file():
                self._pipeline.load_lora_weights(
                    str(LORA_PATH.parent),
                    weight_name=LORA_PATH.name,
                    adapter_name=adapter_name,
                )
            else:
                self._pipeline.load_lora_weights(str(LORA_PATH), adapter_name=adapter_name)
            self._pipeline.set_adapters([adapter_name], adapter_weights=[LORA_WEIGHT])
            self._lora_loaded = True
            self._lora_name = f"{adapter_name}@{LORA_WEIGHT:.2f}"

    def ensure_segmenter_loaded(self) -> None:
        if self._segmenter is not None:
            return
        with self._load_lock:
            if self._segmenter is None:
                self._load_segmenter()

    def ensure_loaded(self) -> None:
        if self.loaded:
            return
        with self._load_lock:
            if self._segmenter is None:
                self._load_segmenter()
            if self._pipeline is None:
                self._load_pipeline()

    @staticmethod
    def _largest_component(mask: np.ndarray) -> np.ndarray:
        binary = (mask > 0).astype(np.uint8)
        count, components, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
        if count <= 1:
            return binary
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        return (components == largest).astype(np.uint8)

    @staticmethod
    def _classify_face_shape(face_mask: np.ndarray) -> str:
        points = cv2.findNonZero((face_mask * 255).astype(np.uint8))
        if points is None:
            return "Chưa xác định"
        x, y, width, height = cv2.boundingRect(points)
        if width <= 0 or height <= 0:
            return "Chưa xác định"

        crop = face_mask[y : y + height, x : x + width]

        def band_width(relative_y: float) -> int:
            center = max(0, min(height - 1, round(relative_y * (height - 1))))
            radius = max(1, height // 30)
            band = crop[max(0, center - radius) : min(height, center + radius + 1)]
            widths = [int(np.count_nonzero(row)) for row in band]
            return max(widths, default=0)

        forehead = band_width(0.22)
        cheek = max(1, band_width(0.52))
        jaw = band_width(0.82)
        aspect = height / max(1, width)
        forehead_ratio = forehead / cheek
        jaw_ratio = jaw / cheek

        if aspect >= 1.48:
            return "Dài"
        if aspect <= 1.12 and jaw_ratio >= 0.76:
            return "Tròn"
        if jaw_ratio >= 0.88 and forehead_ratio >= 0.82:
            return "Vuông"
        if forehead_ratio <= 0.78 and jaw_ratio <= 0.76:
            return "Kim cương"
        return "Trái xoan"

    @staticmethod
    def _classify_skin_tone(rgb: np.ndarray, skin_mask: np.ndarray) -> str:
        pixels = rgb[skin_mask > 0]
        if pixels.size == 0:
            return "Chưa xác định"
        red, green, blue = np.median(pixels, axis=0)
        luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
        depth = "sáng" if luminance >= 185 else "trung bình" if luminance >= 125 else "ngăm"
        undertone = "ấm" if red - blue >= 14 else "lạnh" if blue - red >= 6 else "trung tính"
        return f"Tông da {depth} {undertone}"

    @staticmethod
    def _estimate_frontal(labels: np.ndarray, face_mask: np.ndarray) -> tuple[bool, float]:
        points = cv2.findNonZero((face_mask * 255).astype(np.uint8))
        if points is None:
            return False, 0.0
        x, y, width, height = cv2.boundingRect(points)
        crop = face_mask[y : y + height, x : x + width]
        half = width // 2
        if half < 8:
            return False, 0.0
        left = crop[:, :half]
        right = cv2.flip(crop[:, width - half :], 1)
        intersection = float(np.count_nonzero((left > 0) & (right > 0)))
        union = float(np.count_nonzero((left > 0) | (right > 0)))
        symmetry = intersection / max(1.0, union)

        left_eye = int(np.count_nonzero(labels == 4))
        right_eye = int(np.count_nonzero(labels == 5))
        eye_balance = min(left_eye, right_eye) / max(1, max(left_eye, right_eye))
        if min(left_eye, right_eye) < 3:
            eye_balance *= 0.5
        score = max(0.0, min(1.0, symmetry * 0.68 + eye_balance * 0.32))
        return score >= 0.52, score

    @staticmethod
    def _classify_hair(rgb: np.ndarray, hair_mask: np.ndarray, face_mask: np.ndarray) -> tuple[str, str]:
        hair_points = cv2.findNonZero((hair_mask * 255).astype(np.uint8))
        face_points = cv2.findNonZero((face_mask * 255).astype(np.uint8))
        if hair_points is None:
            return "Chưa xác định", "Chưa xác định"

        _, hair_y, _, hair_height = cv2.boundingRect(hair_points)
        if face_points is None:
            length_label = "Tóc trung bình"
        else:
            _, face_y, _, face_height = cv2.boundingRect(face_points)
            hair_bottom = hair_y + hair_height
            face_bottom = face_y + face_height
            extension = (hair_bottom - face_bottom) / max(1, face_height)
            length_label = "Tóc ngắn" if extension <= 0.12 else "Tóc trung bình" if extension <= 0.72 else "Tóc dài"

        pixels = rgb[hair_mask > 0]
        red, green, blue = np.median(pixels, axis=0)
        brightness = float(np.mean([red, green, blue]))
        spread = float(max(red, green, blue) - min(red, green, blue))
        if brightness <= 58:
            color_label = "đen hoặc nâu rất đậm"
        elif spread <= 14 and brightness >= 145:
            color_label = "sáng hoặc ánh khói"
        elif red >= blue + 18:
            color_label = "nâu ấm"
        elif blue >= red + 8:
            color_label = "nâu lạnh"
        else:
            color_label = "nâu tự nhiên"
        return f"{length_label}, sắc {color_label}", color_label

    def analyze(self, source_bytes: bytes) -> dict[str, Any]:
        if len(source_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Ảnh vượt quá giới hạn 10 MB.")

        source = ImageOps.exif_transpose(Image.open(io.BytesIO(source_bytes))).convert("RGB")
        if min(source.size) < 128:
            raise ValueError("Ảnh quá nhỏ. Cần ảnh có cạnh ngắn tối thiểu 128 px.")

        self.ensure_segmenter_loaded()
        labels = self._parse_face(source)
        rgb = np.asarray(source, dtype=np.uint8)
        height, width = labels.shape
        total_pixels = max(1, width * height)
        face_mask = self._largest_component(np.isin(labels, np.arange(1, 14)).astype(np.uint8))
        hair_mask = self._largest_component((labels == 17).astype(np.uint8))
        skin_mask = ((labels == 1).astype(np.uint8) * face_mask).astype(np.uint8)
        face_ratio = float(np.count_nonzero(face_mask) / total_pixels)
        hair_ratio = float(np.count_nonzero(hair_mask) / total_pixels)
        is_face = face_ratio >= 0.012
        warnings: list[str] = []

        if not is_face:
            return {
                "is_face": False,
                "is_frontal": False,
                "pose": "unknown",
                "error": "Không nhận diện được khuôn mặt rõ ràng. Hãy dùng ảnh chính diện, đủ sáng và thấy rõ toàn bộ đầu.",
                "provider": "local",
                "model_name": "bisenet-resnet18",
                "confidence": round(min(0.35, face_ratio * 10), 3),
                "quality_score": 0.0,
                "warnings": ["Không phát hiện đủ vùng khuôn mặt."],
                "metrics": {"face_ratio": round(face_ratio, 4), "hair_ratio": round(hair_ratio, 4)},
            }

        luminance = float(np.mean(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)))
        if luminance < 62:
            warnings.append("Ảnh hơi tối; nên chụp ở nơi có ánh sáng đều.")
        if luminance > 232:
            warnings.append("Ảnh hơi sáng; nên tránh ánh sáng chiếu trực tiếp vào mặt.")
        if hair_ratio < 0.008:
            warnings.append("Vùng tóc chưa đủ rõ; kết quả thử kiểu có thể kém chính xác.")
        if face_ratio < 0.035:
            warnings.append("Khuôn mặt còn nhỏ trong khung; nên chụp gần hơn.")

        is_frontal, pose_score = self._estimate_frontal(labels, face_mask)
        if not is_frontal:
            warnings.append("Khuôn mặt đang nghiêng; hãy chụp chính diện để kiểu tóc bám đúng đường chân tóc.")
        hair_type, current_hair_color = self._classify_hair(rgb, hair_mask, face_mask)
        exposure_score = max(0.0, 1.0 - abs(luminance - 145.0) / 145.0)
        confidence = min(0.96, 0.52 + min(face_ratio, 0.12) * 2.2 + min(hair_ratio, 0.18) * 1.2)
        quality_score = min(1.0, 0.45 + exposure_score * 0.3 + min(face_ratio / 0.08, 1.0) * 0.25)
        return {
            "is_face": True,
            "is_frontal": is_frontal,
            "pose": "frontal" if is_frontal else "angled",
            "pose_score": round(pose_score, 3),
            "face_shape": self._classify_face_shape(face_mask),
            "hair_type": hair_type,
            "hair_length": hair_type.split(",", 1)[0],
            "current_hair_color": current_hair_color,
            "skin_tone": self._classify_skin_tone(rgb, skin_mask),
            "provider": "local",
            "model_name": "bisenet-resnet18",
            "confidence": round(confidence, 3),
            "quality_score": round(quality_score, 3),
            "warnings": warnings,
            "metrics": {
                "width": width,
                "height": height,
                "face_ratio": round(face_ratio, 4),
                "hair_ratio": round(hair_ratio, 4),
                "average_luminance": round(luminance, 1),
                "frontal_score": round(pose_score, 3),
            },
        }

    def _parse_face(self, image: Image.Image) -> np.ndarray:
        rgb = np.asarray(image.convert("RGB"), dtype=np.uint8)
        resized = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_LINEAR)
        tensor = resized.astype(np.float32) / 255.0
        tensor = (tensor - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
            [0.229, 0.224, 0.225], dtype=np.float32
        )
        tensor = np.transpose(tensor, (2, 0, 1))[None].astype(np.float32)
        input_name = self._segmenter.get_inputs()[0].name
        output_names = [item.name for item in self._segmenter.get_outputs()]
        output = self._segmenter.run(output_names, {input_name: tensor})[0]
        labels = output.squeeze(0).argmax(0).astype(np.uint8)
        return cv2.resize(labels, image.size, interpolation=cv2.INTER_NEAREST)

    @staticmethod
    def _build_mask(labels: np.ndarray, style: dict[str, Any] | None) -> Image.Image:
        height, width = labels.shape
        hair = (labels == 17).astype(np.uint8) * 255
        if cv2.countNonZero(hair) < max(128, int(width * height * 0.002)):
            raise ValueError("Không phát hiện đủ vùng tóc. Hãy dùng ảnh chính diện, đủ sáng và thấy rõ toàn bộ đầu.")

        style_type = str((style or {}).get("type") or "CUT").upper()
        hair_length = str((style or {}).get("length") or "").upper()
        base = min(width, height)
        expansion = 0.012 if style_type == "COLOR" else 0.035
        if hair_length == "LONG":
            expansion = 0.055
        kernel_size = max(5, int(base * expansion))
        if kernel_size % 2 == 0:
            kernel_size += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        expanded = cv2.dilate(hair, kernel, iterations=1)

        # Color changes preserve the full face. Haircut changes may overlap only the upper
        # forehead so bangs and a new hairline can be formed without touching eyes/nose/mouth.
        if style_type == "COLOR":
            protected_face = np.isin(labels, np.arange(1, 14)).astype(np.uint8) * 255
        else:
            protected_face = np.isin(labels, np.arange(2, 14)).astype(np.uint8) * 255
            face_skin = (labels == 1).astype(np.uint8) * 255
            face_points = cv2.findNonZero(face_skin)
            if face_points is not None:
                face_x, face_y, face_width, face_height = cv2.boundingRect(face_points)
                forehead_limit = face_y + int(face_height * 0.28)
                protected_face[forehead_limit : face_y + face_height, face_x : face_x + face_width] = np.maximum(
                    protected_face[forehead_limit : face_y + face_height, face_x : face_x + face_width],
                    face_skin[forehead_limit : face_y + face_height, face_x : face_x + face_width],
                )
        protect_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        protected_face = cv2.dilate(protected_face, protect_kernel, iterations=1)
        expanded[protected_face > 0] = 0

        expanded = cv2.morphologyEx(expanded, cv2.MORPH_CLOSE, kernel)
        return Image.fromarray(expanded, mode="L")

    @staticmethod
    def _fit_for_model(image: Image.Image, max_side: int = 512) -> Image.Image:
        width, height = image.size
        scale = min(1.0, max_side / max(width, height))
        target_width = max(64, int(width * scale) // 8 * 8)
        target_height = max(64, int(height * scale) // 8 * 8)
        return image.resize((target_width, target_height), Image.Resampling.LANCZOS)

    def _build_prompt(self, style: dict[str, Any] | None, custom_prompt: str) -> str:
        style_code = str((style or {}).get("code") or "").upper()
        desired_hair = STYLE_PROMPTS.get(style_code)
        if not desired_hair:
            desired_hair = custom_prompt.strip()[:500] or "a flattering natural salon hairstyle"
        lora_trigger = str((style or {}).get("lora_trigger") or "").strip()
        if self._lora_loaded and lora_trigger:
            desired_hair = f"{lora_trigger}, {desired_hair}"
        return (
            f"Professional photorealistic salon portrait, {desired_hair}. "
            "Natural strand-by-strand variation, believable density, realistic scalp and hairline transition, "
            "subtle flyaway hairs, physically plausible highlights, soft contact shadows around forehead and ears, "
            "coherent salon lighting, no wig-like edge. "
            "Keep the person's exact identity, facial geometry, expression, skin, pose, clothes and background unchanged."
        )

    def generate(
        self,
        source_bytes: bytes,
        prompt: str,
        style: dict[str, Any] | None,
        seed: int | None = None,
    ) -> GenerationResult:
        if len(source_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("Ảnh vượt quá giới hạn 10 MB.")

        started = time.perf_counter()
        source = ImageOps.exif_transpose(Image.open(io.BytesIO(source_bytes))).convert("RGB")
        if min(source.size) < 256:
            raise ValueError("Ảnh quá nhỏ. Cần ảnh có cạnh ngắn tối thiểu 256 px.")

        self.ensure_loaded()
        labels = self._parse_face(source)
        full_mask = self._build_mask(labels, style)
        model_image = self._fit_for_model(source)
        model_mask = full_mask.resize(model_image.size, Image.Resampling.LANCZOS)
        actual_seed = seed if seed is not None else secrets.randbelow(2_147_483_647)

        import torch

        generator = torch.Generator(device="cpu").manual_seed(actual_seed)
        steps = max(20, min(45, int(os.getenv("HAIR_INFERENCE_STEPS", "32"))))
        guidance = max(4.0, min(10.0, float(os.getenv("HAIR_GUIDANCE_SCALE", "7.5"))))
        style_type = str((style or {}).get("type") or "CUT").upper()
        strength_defaults = {"COLOR": 0.58, "TEXTURE": 0.76, "CUT": 0.88}
        strength = max(0.45, min(0.96, float(os.getenv(
            f"HAIR_{style_type}_STRENGTH",
            str(strength_defaults.get(style_type, 0.86)),
        ))))
        with torch.inference_mode():
            generated = self._pipeline(
                prompt=self._build_prompt(style, prompt),
                negative_prompt=NEGATIVE_PROMPT,
                image=model_image,
                mask_image=model_mask,
                strength=strength,
                guidance_scale=guidance,
                num_inference_steps=steps,
                generator=generator,
            ).images[0].convert("RGB")

        # Restore the untouched pixels from the original at full resolution.
        generated = generated.resize(source.size, Image.Resampling.LANCZOS)
        feather_radius = max(2, int(min(source.size) * 0.006))
        feathered_mask = full_mask.filter(ImageFilter.GaussianBlur(feather_radius))
        final_image = Image.composite(generated, source, feathered_mask)
        output = io.BytesIO()
        final_image.save(output, format="JPEG", quality=94, subsampling=0, optimize=True)
        return GenerationResult(
            image_bytes=output.getvalue(),
            mime_type="image/jpeg",
            model=f"{MODEL_ID}+{self._lora_name}" if self._lora_loaded else MODEL_ID,
            latency_ms=round((time.perf_counter() - started) * 1000),
            seed=actual_seed,
        )


def decode_base64_image(value: str) -> bytes:
    try:
        payload = base64.b64decode(value, validate=True)
    except Exception as exc:
        raise ValueError("Dữ liệu ảnh base64 không hợp lệ.") from exc
    if not payload:
        raise ValueError("Dữ liệu ảnh bị trống.")
    return payload


ENGINE = HairTryOnEngine()
