# Combo / Liệu trình - phần đã làm thêm

## Backend
- Public API danh sách combo có tìm kiếm, lọc danh mục, lọc giá, sắp xếp:
  - `GET /api/packages?search=&category=&minPrice=&maxPrice=&sort=`
- Public API danh mục combo:
  - `GET /api/packages/categories/list`
- Public API chi tiết combo kèm các dịch vụ bên trong:
  - `GET /api/packages/:id`
- Customer xem combo đã mua:
  - `GET /api/packages/my`
- Customer mua tại quầy:
  - `POST /api/packages/:id/buy`
- Customer thanh toán combo bằng VNPay:
  - `POST /api/packages/:id/vnpay`
- VNPay callback riêng cho combo:
  - `GET /api/packages/vnpay-return`

## Frontend
- Thêm trang guest:
  - `/packages`
  - `/packages/:id`
- Sửa menu Guest có mục `Combo / Liệu trình`.
- Thiết kế lại trang Customer:
  - `/customer/packages`
- Có hiển thị combo đã mua, số buổi còn lại, ngày hết hạn, trạng thái thanh toán.

## SQL cần chạy
Chạy file:

```sql
database/migration_combo_lieutrinh_fullstack.sql
```

File này thêm:
- `Packages.CategoryName`
- `Packages.DiscountPercent`
- `Packages.TotalSessions`
- bảng `PackagePayments`
- dữ liệu mẫu combo/liệu trình thật hơn.

## ENV cần có nếu thanh toán VNPay
Trong `backend/.env`:

```env
VNP_TMN_CODE=ma_tmn_code_cua_ban
VNP_HASH_SECRET=ma_hash_secret_cua_ban
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173
VNP_PACKAGE_RETURN_URL=http://localhost:5000/api/packages/vnpay-return
```
