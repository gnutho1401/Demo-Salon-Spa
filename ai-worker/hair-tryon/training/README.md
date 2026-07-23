# Natural Hair LoRA Training

Pipeline này fine-tune phần attention của Stable Diffusion 2 Inpainting bằng LoRA. Không đưa ảnh tải ngẫu nhiên từ Internet vào tập train. Mỗi ảnh phải có `consent=true` và mô tả quyền sử dụng trong trường `license`.

## Bộ dữ liệu khuyến nghị

- Tối thiểu để chạy thử: 20 ảnh; khuyến nghị 80-150 ảnh cho mỗi nhóm `MALE` và `FEMALE`.
- Ảnh chính diện hoặc lệch nhẹ, thấy rõ toàn bộ tóc, nhiều màu da, chất tóc và điều kiện sáng.
- Mỗi kiểu nên có nhiều người khác nhau. Không train lặp quá nhiều ảnh của một người.
- Caption bắt đầu bằng `LoraTrigger` tương ứng trong bảng `AIHairStyles`.
- Tách riêng 15-20% ảnh làm validation và không dùng chúng để train.

## Chuẩn bị dữ liệu

```powershell
wsl -d SalonAI -- bash -lc "cd /mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon && source /opt/salon-ai/.venv/bin/activate && pip install -r requirements-training.txt"
wsl -d SalonAI -- bash -lc "cd /mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon && source /opt/salon-ai/.venv/bin/activate && python scripts/prepare_lora_dataset.py --manifest training/manifest.jsonl --output training/data-v1 --size 512"
```

Script chuẩn bị dùng chính BiSeNet của worker để tạo mask tóc và dừng ngay nếu thiếu consent, license, ảnh hoặc không thấy đủ vùng tóc.

## Train LoRA

Với RTX 3050 4 GB, bắt đầu bằng rank 4, batch 1 và gradient accumulation 4:

```powershell
wsl -d SalonAI -- bash -lc "cd /mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon && source /opt/salon-ai/.venv/bin/activate && accelerate launch scripts/train_natural_hair_lora.py --dataset training/data-v1 --output models/natural-hair-lora --rank 4 --steps 1800 --gradient-accumulation 4"
```

Sau khi train, đặt cấu hình worker:

```dotenv
HAIR_LORA_PATH=/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon/models/natural-hair-lora
HAIR_LORA_WEIGHT=0.75
```

Khởi động lại worker và kiểm tra `/health`: `lora_loaded` phải là `true`. So sánh model mới trên tập validation bằng cùng seed; chỉ đưa vào sử dụng khi hairline, tai, vùng trán và độ giống danh tính tốt hơn bản nền.
