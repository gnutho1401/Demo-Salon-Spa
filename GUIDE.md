# Week 4 Testing Guide - Node.js (Refactored to AAA Pattern)

## 1. Scope & AAA Design

Week 4 chỉ thực hiện kiểm thử cho 3 module được chọn:

1. **Auth Service** (Unit Test)
2. **Payment Discount / Reward Point** (Unit Test)
3. **Receptionist Appointment API** (Integration Test)

Toàn bộ 54 test cases đã được tái cấu trúc sạch sẽ theo mẫu **AAA (Arrange - Act - Assert)**:
- **Arrange**: Thiết lập dữ liệu đầu vào, trạng thái mock.
- **Act**: Gọi phương thức/API cần kiểm thử.
- **Assert**: Kiểm tra kết quả phản hồi bằng các biểu thức `expect`.

Mỗi block `it()` chỉ kiểm tra đúng **một hành vi độc lập duy nhất** và không chứa các lệnh gọi chéo hàm/API lồng nhau hay comment kéo coverage giả.

---

## 2. Why Coverage Is Scoped

Để tránh việc các module nằm ngoài phạm vi Week 4 (như `admin`, `ai`, `reports`, `packages`) kéo thấp tỷ lệ bao phủ của dự án xuống, file [jest.config.js](file:///h:/a_SWP/beauty-salon-customer-fixed/beauty-salon%20%2814%29/beauty-salon/backend/jest.config.js) đã giới hạn phạm vi đo lường vào đúng 4 file:
- `src/modules/auth/auth.service.js`
- `src/utils/membershipDiscount.js`
- `src/modules/receptionist/receptionist.routes.js`
- `src/modules/receptionist/receptionist.controller.js`

Với cách phân bổ test case riêng biệt và sạch sẽ, dự án đạt tổng tỷ lệ Statement Coverage trong scope là **68.44%** (vượt yêu cầu tối thiểu 60%).

---

## 3. Danh sách Test Files

| File | Type | Mô tả | Số TC |
| --- | --- | --- | ---: |
| [auth.service.test.js](file:///h:/a_SWP/beauty-salon-customer-fixed/beauty-salon%20%2814%29/beauty-salon/backend/tests/unit/auth.service.test.js) | Unit Test | Kiểm thử login, register, đổi mật khẩu, xác thực tài khoản | 24 |
| [payment.logic.test.js](file:///h:/a_SWP/beauty-salon-customer-fixed/beauty-salon%20%2814%29/beauty-salon/backend/tests/unit/payment.logic.test.js) | Unit Test | Kiểm thử tính toán chiết khấu thành viên và sử dụng điểm thưởng | 14 |
| [receptionist.appointment.api.test.js](file:///h:/a_SWP/beauty-salon-customer-fixed/beauty-salon%20%2814%29/beauty-salon/backend/tests/integration/receptionist.appointment.api.test.js) | Integration Test | Giả lập HTTP gọi API quản lý lịch hẹn qua Supertest | 16 |

---

## 4. Cách Chạy Test

Để thực hiện chạy kiểm thử, mở terminal tại thư mục `backend/` và gõ lệnh:
```bash
npm test
```

---

## 5. Báo cáo Độ Bao Phủ (Coverage)

Để chạy kiểm thử và cập nhật báo cáo độ bao phủ:
```bash
npm run test:coverage
```

Báo cáo HTML chi tiết được lưu tại:
[backend/coverage/lcov-report/index.html](file:///h:/a_SWP/beauty-salon-customer-fixed/beauty-salon%20%2814%29/beauty-salon/backend/coverage/lcov-report/index.html)

---

## 6. Kết quả Kiểm thử Thực tế

| Test File | Tổng số | Đạt (PASS) | Thất bại (FAIL) |
| --- | ---: | ---: | ---: |
| `auth.service.test.js` | 24 | 24 | 0 |
| `payment.logic.test.js` | 14 | 14 | 0 |
| `receptionist.appointment.api.test.js` | 16 | 16 | 0 |
| **TỔNG CỘNG** | **54** | **54** | **0** |

---

## 7. Thống kê Coverage Chi tiết

* **Statements coverage:** `68.44%` (trong phạm vi Week 4 scope)
* **Branches coverage:** `73.75%`
* **Functions coverage:** `55.73%`
* **Lines coverage:** `69.39%`
