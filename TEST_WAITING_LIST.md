# HƯỚNG DẪN KIỂM THỬ HỆ THỐNG SMART WAITING LIST (HÀNG CHỜ THÔNG MINH)

Tài liệu này hướng dẫn cách kiểm thử quy trình tự động khớp slot của Hàng Chờ thông qua giao diện Web (chạy tại `http://localhost:5174`).

---

## 👥 1. Danh Sách Tài Khoản Kiểm Thử
Tất cả tài khoản dưới đây đều sử dụng mật khẩu mặc định là: **`123456`**

| Vai trò | Số điện thoại | Tên hiển thị | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Khách hàng A** | `0910000001` | Khách hàng 01 | Người đặt lịch trước để KTV bận |
| **Khách hàng B** | `0910000002` | Khách hàng 02 | Người đăng ký hàng chờ xếp lịch |
| **Lễ tân** | `0901234567` | Lễ tân Test | Người có quyền hủy lịch trên dashboard lễ tân |

---

## 📋 2. Kịch Bản Kiểm Thử Từng Bước (Chạy Trên Web)

### 🔹 Bước 1: Khách hàng A Đặt Lịch để KTV Hết Slot
1. Mở trình duyệt thứ nhất (hoặc tab thường), truy cập: [http://localhost:5174/login](http://localhost:5174/login)
2. Đăng nhập tài khoản **Khách hàng A** (`0910000001` / `123456`).
3. Vào mục **Đặt lịch hẹn**:
   * Chọn dịch vụ bất kỳ (ví dụ: *Cắt tóc nam*).
   * Chọn **KTV Linh Chi**.
   * Chọn ngày hẹn là **ngày 25/06/2026** (hoặc một ngày bất kỳ trong tương lai).
   * Chọn giờ hẹn **`08:00 - 08:15`** và bấm **Tiếp tục thanh toán** (không cần thanh toán, chỉ bấm để lịch hẹn được tạo thành công dạng `Chờ thanh toán`).
4. *Lưu ý:* Lúc này slot `08:00` của KTV Linh Chi ngày đó đã bận. Để KTV này hết sạch lịch cả ngày hôm đó (nhằm hiển thị bảng Hàng chờ cho Khách hàng B), bạn có thể đặt hết các giờ làm việc còn lại, hoặc cấu hình ca làm việc của Linh Chi ngày hôm đó chỉ kéo dài đúng 15 phút từ `08:00 - 08:15`.

---

### 🔹 Bước 2: Khách hàng B Đăng Ký Hàng Chờ (Waiting List)
1. Mở **Trình duyệt ẩn danh** (hoặc trình duyệt khác), truy cập: [http://localhost:5174/login](http://localhost:5174/login)
2. Đăng nhập tài khoản **Khách hàng B** (`0910000002` / `123456`).
3. Vào trang **Đặt lịch**:
   * Chọn cùng dịch vụ, cùng **KTV Linh Chi** và cùng ngày **25/06/2026**.
   * Do KTV Linh Chi đã bận/hết slot trống, giao diện sẽ ẩn phần chọn giờ cụ thể và tự động hiển thị thẻ **"Tham gia danh sách chờ (Waiting List)"**.
4. Khách hàng B tích chọn các tùy chọn:
   * [x] *Chấp nhận kỹ thuật viên khác*
   * [x] *Chấp nhận khung giờ khác trong ngày*
5. Bấm **"Đăng ký hàng chờ"**. Khi báo thành công, hãy truy cập mục **Hàng chờ** ở menu trái. Yêu cầu của bạn sẽ hiển thị ở trạng thái **`Đang chờ` (WAITING)** với vị trí số `#1`.

---

### 🔹 Bước 3: Hủy Lịch (Khách hàng A nhường Slot)
1. Quay lại trình duyệt của **Khách hàng A** (hoặc đăng nhập Lễ tân `0901234567`).
2. Vào mục **Lịch hẹn của tôi** (hoặc dashboard Lễ tân), tìm lịch hẹn của KTV Linh Chi lúc `08:00` ngày **25/06/2026** và chọn **Hủy lịch** (Nhập lý do hủy bất kỳ).
3. **Phản ứng tự động của hệ thống:**
   * Backend giải phóng slot `08:00` và tự động chạy động cơ khớp slot.
   * Tìm thấy **Khách hàng B** đang đợi ngày đó, tự động đổi trạng thái yêu cầu của Khách B sang **`MATCHED` (Đã khớp slot)** và khóa giữ chỗ slot này trong 15 phút.

---

### 🔹 Bước 4: Khách hàng B Xác Nhận Đặt Lịch
1. Quay lại trình duyệt ẩn danh của **Khách hàng B** và tải lại trang **Hàng chờ**.
2. Bạn sẽ thấy xuất hiện **Banner màu hồng** thông báo: **"ĐÃ KHỚP SLOT & GIỮ CHỖ THÀNH CÔNG"** cùng đồng hồ đếm ngược 15 phút chạy thời gian thực.
3. Bấm nút **"Xác nhận & Thanh toán"**:
   * Trạng thái hàng chờ đổi sang **`BOOKED` (Đã đặt lịch)**.
   * Lịch hẹn chính thức dạng **`Chờ thanh toán`** được tạo ra và bạn được chuyển sang trang thanh toán hóa đơn.
   * Tại trang hàng chờ, nút **"Xem lịch hẹn 📅"** xuất hiện trên thẻ giúp bạn xem lại thông tin lịch hẹn bất cứ khi nào.

---

## 🛠️ 3. Một số công cụ hỗ trợ kiểm tra nhanh qua CSDL (Database)

Bạn có thể chạy các mã kịch bản Node.js có sẵn trong thư mục `.gemini/antigravity-ide/brain/<conversation-id>/scratch/` bằng lệnh Terminal:

* **Xem danh sách hàng chờ hiện tại (Raw DB):**
  ```bash
  node C:\Users\HELLO\.gemini\antigravity-ide\brain\da096508-24dc-4674-8f3c-9f0bde7cd4d7\scratch\raw-check.js
  ```
* **Xem lịch làm việc của KTV Linh Chi hôm nay:**
  ```bash
  node C:\Users\HELLO\.gemini\antigravity-ide\brain\da096508-24dc-4674-8f3c-9f0bde7cd4d7\scratch\check-shift.js
  ```
* **Kích hoạt động cơ so khớp cưỡng bức (Force Auto-Match):**
  ```bash
  node C:\Users\HELLO\.gemini\antigravity-ide\brain\da096508-24dc-4674-8f3c-9f0bde7cd4d7\scratch\run-match-manually.js
  ```
