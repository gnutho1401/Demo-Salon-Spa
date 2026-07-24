import asyncio
import base64
import hmac
import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from .engine import ENGINE, decode_base64_image


class HairStyle(BaseModel):
    code: str | None = None
    name: str | None = None
    type: str | None = None
    length: str | None = None
    texture: str | None = None
    audience: str | None = None
    is_trending: bool = False
    lora_trigger: str | None = None
    prompt_version: str | None = None
    thumbnail_url: str | None = None


class TryOnRequest(BaseModel):
    image_base64: str = Field(min_length=16)
    mime_type: str = "image/jpeg"
    prompt: str = Field(default="", max_length=2000)
    request_id: str | None = Field(default=None, max_length=100)
    style: HairStyle | None = None
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)


class TryOnResponse(BaseModel):
    image_base64: str
    mime_type: str
    model: str
    request_id: str | None
    latency_ms: int
    seed: int


class AnalysisRequest(BaseModel):
    image_base64: str = Field(min_length=16)
    mime_type: str = "image/jpeg"


class AnalysisResponse(BaseModel):
    is_face: bool
    is_frontal: bool | None = None
    pose: str | None = None
    pose_score: float | None = None
    face_shape: str | None = None
    hair_type: str | None = None
    hair_length: str | None = None
    current_hair_color: str | None = None
    skin_tone: str | None = None
    provider: str
    model_name: str
    confidence: float
    quality_score: float
    warnings: list[str] = Field(default_factory=list)
    metrics: dict = Field(default_factory=dict)
    error: str | None = None


app = FastAPI(
    title="Salon Local Hair Try-on",
    version="1.0.0",
    description="Local-only image editing API. Customer photos never leave this machine.",
)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def service_home():
    status = ENGINE.status()
    ready = bool(status["face_model_ready"])
    state_label = "Sẵn sàng" if ready else "Cần thiết lập"
    state_class = "ready" if ready else "warning"
    model_state = "Đã nạp vào bộ nhớ" if status["loaded"] else "Sẽ tự nạp khi tạo ảnh đầu tiên"

    return f"""<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Salon AI Worker</title>
    <style>
      :root {{ color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }}
      * {{ box-sizing: border-box; }}
      body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #352b31; background: radial-gradient(circle at top, #fff 0, #fff6f8 48%, #f8edf0 100%); }}
      main {{ width: min(680px, 100%); padding: 34px; border: 1px solid #f1dce3; border-radius: 24px; background: rgba(255,255,255,.92); box-shadow: 0 24px 70px rgba(112,55,76,.12); }}
      .eyebrow {{ color: #e83e78; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }}
      h1 {{ margin: 10px 0 8px; font-size: clamp(28px, 5vw, 42px); line-height: 1.08; }}
      p {{ color: #76646c; line-height: 1.65; }}
      .status {{ display: flex; align-items: center; gap: 10px; margin: 24px 0; padding: 15px 17px; border-radius: 14px; background: #f7faf7; }}
      .dot {{ width: 10px; height: 10px; border-radius: 999px; background: #e5a42e; box-shadow: 0 0 0 5px #fff0cd; }}
      .ready .dot {{ background: #27a565; box-shadow: 0 0 0 5px #daf4e6; }}
      .status strong {{ display: block; }}
      .status small {{ color: #826f77; }}
      dl {{ display: grid; grid-template-columns: 150px 1fr; gap: 10px 18px; margin: 0 0 26px; font-size: 14px; }}
      dt {{ color: #8b737d; }}
      dd {{ margin: 0; font-weight: 650; overflow-wrap: anywhere; }}
      nav {{ display: flex; flex-wrap: wrap; gap: 10px; }}
      a {{ padding: 11px 15px; border: 1px solid #ecd4dd; border-radius: 11px; color: #6d3349; font-weight: 700; text-decoration: none; background: #fff; }}
      a.primary {{ border-color: #ee4b82; color: #fff; background: #ee4b82; }}
      a:hover {{ transform: translateY(-1px); }}
      footer {{ margin-top: 24px; color: #9b8790; font-size: 12px; }}
      @media (max-width: 520px) {{ main {{ padding: 24px; }} dl {{ grid-template-columns: 1fr; gap: 4px; }} dd {{ margin-bottom: 8px; }} nav a {{ width: 100%; text-align: center; }} }}
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Local AI · Không tốn phí API</div>
      <h1>Salon Hair Try-on Worker</h1>
      <p>Đây là dịch vụ AI nội bộ dùng để áp dụng kiểu và màu tóc lên ảnh. Giao diện dành cho khách hàng nằm trong ứng dụng Salon.</p>
      <div class="status {state_class}">
        <span class="dot" aria-hidden="true"></span>
        <div><strong>{state_label}</strong><small>{model_state}</small></div>
      </div>
      <dl>
        <dt>Mô hình</dt><dd>{status["diffusion_model"]}</dd>
        <dt>Chế độ thiết bị</dt><dd>{status["device_policy"]}</dd>
        <dt>Chi phí theo lượt</dt><dd>0 đồng</dd>
      </dl>
      <nav>
        <a class="primary" href="http://localhost:5173/customer/stylist-advisor">Mở AI Stylist</a>
        <a href="/health">Xem trạng thái JSON</a>
        <a href="/docs">Tài liệu API</a>
      </nav>
      <footer>Cổng 8189 chỉ phục vụ nội bộ. Không mở cổng này trực tiếp ra Internet.</footer>
    </main>
  </body>
</html>"""


def authorize(authorization: str | None) -> None:
    expected = os.getenv("LOCAL_HAIR_API_TOKEN", "").strip()
    if not expected:
        return
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Token AI local không hợp lệ.")


@app.get("/health")
async def health():
    status = ENGINE.status()
    return {"status": "ready" if status["face_model_ready"] else "setup_required", **status}


@app.post("/v1/analyze", response_model=AnalysisResponse)
async def analyze(payload: AnalysisRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    if payload.mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Chỉ hỗ trợ JPEG, PNG hoặc WEBP.")
    try:
        source_bytes = decode_base64_image(payload.image_base64)
        result = await asyncio.to_thread(_analyze_serialized, source_bytes)
        return AnalysisResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI local phân tích thất bại: {exc}") from exc


@app.post("/v1/hair/try-on", response_model=TryOnResponse)
async def try_on(payload: TryOnRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    if payload.mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Chỉ hỗ trợ JPEG, PNG hoặc WEBP.")

    try:
        source_bytes = decode_base64_image(payload.image_base64)
        style = payload.style.model_dump() if payload.style else None
        # The model and GPU are blocking resources; one request at a time prevents 4 GB VRAM OOM.
        result = await asyncio.to_thread(
            _run_serialized, source_bytes, payload.prompt, style, payload.seed
        )
        return TryOnResponse(
            image_base64=base64.b64encode(result.image_bytes).decode("ascii"),
            mime_type=result.mime_type,
            model=result.model,
            request_id=payload.request_id,
            latency_ms=result.latency_ms,
            seed=result.seed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI local xử lý thất bại: {exc}") from exc


def _run_serialized(source_bytes: bytes, prompt: str, style: dict | None, seed: int | None):
    with ENGINE.job_lock:
        return ENGINE.generate(source_bytes, prompt, style, seed)


def _analyze_serialized(source_bytes: bytes):
    with ENGINE.job_lock:
        return ENGINE.analyze(source_bytes)
