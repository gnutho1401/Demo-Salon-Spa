# Kết quả chuẩn hóa và đồng bộ dữ liệu

- Thời điểm kiểm tra: 2026-07-20
- Target database: `BeautySalonSystem1`
- Data-quality RunId: `BB262E8D-F40F-41DA-B31B-5234DACBB2CF`
- Chế độ: `APPLY`
- Trạng thái: `COMPLETED`

## Mapping Source → Target

| Tiêu chí | Kết quả |
|---|---:|
| Cột Source đã kiểm tra | 535 |
| Cột thiếu hoặc sai thuộc tính ở Target | 0 |
| Tỷ lệ mapping schema | 100.00% |
| Backend schema bắt buộc còn thiếu | 0 |

Target có thêm dữ liệu vận hành so với bản seed Source ở các bảng lịch hẹn,
ca làm việc, hóa đơn, thông báo và log AI. Không có bảng nào bị xóa hoặc bị
ghi đè để ép số dòng Target bằng Source.

## Kết quả chuẩn hóa và đồng bộ

| Kiểm tra | Sai lệch còn lại |
|---|---:|
| Email người dùng trùng | 0 |
| Thời gian lịch hẹn không hợp lệ | 0 |
| Payment `PAID` nhưng Invoice chưa `PAID` | 0 |
| Số tiền Payment và Invoice không khớp | 0 |
| Công thức tổng tiền Invoice không khớp | 0 |
| Số buổi gói dịch vụ không khớp | 0 |
| Foreign key bị tắt hoặc không trusted | 0 |
| Mapping Users → Employees/Customers sai | 0 |
| Schema Backend bắt buộc còn thiếu | 0 |

## Ngoại lệ cần duyệt thủ công

Một nhóm lịch hẹn có 9 bản ghi trùng khung giờ. Bản ghi chuẩn được chọn là
Appointment `111`; các ứng viên trùng là `114`, `115`, `116`, `117`, `118`,
`119`, `120`, `121`, `122`.

Các bản ghi này đã được lưu trong `dq.AppointmentDuplicateQuarantine` với
trạng thái `PENDING_REVIEW`. Pipeline không tự xóa vì từng lịch vẫn có dữ liệu
dịch vụ hoặc lịch sử trạng thái liên quan.

## Chạy lại

```powershell
cd E:\Demo-Salon-Spa
powershell -ExecutionPolicy Bypass -File .\database\data-quality\run.ps1 -ApplyNormalization
```
