# Nghiên cứu AI thử tóc local, không phí API

## Kết luận theo phần cứng hiện tại

Máy thử nghiệm có RTX 3050 Laptop 4 GB VRAM và 16 GB RAM. Cấu hình production local được chọn là Stable Diffusion 2 Inpainting FP16 kết hợp BiSeNet ONNX phân vùng tóc, chạy trong WSL2 với model CPU offload. Đây là phương án cân bằng tốt nhất giữa chất lượng, tính riêng tư và khả năng chạy ổn định trên phần cứng hiện có.

## So sánh phương án

| Phương án | Điểm mạnh | Vì sao chọn/không chọn |
| --- | --- | --- |
| SD2 Inpainting + BiSeNet | Chỉ sửa vùng tóc, 512 px, hỗ trợ low-VRAM, giấy phép rõ | Được triển khai; chạy thật khoảng 45–104 giây/lượt trên RTX 3050 4 GB tùy loại chỉnh sửa |
| HairFastGAN | Chuyên reference hairstyle, MIT, chất lượng 1024 px tốt | Dành cho nâng cấp sau; repo yêu cầu Linux/CUDA và nhiều checkpoint, 4 GB VRAM không đủ an toàn |
| Stable-Hair | Hai giai đoạn, giữ chi tiết tóc tham chiếu, Apache-2.0 | Model công khai bị giới hạn bởi bald converter và dữ liệu khuôn mặt crop/aligned; nặng hơn cấu hình hiện tại |
| Qwen-Image-Edit | Chỉnh ảnh theo chỉ dẫn rất mạnh, Apache-2.0 | Model gốc 20B/57.7 GB; 16 GB RAM và 4 GB VRAM không đủ để vận hành ổn định |
| Hugging Face ZeroGPU Space công cộng | Không phải cài model | Không phù hợp production: quota/queue và ảnh khách hàng phải rời máy |

## Luồng xử lý đã triển khai

1. Backend chỉ gọi provider `local` trên `127.0.0.1:8189`.
2. Worker xác định nhãn tóc bằng BiSeNet trên CPU.
3. Mask được nới theo loại/độ dài kiểu tóc và loại trừ toàn bộ vùng mặt.
4. SD2 Inpainting tái tạo vùng tóc ở tối đa 512 px với FP16, attention slicing và CPU offload.
5. Kết quả được ghép với pixel gốc ngoài vùng tóc, lưu riêng tư trong lịch sử khách hàng.
6. Worker chạy offline sau cài đặt; không gọi Hugging Face hoặc API trả phí trong lúc tạo ảnh.

## Nguồn kỹ thuật

- HairFastGAN: https://github.com/AIRI-Institute/HairFastGAN
- Stable-Hair: https://github.com/Xiaojiu-z/Stable-Hair
- Qwen Image Edit: https://huggingface.co/Qwen/Qwen-Image-Edit
- Stable Diffusion 2 Inpainting: https://huggingface.co/sd2-community/stable-diffusion-2-inpainting
- Face parsing: https://github.com/yakhyo/face-parsing
- ComfyUI low-VRAM guidance: https://docs.comfy.org/troubleshooting/overview
- Hugging Face ZeroGPU quotas: https://huggingface.co/docs/hub/main/en/spaces-zerogpu
