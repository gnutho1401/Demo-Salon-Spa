# Hệ thống quy chuẩn giao diện Admin Beauty Salon

Cập nhật lần cuối: 2026-07-20

## 1. Mục tiêu trải nghiệm

Giao diện Admin phục vụ quản lý salon, lễ tân và nhân sự vận hành. Thiết kế phải giúp người dùng nhận biết việc cần xử lý, hiểu hậu quả trước khi xác nhận và thao tác nhanh bằng chuột, cảm ứng hoặc bàn phím.

- Cảm giác chủ đạo: ấm, cao cấp, bình tĩnh và tập trung vào vận hành.
- Ngữ cảnh nghiệp vụ: lịch hẹn, phòng trị liệu, ca làm, hồ sơ khách hàng, hội viên, thanh toán, hoàn tiền và đối soát cuối ngày.
- Mẫu nhận diện: **Nhịp vận hành / Operations Pulse** — gom các việc chờ xử lý như lịch hẹn, thanh toán, phản hồi, hoàn tiền và quyết toán vào một khu vực hành động thống nhất.
- Không dùng dashboard chung chung chỉ hiển thị số liệu mà thiếu hành động tiếp theo.

## 2. Nền tảng thị giác

### Bảng màu

| Vai trò | Giá trị | Mục đích |
| --- | --- | --- |
| Walnut 900 | `#2b1c12` | Điều hướng chính, bề mặt có độ nhấn cao |
| Walnut 700 | `#4a3222` | Nút chính, chữ trên nền ấm |
| Linen 50 | `#fffaf3` | Card, drawer và dialog |
| Linen 100 | `#f8efe4` | Nền trang, nền nhóm nội dung |
| Brass 500 | `#d6b57e` | Focus, menu đang chọn, điểm nhấn cao cấp |
| Rose 500 | `#e8396c` | Hành động và điểm nhấn liên quan khách hàng |
| Botanical 500 | `#10b981` | Thành công, hoàn tất |
| Terracotta 600 | `#a64238` | Cảnh báo nghiêm trọng, hành động phá hủy |

Chỉ dùng màu khi nó truyền đạt trạng thái, mức ưu tiên hoặc khả năng tương tác. Không thêm màu nhấn chỉ để trang trí.

### Bề mặt, khoảng cách và bo góc

- Nền trang dùng tông ấm; card có viền mờ và bóng đổ nhẹ.
- Input là bề mặt lõm; drawer và dialog nằm trên backdrop bán trong suốt có blur nhẹ.
- Đơn vị khoảng cách cơ sở: `4px`.
- Khoảng cách thường dùng: `8px`, `12px`, `16px`, `24px`, `28px`.
- Nút và input cao tối thiểu `42–44px`, bo góc `12–13px`.
- Card bo góc `16–24px`; dialog và khối hero bo góc `22–30px`.
- Giữ font stack hiện có; ưu tiên weight và letter-spacing để tạo phân cấp.
- Giá trị tiền và số liệu nên dùng tabular numerals để dễ đối chiếu.

## 3. Điều hướng Admin

Menu phải được gom theo nghiệp vụ, đúng thứ tự:

1. Tổng quan.
2. Vận hành.
3. Khách hàng & tăng trưởng.
4. Nhân sự & quyền truy cập.
5. Tài chính & kiểm soát.

Quy tắc:

- Nhãn menu dùng tiếng Việt. Tên sản phẩm như AI CRM có thể giữ song ngữ khi cần.
- Dùng duy nhất một phong cách icon nét; icon phải diễn giải chức năng, không dùng để trang trí.
- Menu đang chọn có đường nhấn màu brass, nền ấm bán trong suốt và độ tương phản chữ rõ ràng.
- Sidebar desktop bám theo viewport và có vùng cuộn riêng.
- Dưới breakpoint `992px`, sidebar chuyển thành mobile drawer.
- Sau khi chuyển route trên mobile, drawer phải tự đóng.
- Không dùng module “Tài khoản” độc lập trong Admin. Tài khoản nội bộ (`ADMIN`, `MANAGER`, `RECEPTIONIST`, `TECHNICIAN`) được quản lý tại **Nhân viên**; tài khoản `CUSTOMER` được quản lý tại **Khách hàng**.
- Mỗi tài khoản nội bộ phải có đúng một hồ sơ `Employees`; mỗi tài khoản Customer phải có đúng một hồ sơ `Customers`. Form của hai module chịu trách nhiệm cả thông tin đăng nhập, trạng thái và hồ sơ nghiệp vụ.
- Route cũ `/admin/users` chỉ dùng để chuyển hướng tương thích về `/admin/employees`; không hiển thị lại mục menu hoặc màn hình quản trị tài khoản chung.

## 4. Mobile drawer

Mọi module Admin phải kế thừa drawer dùng chung và đáp ứng đầy đủ:

