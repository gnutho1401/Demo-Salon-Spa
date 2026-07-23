# Bộ dữ liệu vận hành 12 tháng

Script chính: `seed_realistic_orders_one_year.sql`.

## Phạm vi dữ liệu

Hệ thống không có bảng `Orders` riêng. Một đơn hàng được lưu theo mô hình chuẩn hóa:

`Appointments → AppointmentServices → Invoices → Payments`

Script đồng bộ thêm:

- `AppointmentStatusHistory`
- `Refunds`
- `Reviews`
- `Feedbacks`
- `TreatmentNotes`
- `TechnicianPayoutLedger`
- `EmployeePerformance`
- `SystemLogs`

Khách hàng, kỹ thuật viên, chi nhánh và dịch vụ được lấy từ dữ liệu danh mục đang tồn tại. Script không tạo danh tính hoặc PII giả.

## Cách chạy

1. Sao lưu database trước khi chạy bản ghi thật.
2. Mở `seed_realistic_orders_one_year.sql` bằng SQL Server Management Studio.
3. Giữ `@DryRun = 1` và chạy lần đầu để xem năm result set kiểm tra.
4. Kiểm tra số lượng, phân bổ trạng thái, phương thức thanh toán và tổng doanh thu.
5. Đổi `@DryRun = 0`, sau đó chạy lại để commit.

Script tạo 12 tháng hoàn chỉnh gần nhất, kết thúc vào ngày cuối của tháng trước. Ví dụ khi chạy trong tháng 07/2026, khoảng dữ liệu là `2025-07-01` đến `2026-06-30`.

## An toàn và tính lặp lại

- Toàn bộ thao tác chạy trong một transaction với `XACT_ABORT ON`.
- Có application lock để ngăn hai tiến trình seed chạy đồng thời.
- Batch đã commit được đánh dấu bằng `REALISTIC_ONE_YEAR_V1` trong `SystemLogs` và sẽ không chạy lại.
- Script kiểm tra khóa ngoại, xung đột lịch kỹ thuật viên, tổng tiền, số invoice/payment và KPI trùng trước khi commit.
- `EmployeePerformance` được tính lại từ dữ liệu nguồn thay vì cộng số liệu rời rạc.

## Kết quả dry-run đã xác nhận trên BeautySalonSystem1

- 365 ngày, 6.852 đơn.
- 127 ngày thường: 8–10 đơn/ngày.
- 238 ngày cao điểm: 18–30 đơn/ngày.
- 7.592 dòng dịch vụ, 6.852 hóa đơn, 6.852 thanh toán.
- 3.443 đánh giá, 311 phản hồi, 277 yêu cầu hoàn tiền.
- 1.842 ghi chú điều trị và 5.441 bút toán hoa hồng.

Các con số có thể thay đổi nếu danh mục kỹ thuật viên/dịch vụ hoặc lịch đang tồn tại thay đổi.

> Đây là dữ liệu seed mô phỏng nghiệp vụ thực tế được ghi vào database, không phải lịch sử giao dịch thật của khách hàng ngoài đời. Không nên trình bày bộ dữ liệu này như dữ liệu sản xuất đã phát sinh.
