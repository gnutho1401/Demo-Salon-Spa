# Tài liệu Demo Salon Spa

Đây là chỉ mục tài liệu chính thức của dự án. Mỗi chủ đề chỉ có một tài liệu nguồn để hạn chế nội dung trùng lặp và hướng dẫn lỗi thời.

## Bắt đầu

- [Hướng dẫn cài đặt và chạy toàn bộ dự án](../HUONG_DAN_CHAY_DU_AN.md)
- [Self-host trên Windows với chi phí 0 đồng](SELF_HOST_ZERO_COST.md)
- [Kiểm thử backend](../backend/TESTING.md)
- [Mapping và hợp đồng toàn hệ thống](SYSTEM_MAPPING.md)

Khởi động nhanh toàn hệ thống bằng một lệnh từ thư mục gốc:

```powershell
.\salon.cmd
```

## AI Stylist và thử tóc

- [Cài đặt và chạy AI Worker](../ai-worker/hair-tryon/README.md)
- [Nghiên cứu kiến trúc AI thử tóc local](ai-hair-tryon-local-research.md)
- [Thu thập dữ liệu và huấn luyện LoRA](../ai-worker/hair-tryon/training/README.md)
- [Nguồn và giấy phép model](../ai-worker/hair-tryon/THIRD_PARTY_MODELS.md)

## Dữ liệu và báo cáo

- [Bộ dữ liệu vận hành 12 tháng](../database/seeds/README.md)
- [Kết quả kiểm tra chất lượng dữ liệu mới nhất](../database/data-quality/LATEST_RESULT.md)
- [Thiết kế báo cáo nội bộ và phân quyền](internal-reporting-design.md)

## Giao diện

- [Cấu trúc CSS frontend](../frontend/CSS_STRUCTURE.md)

## Quy tắc duy trì tài liệu

1. Cập nhật tài liệu nguồn ở danh sách trên, không tạo thêm file có cùng mục đích.
2. Không ghi cứng số lượng test, trạng thái dịch vụ hoặc kết quả runtime vào hướng dẫn; dùng lệnh kiểm tra để lấy số liệu hiện tại.
3. Tài liệu nghiên cứu phải tách biệt với hướng dẫn vận hành.
4. Khi thay đổi cổng, biến môi trường hoặc script chạy, cập nhật đồng thời tài liệu nguồn liên quan.
5. Tài liệu cũ không còn đúng phải được xóa; lịch sử vẫn được lưu trong Git.