- Khi đóng: drawer ẩn khỏi giao diện, không nhận pointer event và không nằm trong thứ tự focus bàn phím.
- Khi mở: hiển thị backdrop và khóa cuộn `document.body`.
- Có nút đóng rõ ràng; cho phép đóng bằng backdrop hoặc phím `Escape`.
- Nút mở khai báo `aria-controls` và `aria-expanded`.
- Header mobile dạng sticky hiển thị module hiện tại và nhận diện người dùng.
- Khi đóng drawer, phục hồi chính xác trạng thái cuộn nền trước đó.
- Tắt chuyển động không thiết yếu khi người dùng bật `prefers-reduced-motion`.

## 5. Thẻ thống kê và Nhịp vận hành

- Thẻ thống kê có thể bấm phải dùng `<button type="button">`; không dùng `<div onClick>` hoặc `<article onClick>`.
- Thẻ phải thao tác được bằng `Tab`, `Enter` và `Space` theo hành vi button chuẩn.
- Luôn có trạng thái hover, active, disabled và `:focus-visible` rõ ràng.
- Mỗi số liệu phải giải thích ý nghĩa nghiệp vụ; nếu bấm được phải có hành động cụ thể như “Xem chi tiết”.
- Grid dùng `minmax(0, 1fr)` và co theo viewport; không cố định bốn cột bằng inline style.
- Nếu có việc chờ xử lý, **Nhịp vận hành** phải xuất hiện trước phần phân tích chi tiết.
- Hoàn tiền, quyết toán hoặc bất thường tài chính dùng treatment khẩn cấp; việc chờ thông thường dùng treatment cảnh báo.

## 6. AdminConfirmDialog

`AdminConfirmDialog` là thành phần xác nhận duy nhất cho Admin. Áp dụng cho đổi trạng thái, xóa, hoàn tiền, duyệt quyết toán và mọi hành động có hậu quả.

### Nội dung bắt buộc

- Nêu rõ hành động nào sắp xảy ra và vì sao cần xác nhận.
- Hiển thị ngữ cảnh cần thiết: tên đối tượng, khách hàng, số tiền, mã giao dịch hoặc trạng thái đích.
- Dùng biến thể `warning` cho thay đổi có thể đảo ngược.
- Dùng biến thể `danger` cho xóa dữ liệu hoặc hành động tài chính.
- Nhãn nút phải mô tả hành động, ví dụ “Xác nhận hoàn tiền”, không dùng nhãn mơ hồ như “OK”.

### Hành vi và accessibility

- Không dùng `window.confirm` hoặc `window.alert` trong bất kỳ module Admin nào.
- Khi mở, focus mặc định vào hành động an toàn/hủy.
- Giữ focus bên trong dialog bằng focus trap.
- Cho phép đóng bằng `Escape` khi không có request đang chạy.
- Đặt vùng ứng dụng phía sau thành `inert` và khóa cuộn nền.
- Khi đóng, phục hồi focus về phần tử đã mở dialog và phục hồi trạng thái body.
- Trong lúc submit: vô hiệu hóa các nút, hiển thị “Đang xử lý…” và chặn đóng ngoài ý muốn.
- Không thực thi hành động phá hủy khi bấm backdrop.

## 7. Modal xem chi tiết và chỉnh sửa

Mọi modal nghiệp vụ phải neo theo viewport hiện tại, kể cả khi người dùng đã cuộn sâu trong danh sách.

- Backdrop dùng `position: fixed`, `inset: 0`, `min-height: 100dvh` và phủ cả sidebar.
- Không đặt `transform`, `filter` hoặc `backdrop-filter` trên `.admin-main-inner`; các thuộc tính này tạo containing block và làm modal bị căn giữa theo chiều cao toàn trang.
- Khi modal mở, khóa cuộn `body`; backdrop tự mở khóa khi modal đóng.
- Card modal giới hạn chiều cao theo viewport (`88–90dvh`) và cuộn nội dung bên trong.
- Modal chi tiết có nội dung trực tiếp trong card không được dùng `overflow: hidden`; nếu cần cắt theo bo góc, phải có một phần tử con `overflow-y: auto` hoặc ghi đè card thành vùng cuộn.
- Vùng cuộn modal phải hỗ trợ wheel, trackpad và thao tác chạm (`touch-action: pan-y`, momentum scrolling trên iOS).
- Tiêu đề và nút đóng phải xuất hiện ngay khi mở; không yêu cầu người dùng cuộn trang để tìm form.
- Backdrop có `overscroll-behavior: contain` để thao tác cuộn không truyền xuống trang nền.
- Kiểm thử bắt buộc ở đầu trang và sau khi cuộn ít nhất 75% chiều cao trang, trên desktop và viewport mobile `390px`.
- Không chỉ đối chiếu CSS: phải thao tác cuộn thật đến phần tử cuối của modal và xác nhận `scrollTop` thay đổi trong khi nền trang đứng yên.

