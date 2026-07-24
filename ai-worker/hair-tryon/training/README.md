# Natural Hair LoRA Training

Pipeline này fine-tune phần attention của Stable Diffusion 2 Inpainting bằng LoRA. Ảnh trên Internet không được đưa thẳng vào tập train. Openverse chỉ là công cụ khám phá nội dung có metadata giấy phép, không phải bảo đảm pháp lý.

## Thu thập tự động

Chạy một lệnh để tìm ảnh theo các kiểu tóc nam, nữ và unisex đang có trong hệ thống:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_automatic_dataset_pipeline.ps1 -PerStyle 4
```

Kết quả nằm tại `training/automatic-discovery`:

- `manifest.discovery.jsonl`: ứng viên chờ duyệt.
- `attribution.csv`: tác giả, nguồn và giấy phép.
- `rejected.jsonl`: lý do ảnh bị loại.
- `report.json`: thống kê của lần chạy.

Ảnh được lọc giấy phép `CC0`, `PDM` hoặc `CC BY`, kiểm tra kích thước tối thiểu, gọi local AI để lọc mặt chính diện/chất lượng thấp và loại trùng bằng SHA-256/perceptual hash. Mọi bản ghi Internet luôn được tạo với `rights_verified=false`, `personality_rights_verified=false`, `style_verified=false` và `training_approved=false`.

Trước khi train, người duyệt phải mở trang nguồn và xác minh:

1. Metadata bản quyền/giấy phép còn đúng và đáp ứng điều kiện ghi công.
2. Quyền hình ảnh, quyền riêng tư và quyền sử dụng khuôn mặt cho mục đích huấn luyện.
3. Gán đúng giới tính/nhóm người dùng và đúng kiểu tóc, rồi đặt `style_verified=true`.
4. Chỉ sau đó mới đặt các cờ xác minh còn lại thành `true` trong một manifest đã duyệt riêng.

Không sửa trực tiếp `manifest.discovery.jsonl`; nên sao chép thành `manifest.approved.jsonl` để giữ nguyên bằng chứng khám phá ban đầu.

## Bộ dữ liệu khuyến nghị

- Tối thiểu để chạy thử: 20 ảnh; khuyến nghị 80-150 ảnh cho mỗi nhóm `MALE` và `FEMALE`.
- Chỉ dùng ảnh chính diện, thấy rõ toàn bộ tóc, đa dạng màu da, chất tóc và điều kiện sáng.
- Mỗi kiểu nên có nhiều người khác nhau; không train lặp quá nhiều ảnh của một người.
- Caption bắt đầu bằng `LoraTrigger` tương ứng trong bảng `AIHairStyles`.
- Tách riêng 15-20% ảnh làm validation và không dùng chúng để train.
- Ảnh do salon tự chụp dùng `rights_basis=SALON_MODEL_RELEASE`, có `consent=true`, `rights_verified=true` và `training_approved=true`.

## Chuẩn bị dữ liệu

```powershell
wsl -d SalonAI -- bash -lc "cd /mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon && source /opt/salon-ai/.venv/bin/activate && pip install -r requirements-training.txt"
powershell -ExecutionPolicy Bypass -File scripts/run_automatic_dataset_pipeline.ps1 -SkipDiscovery -ApprovedManifest training/manifest.approved.jsonl
```

Script chuẩn bị dùng chính BiSeNet của worker để kiểm tra vùng mặt, tư thế chính diện và tỷ lệ vùng tóc. Script dừng nếu thiếu giấy phép, xác minh quyền, phê duyệt train, ảnh hoặc vùng tóc hợp lệ.

## Train LoRA

Với RTX 3050 4 GB, pipeline dùng rank 4, batch 1 và gradient accumulation 4:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_automatic_dataset_pipeline.ps1 -SkipDiscovery -ApprovedManifest training/manifest.approved.jsonl -Train
```

Sau khi train, đặt cấu hình worker:

```dotenv
HAIR_LORA_PATH=/mnt/e/Demo-Salon-Spa/ai-worker/hair-tryon/models/natural-hair-lora
HAIR_LORA_WEIGHT=0.75
```

Khởi động lại worker và kiểm tra `/health`: `lora_loaded` phải là `true`. So sánh model mới trên tập validation bằng cùng seed; chỉ đưa vào sử dụng khi hairline, tai, vùng trán và độ giống danh tính tốt hơn bản nền.
