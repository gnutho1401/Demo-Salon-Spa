# Local Hair Try-on AI

Dịch vụ này chạy hoàn toàn trên máy salon, không gọi API tạo ảnh bên ngoài và không phát sinh phí theo lượt.

## Kiến trúc

- BiSeNet ResNet18 ONNX (MIT) phân vùng vùng tóc trên CPU.
- Stable Diffusion 2 Inpainting (CreativeML OpenRAIL++-M) tái tạo riêng vùng tóc. Bản mirror `sd2-community` được khóa tại commit `5f74973cbb64c8568780732c17f43eb269d63a0d` vì repo Stability AI hiện yêu cầu quyền truy cập.
- Model CPU offload, attention slicing và VAE tiling giúp chạy trong giới hạn RTX 3050 4 GB.
- Kết quả được ghép lại với pixel gốc ngoài vùng tóc để giữ khuôn mặt, trang phục và nền.
- Hàng đợi chỉ xử lý một ảnh tại một thời điểm để tránh tràn VRAM.

## Cài đặt

Yêu cầu Windows 11, WSL2 Ubuntu 24.04, NVIDIA driver hỗ trợ CUDA 12.6 và còn khoảng 10 GB ổ đĩa E:. Worker chạy trong Linux để tương thích PyTorch mà không thay đổi chính sách Windows Application Control.

```powershell
cd E:\Demo-Salon-Spa\ai-worker\hair-tryon
.\scripts\setup-local-ai.ps1
.\scripts\start-local-ai.ps1
```

Script khởi động có thể chạy lại an toàn: nếu AI Worker đã sẵn sàng, script sẽ tái sử dụng tiến trình hiện có thay vì mở Uvicorn lần thứ hai. Không chạy trực tiếp thêm lệnh `python -m uvicorn ...` khi cổng 8189 đang phục vụ.

Kiểm tra dịch vụ tại `http://127.0.0.1:8189/health`. Lần tạo ảnh đầu tiên sẽ chậm hơn do nạp model. Với GPU 4 GB, ảnh 512 px thường cần vài phút; đây là đánh đổi để không mất phí API.

Backend dùng cấu hình:

```dotenv
AI_HAIR_PROVIDER_ORDER=local
AI_HAIR_LOCAL_ENABLED=true
LOCAL_HAIR_API_URL=http://127.0.0.1:8189
AI_HAIR_JOB_TIMEOUT_MS=900000
```

Nếu triển khai worker sang máy khác, bắt buộc đặt `LOCAL_HAIR_API_TOKEN` giống nhau ở backend và worker, đồng thời chỉ mở cổng trên mạng riêng/VPN.

## Nâng chất lượng về sau

HairFastGAN (MIT) là lựa chọn reference-to-reference chuyên dụng khi có GPU tối thiểu khoảng 12 GB VRAM. Không cài mặc định trên máy hiện tại vì dự án gốc yêu cầu Linux/CUDA và tải đồng thời nhiều checkpoint 1024 px, không phù hợp RTX 3050 4 GB.