## 8. Trạng thái và responsive

Mọi thành phần tương tác phải có:

- Trạng thái mặc định, hover, active, `focus-visible`, disabled và loading.
- Vùng chạm tối thiểu `42px` khi có thể.
- HTML semantic trước khi bổ sung ARIA.
- Phản hồi loading, empty, success và error cho dữ liệu từ server.
- Khả năng thao tác bàn phím tương đương chuột.
- Không tràn ngang toàn trang ở viewport `390px`; bảng rộng phải cuộn trong container riêng.

## 9. Quy tắc áp dụng cho module mới

- Tái sử dụng layout, drawer và dialog dùng chung; không tự cài đặt một phiên bản riêng trong từng trang.
- Pull request không được thêm `window.confirm`, `window.alert`, clickable `<div>` hoặc grid cột cố định.
- Trước khi hoàn tất module, kiểm tra bằng bàn phím: mở/đóng drawer, đi qua thẻ thống kê, mở dialog, focus trap, `Escape` và phục hồi focus.
- Kiểm tra tối thiểu ở desktop và viewport mobile `390px`.

Lệnh kiểm tra nhanh native dialog còn sót:

```powershell
rg -n "window\.(confirm|alert)|\bconfirm\(" frontend/src/pages/admin frontend/src/components/admin
```

## 10. Tham chiếu triển khai

- Layout và mobile drawer: `frontend/src/components/layout/AdminLayout.jsx`.
- Dialog xác nhận dùng chung: `frontend/src/components/admin/AdminConfirmDialog.jsx`.
- Dashboard, thẻ thống kê và Nhịp vận hành: `frontend/src/pages/admin/AdminDashboard.jsx`.
- Ví dụ dùng dialog: `frontend/src/pages/admin/AdminRefunds.jsx`, `frontend/src/pages/admin/AdminServices.jsx`, `frontend/src/pages/admin/AdminCustomers.jsx`, `frontend/src/pages/admin/AdminPromotions.jsx`.
- Style Admin dùng chung: `frontend/src/styles/pages/admin.css`.

Tại thời điểm cập nhật tài liệu, mã Admin không còn native `window.confirm` hoặc `alert`. Lỗi thao tác thông thường phải hiển thị bằng trạng thái nội tuyến; hành động có hậu quả phải đi qua `AdminConfirmDialog`.

## 11. Ảnh dịch vụ và hồ sơ nhân sự

Ảnh là dữ liệu nhận diện nghiệp vụ và phải dùng chung giữa mọi vai trò; không tạo bản sao khác nhau cho Admin, Lễ tân, Kỹ thuật viên và Khách hàng.

- Nguồn chuẩn duy nhất là URL tương đối `/images/...`, được backend phục vụ từ `backend/public/images`. Frontend không giữ một kho ảnh tĩnh riêng.
- `ServiceCategories.ImageUrl`, `Services.ImageUrl`, `Packages.ImageUrl` và `Promotions.ImageUrl` phải trỏ đến file tồn tại trước khi phát hành dữ liệu.
- Ảnh danh mục, dịch vụ và khuyến mãi dùng bố cục ngang, vùng chủ thể an toàn khi cắt ở tỷ lệ `3:2` hoặc `16:9`, hiển thị bằng `object-fit: cover`.
- Ảnh dịch vụ phải hấp dẫn nhưng mô tả đúng nhóm nghiệp vụ; không dùng chữ nhúng trong ảnh, logo giả, watermark hoặc bao bì có thương hiệu.
- Ảnh hồ sơ nhân viên dùng tỷ lệ vuông, chân dung người trưởng thành, diện mạo trẻ và chuyên nghiệp, ánh sáng tự nhiên, nền Salon tông linen–walnut–brass và đủ khoảng trống cho avatar tròn.
- Không dùng selfie, ảnh có watermark, đồng phục giống học sinh, bộ lọc làm đẹp quá mức hoặc ảnh người nổi tiếng.
- Với tài khoản đã liên kết nhân viên, `Users.AvatarUrl` và `Employees.ImageUrl` phải giống nhau. Khi đổi ảnh phải cập nhật hai trường trong cùng một giao dịch.
- Ảnh dự phòng theo loại dữ liệu: dịch vụ dùng `/images/services/default-service.png`; khuyến mãi dùng `/images/promotions/promo-1.png`; tài khoản dùng avatar mặc định theo vai trò.
- Mỗi thẻ ảnh phải có `alt` mô tả tên đối tượng. Ảnh thuần trang trí dùng `alt=""`.
- Khi ảnh lỗi tải, thay bằng ảnh dự phòng cùng loại và dừng sau một lần để tránh vòng lặp `onError`.

Migration chuẩn để đồng bộ URL ảnh: `database/migrations/sync_image_assets.sql`.
