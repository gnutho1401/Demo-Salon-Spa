# 📋 Bảng Phân Công Nhiệm Vụ Theo Actor (Chi tiết Commits)

> **Mục tiêu**: Phân chia hệ thống Salon & Spa thành 5 mảng dựa trên đối tượng người dùng (Actor). Mỗi lập trình viên chịu trách nhiệm xây dựng tính năng từ Database -> Backend API -> Frontend UI cho Actor của mình một cách chi tiết nhất.

---

## 📊 Tổng Quan Phân Chia Theo Actor

| Thành Viên | Phụ Trách Actor | Tổng Commit |
| :--- | :--- | :---: |
| 👨‍💻 **Dev 1** | **Customer (Khách Hàng)** | **74 Commits** |
| 👨‍💻 **Dev 2** | **Receptionist (Lễ Tân)** | **50 Commits** |
| 👨‍💻 **Dev 3** | **Technician (Kỹ Thuật Viên)** | **43 Commits** |
| 👨‍💻 **Dev 4** | **Manager / Admin (Quản Lý)** | **52 Commits** |
| 👨‍💻 **Dev 5** | **System & AI (Hệ thống Core)** | **44 Commits** |
| **TỔNG CỘNG**| **Toàn bộ hệ thống theo người dùng** | **263 Commits** |

---

## 👨‍💻 Dev 1: Customer (Khách Hàng) (74 Commits)
*Phụ trách Full-stack cho đối tượng Customer (Khách Hàng)*

### 1.1 Frontend UI/UX Khách Hàng (Commit 1 - 40)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 1.1.1 | Khởi tạo Next.js project cho Customer Web | Frontend | `feat(customer-ui): add 1 customer-ui feature` |
| 1.1.2 | Thiết lập TailwindCSS và Global Theme | Frontend | `feat(customer-ui): add 2 customer-ui feature` |
| 1.1.3 | Cài đặt và cấu hình thư viện UI Components (Shadcn/MUI) | Frontend | `chore(customer-ui): add 3 customer-ui feature` |
| 1.1.4 | Xây dựng Layout chung: Header Navbar | Frontend | `feat(customer-ui): add 4 customer-ui feature` |
| 1.1.5 | Xây dựng Layout chung: Footer | Frontend | `feat(customer-ui): add 5 customer-ui feature` |
| 1.1.6 | Xây dựng Component: Nút bấm (Button), Input Form | Frontend | `feat(customer-ui): add 6 customer-ui feature` |
| 1.1.7 | Xây dựng Trang chủ: Hero Banner | Frontend | `feat(customer-ui): add 7 customer-ui feature` |
| 1.1.8 | Xây dựng Trang chủ: Danh sách Dịch vụ Nổi bật | Frontend | `feat(customer-ui): add 8 customer-ui feature` |
| 1.1.9 | Xây dựng Trang chủ: Carousel Đánh giá Khách hàng | Frontend | `feat(customer-ui): add 9 customer-ui feature` |
| 1.1.10 | Xây dựng Trang Dịch vụ: Sidebar Lọc & Tìm kiếm | Frontend | `feat(customer-ui): add 10 customer-ui feature` |
| 1.1.11 | Xây dựng Trang Dịch vụ: Grid hiển thị dịch vụ | Frontend | `feat(customer-ui): add 11 customer-ui feature` |
| 1.1.12 | Xây dựng Component: Service Card (Thẻ dịch vụ) | Frontend | `feat(customer-ui): add 12 customer-ui feature` |
| 1.1.13 | Xây dựng Trang Chi tiết Dịch vụ: Bố cục UI | Frontend | `feat(customer-ui): add 13 customer-ui feature` |
| 1.1.14 | Tích hợp API lấy dữ liệu Chi tiết Dịch vụ | Frontend | `feat(customer-ui): add 14 customer-ui feature` |
| 1.1.15 | Xây dựng Auth Context và State Management | Frontend | `feat(customer-ui): add 15 customer-ui feature` |
| 1.1.16 | Xây dựng UI Form Đăng nhập (Login Modal) | Frontend | `feat(customer-ui): add 16 customer-ui feature` |
| 1.1.17 | Tích hợp API Đăng nhập và lưu JWT token | Frontend | `feat(customer-ui): add 17 customer-ui feature` |
| 1.1.18 | Xây dựng UI Form Đăng ký tài khoản | Frontend | `feat(customer-ui): add 18 customer-ui feature` |
| 1.1.19 | Tích hợp API Đăng ký tài khoản | Frontend | `feat(customer-ui): add 19 customer-ui feature` |
| 1.1.20 | Xây dựng UI Form Quên mật khẩu / Reset Password | Frontend | `feat(customer-ui): add 20 customer-ui feature` |
| 1.1.21 | Xây dựng Luồng Đặt lịch (Booking) Bước 1: Chọn Dịch vụ | Frontend | `feat(customer-ui): add 21 customer-ui feature` |
| 1.1.22 | Xây dựng Luồng Đặt lịch Bước 2: Chọn Ngày & Khung giờ | Frontend | `feat(customer-ui): add 22 customer-ui feature` |
| 1.1.23 | Xây dựng Luồng Đặt lịch Bước 3: Chọn Kỹ thuật viên (Optional) | Frontend | `feat(customer-ui): add 23 customer-ui feature` |
| 1.1.24 | Xây dựng Luồng Đặt lịch Bước 4: Tóm tắt & Xác nhận | Frontend | `feat(customer-ui): add 24 customer-ui feature` |
| 1.1.25 | Tích hợp API Tạo Lịch hẹn (Booking Submission) | Frontend | `feat(customer-ui): add 25 customer-ui feature` |
| 1.1.26 | Xây dựng Màn hình Chờ Thanh toán (Redirect to VNPay) | Frontend | `feat(customer-ui): add 26 customer-ui feature` |
| 1.1.27 | Xây dựng Trang Kết quả Đặt lịch Thành công / Thất bại | Frontend | `feat(customer-ui): add 27 customer-ui feature` |
| 1.1.28 | Xây dựng Trang Cá nhân: Bố cục Layout | Frontend | `feat(customer-ui): add 28 customer-ui feature` |
| 1.1.29 | Xây dựng Trang Cá nhân: Form Cập nhật Thông tin | Frontend | `feat(customer-ui): add 29 customer-ui feature` |
| 1.1.30 | Tích hợp API Cập nhật Hồ sơ Khách hàng | Frontend | `feat(customer-ui): add 30 customer-ui feature` |
| 1.1.31 | Xây dựng Trang Cá nhân: Danh sách Lịch sử Cuộc hẹn | Frontend | `feat(customer-ui): add 31 customer-ui feature` |
| 1.1.32 | Xây dựng Modal xem Chi tiết Cuộc hẹn đã qua | Frontend | `feat(customer-ui): add 32 customer-ui feature` |
| 1.1.33 | Xây dựng Tính năng Hủy Cuộc hẹn (Dành cho khách) | Frontend | `feat(customer-ui): add 33 customer-ui feature` |
| 1.1.34 | Xây dựng UI hiển thị Điểm thưởng (Loyalty Points) | Frontend | `feat(customer-ui): add 34 customer-ui feature` |
| 1.1.35 | Xây dựng Component Nhập Mã Giảm Giá (Voucher) | Frontend | `feat(customer-ui): add 35 customer-ui feature` |
| 1.1.36 | Tích hợp API Áp dụng Mã Giảm Giá khi Đặt lịch | Frontend | `feat(customer-ui): add 36 customer-ui feature` |
| 1.1.37 | Xây dựng Modal Viết Đánh giá (Rating & Review) | Frontend | `feat(customer-ui): add 37 customer-ui feature` |
| 1.1.38 | Tích hợp API Gửi Đánh giá Dịch vụ | Frontend | `feat(customer-ui): add 38 customer-ui feature` |
| 1.1.39 | Responsive Design: Tối ưu UI Đặt lịch trên Mobile | Frontend | `perf(customer-ui): add 39 customer-ui feature` |
| 1.1.40 | Tối ưu UX: Thêm Skeleton Loading cho các danh sách | Frontend | `perf(customer-ui): add 40 customer-ui feature` |

### 1.2 Backend API Khách Hàng (Commit 41 - 64)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 1.2.1 | Khởi tạo cấu trúc module Customer API | Backend | `feat(customer-api): add 41 customer-api feature` |
| 1.2.2 | Tạo Base DTOs cho Customer Requests/Responses | Backend | `feat(customer-api): add 42 customer-api feature` |
| 1.2.3 | API Lấy danh mục Dịch vụ public | Backend | `feat(customer-api): add 43 customer-api feature` |
| 1.2.4 | API Lấy danh sách Dịch vụ public (Có phân trang) | Backend | `feat(customer-api): add 44 customer-api feature` |
| 1.2.5 | API Tìm kiếm Dịch vụ theo từ khóa | Backend | `feat(customer-api): add 45 customer-api feature` |
| 1.2.6 | API Lấy chi tiết Dịch vụ theo ID | Backend | `feat(customer-api): add 46 customer-api feature` |
| 1.2.7 | API Đăng ký Khách hàng (Hash password bcrypt) | Backend | `feat(customer-api): add 47 customer-api feature` |
| 1.2.8 | API Đăng nhập Khách hàng (Tạo JWT token) | Backend | `feat(customer-api): add 48 customer-api feature` |
| 1.2.9 | API Lấy thông tin Hồ sơ Khách hàng (Get Profile) | Backend | `feat(customer-api): add 49 customer-api feature` |
| 1.2.10 | API Cập nhật thông tin Hồ sơ Khách hàng | Backend | `feat(customer-api): add 50 customer-api feature` |
| 1.2.11 | API Lấy các Khung giờ rảnh theo Ngày | Backend | `feat(customer-api): add 51 customer-api feature` |
| 1.2.12 | API Lấy danh sách Kỹ thuật viên rảnh theo Khung giờ | Backend | `feat(customer-api): add 52 customer-api feature` |
| 1.2.13 | API Xác thực và Tính toán Mã giảm giá (Voucher Valid) | Backend | `feat(customer-api): add 53 customer-api feature` |
| 1.2.14 | API Tính tổng tiền Đơn đặt lịch (Tạm tính) | Backend | `feat(customer-api): add 54 customer-api feature` |
| 1.2.15 | API Tạo Lịch hẹn mới (Booking Transaction) | Backend | `feat(customer-api): add 55 customer-api feature` |
| 1.2.16 | API Lấy danh sách Lịch sử Đặt lịch của Khách hàng | Backend | `feat(customer-api): add 56 customer-api feature` |
| 1.2.17 | API Lấy Chi tiết một Lịch hẹn của Khách hàng | Backend | `feat(customer-api): add 57 customer-api feature` |
| 1.2.18 | API Hủy Lịch hẹn (Customer Cancel) | Backend | `feat(customer-api): add 58 customer-api feature` |
| 1.2.19 | API Lấy số Điểm thưởng (Loyalty) hiện tại | Backend | `feat(customer-api): add 59 customer-api feature` |
| 1.2.20 | API Gửi Đánh giá (Review) cho Dịch vụ | Backend | `feat(customer-api): add 60 customer-api feature` |
| 1.2.21 | API Lấy danh sách Đánh giá của một Dịch vụ | Backend | `feat(customer-api): add 61 customer-api feature` |
| 1.2.22 | Tích hợp thư viện thanh toán VNPay | Backend | `feat(customer-api): add 62 customer-api feature` |
| 1.2.23 | API Tạo URL Thanh toán VNPay | Backend | `feat(customer-api): add 63 customer-api feature` |
| 1.2.24 | API IPN Handler xử lý Callback từ VNPay | Backend | `feat(customer-api): add 64 customer-api feature` |

### 1.3 Database Khách Hàng (Commit 65 - 74)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 1.3.1 | Tạo Migration bảng customer_profiles | Core/DB | `feat(customer-db): add 65 customer-db feature` |
| 1.3.2 | Tạo Migration bảng customer_addresses | Core/DB | `feat(customer-db): add 66 customer-db feature` |
| 1.3.3 | Tạo Migration bảng appointments (Lịch hẹn) | Core/DB | `feat(customer-db): add 67 customer-db feature` |
| 1.3.4 | Tạo Migration bảng appointment_services (Bảng trung gian) | Core/DB | `feat(customer-db): add 68 customer-db feature` |
| 1.3.5 | Tạo Migration bảng reviews (Đánh giá) | Core/DB | `feat(customer-db): add 69 customer-db feature` |
| 1.3.6 | Tạo Migration bảng favorite_services | Core/DB | `feat(customer-db): add 70 customer-db feature` |
| 1.3.7 | Viết Seeder tạo 50 tài khoản Khách hàng giả lập | Core/DB | `feat(customer-db): add 71 customer-db feature` |
| 1.3.8 | Viết Seeder tạo dữ liệu Đánh giá giả lập | Core/DB | `feat(customer-db): add 72 customer-db feature` |
| 1.3.9 | Tối ưu hóa Database: Đánh Index cho bảng appointments | Core/DB | `perf(customer-db): add 73 customer-db feature` |
| 1.3.10 | Tối ưu hóa Database: Đánh Index phục vụ tìm kiếm Khách hàng | Core/DB | `perf(customer-db): add 74 customer-db feature` |


---
## 👨‍💻 Dev 2: Receptionist (Lễ Tân) (50 Commits)
*Phụ trách Full-stack cho đối tượng Receptionist (Lễ Tân)*

### 2.1 Frontend Portal Lễ Tân (Commit 1 - 24)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 2.1.1 | Khởi tạo React SPA / Next.js cho Receptionist Portal | Core/DB | `feat(reception-ui): add 1 reception-ui feature` |
| 2.1.2 | Cấu hình Layout Lễ tân: Sidebar & Header | Core/DB | `chore(reception-ui): add 2 reception-ui feature` |
| 2.1.3 | Xây dựng Dashboard Tổng quan: Thống kê số lịch hẹn trong ngày | Core/DB | `feat(reception-ui): add 3 reception-ui feature` |
| 2.1.4 | Xây dựng Giao diện Lịch biểu dạng Timeline (Resource Calendar) | Core/DB | `feat(reception-ui): add 4 reception-ui feature` |
| 2.1.5 | Xây dựng Component hiển thị Chi tiết Slot đặt lịch | Core/DB | `feat(reception-ui): add 5 reception-ui feature` |
| 2.1.6 | Xây dựng Danh sách Khách đã Đặt trước (Booked List) | Core/DB | `feat(reception-ui): add 6 reception-ui feature` |
| 2.1.7 | Xây dựng Bảng Quản lý Hàng chờ (Walk-in Queue Board) | Core/DB | `feat(reception-ui): add 7 reception-ui feature` |
| 2.1.8 | Phát triển tính năng Kéo Thả (Drag & Drop) trên Bảng Hàng chờ | Core/DB | `feat(reception-ui): add 8 reception-ui feature` |
| 2.1.9 | Xây dựng Modal Check-in Khách hàng đến tiệm | Core/DB | `feat(reception-ui): add 9 reception-ui feature` |
| 2.1.10 | Xây dựng Form Thêm Khách hàng mới (Quick Add) | Core/DB | `feat(reception-ui): add 10 reception-ui feature` |
| 2.1.11 | Tích hợp API Tra cứu nhanh Khách hàng theo SĐT | Core/DB | `feat(reception-ui): add 11 reception-ui feature` |
| 2.1.12 | Xây dựng Giao diện Phân công Kỹ thuật viên (Assign Tech) | Core/DB | `feat(reception-ui): add 12 reception-ui feature` |
| 2.1.13 | Tích hợp API Phân công KTV Tự động (Auto Assign) | Core/DB | `feat(reception-ui): add 13 reception-ui feature` |
| 2.1.14 | Xây dựng Modal Ghi đè KTV thủ công (Manual Assign) | Core/DB | `feat(reception-ui): add 14 reception-ui feature` |
| 2.1.15 | Xây dựng Màn hình Bán hàng (POS) tại quầy | Core/DB | `feat(reception-ui): add 15 reception-ui feature` |
| 2.1.16 | Xây dựng Giỏ hàng POS: Chọn Dịch vụ, Sản phẩm | Core/DB | `feat(reception-ui): add 16 reception-ui feature` |
| 2.1.17 | Xây dựng Giỏ hàng POS: Tính toán Tổng tiền, Thuế | Core/DB | `feat(reception-ui): add 17 reception-ui feature` |
| 2.1.18 | Tích hợp Form nhập Mã giảm giá tại màn hình POS | Core/DB | `feat(reception-ui): add 18 reception-ui feature` |
| 2.1.19 | Xây dựng Modal Chọn Phương thức Thanh toán (Tiền mặt, Thẻ, CK) | Core/DB | `feat(reception-ui): add 19 reception-ui feature` |
| 2.1.20 | Xây dựng Giao diện Hóa đơn In (Print Receipt Template) | Core/DB | `feat(reception-ui): add 20 reception-ui feature` |
| 2.1.21 | Tích hợp API Xác nhận Thanh toán POS | Core/DB | `feat(reception-ui): add 21 reception-ui feature` |
| 2.1.22 | Cấu hình In Hóa đơn tự động qua Web Print API | Core/DB | `chore(reception-ui): add 22 reception-ui feature` |
| 2.1.23 | Xây dựng Trang Quản lý Lịch sử Hóa đơn trong ca làm việc | Core/DB | `feat(reception-ui): add 23 reception-ui feature` |
| 2.1.24 | Xây dựng UI Báo cáo Cuối ca / Chốt ca Lễ tân | Core/DB | `feat(reception-ui): add 24 reception-ui feature` |

### 2.2 Backend API Lễ Tân (Commit 25 - 43)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 2.2.1 | Khởi tạo cấu trúc module Reception API | Backend | `feat(reception-api): add 25 reception-api feature` |
| 2.2.2 | API Lấy danh sách Lịch hẹn của Ngày hôm nay | Backend | `feat(reception-api): add 26 reception-api feature` |
| 2.2.3 | API Đổi trạng thái Lịch hẹn sang Checked-In | Backend | `feat(reception-api): add 27 reception-api feature` |
| 2.2.4 | API Đổi trạng thái Lịch hẹn sang No-Show | Backend | `feat(reception-api): add 28 reception-api feature` |
| 2.2.5 | API Thêm Khách hàng Walk-in vào Hàng chờ | Backend | `feat(reception-api): add 29 reception-api feature` |
| 2.2.6 | API Tra cứu nhanh Khách hàng bằng Số điện thoại | Backend | `feat(reception-api): add 30 reception-api feature` |
| 2.2.7 | API Tạo mới Khách hàng nhanh tại quầy | Backend | `feat(reception-api): add 31 reception-api feature` |
| 2.2.8 | API Lấy danh sách Kỹ thuật viên đang làm việc (Clocked-In) | Backend | `feat(reception-api): add 32 reception-api feature` |
| 2.2.9 | API Lấy trạng thái Rảnh/Bận của các Kỹ thuật viên hiện tại | Backend | `feat(reception-api): add 33 reception-api feature` |
| 2.2.10 | API Thuật toán Gán KTV Tự động cho Khách Walk-in (Load Balancing) | Backend | `feat(reception-api): add 34 reception-api feature` |
| 2.2.11 | API Ghi đè Gán KTV thủ công (Manual Assign Override) | Backend | `feat(reception-api): add 35 reception-api feature` |
| 2.2.12 | API Lấy dữ liệu Ma trận Lịch biểu (Calendar Matrix Data) | Backend | `feat(reception-api): add 36 reception-api feature` |
| 2.2.13 | API Khởi tạo Đơn hàng POS (Tạo Invoice tạm) | Backend | `feat(reception-api): add 37 reception-api feature` |
| 2.2.14 | API Thêm/Xóa Dịch vụ vào Đơn hàng POS | Backend | `feat(reception-api): add 38 reception-api feature` |
| 2.2.15 | API Tính toán Giá cuối cùng (Bao gồm Voucher, Tax) cho POS | Backend | `feat(reception-api): add 39 reception-api feature` |
| 2.2.16 | API Hoàn tất Thanh toán Đơn hàng POS | Backend | `feat(reception-api): add 40 reception-api feature` |
| 2.2.17 | API Cộng điểm Loyalty cho Khách sau khi hoàn tất Đơn | Backend | `feat(reception-api): add 41 reception-api feature` |
| 2.2.18 | API Lấy danh sách Hóa đơn đã xuất trong ngày | Backend | `feat(reception-api): add 42 reception-api feature` |
| 2.2.19 | API Xuất Báo cáo Doanh thu theo Ca làm việc (Shift Report) | Backend | `feat(reception-api): add 43 reception-api feature` |

### 2.3 Database Lễ Tân (Commit 44 - 50)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 2.3.1 | Tạo Migration bảng walk_in_queues | Core/DB | `feat(reception-db): add 44 reception-db feature` |
| 2.3.2 | Tạo Migration bảng invoices (Hóa đơn) | Core/DB | `feat(reception-db): add 45 reception-db feature` |
| 2.3.3 | Tạo Migration bảng invoice_details (Chi tiết Hóa đơn) | Core/DB | `feat(reception-db): add 46 reception-db feature` |
| 2.3.4 | Tạo Migration bảng pos_sessions (Phiên làm việc POS) | Core/DB | `feat(reception-db): add 47 reception-db feature` |
| 2.3.5 | Viết Seeder tạo dữ liệu Hóa đơn giả lập cho test | Core/DB | `feat(reception-db): add 48 reception-db feature` |
| 2.3.6 | Tối ưu hóa Database: Index trạng thái Lịch hẹn hôm nay | Core/DB | `perf(reception-db): add 49 reception-db feature` |
| 2.3.7 | Thiết lập Quan hệ DB giữa Invoices và Appointments | Core/DB | `feat(reception-db): add 50 reception-db feature` |


---
## 👨‍💻 Dev 3: Technician (Kỹ Thuật Viên) (43 Commits)
*Phụ trách Full-stack cho đối tượng Technician (Kỹ Thuật Viên)*

### 3.1 Frontend Portal Kỹ Thuật Viên (Commit 1 - 20)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 3.1.1 | Khởi tạo React SPA / PWA cho Technician Portal (Tối ưu Mobile) | Core/DB | `perf(tech-ui): add 1 tech-ui feature` |
| 3.1.2 | Xây dựng Bố cục Mobile-first: Bottom Navigation | Core/DB | `feat(tech-ui): add 2 tech-ui feature` |
| 3.1.3 | Xây dựng Màn hình Lịch làm việc cá nhân (My Schedule) | Core/DB | `feat(tech-ui): add 3 tech-ui feature` |
| 3.1.4 | Tích hợp API Lấy danh sách Lịch làm việc trong Tuần | Core/DB | `feat(tech-ui): add 4 tech-ui feature` |
| 3.1.5 | Xây dựng Màn hình Nhiệm vụ Hôm nay (Today's Tasks) | Core/DB | `feat(tech-ui): add 5 tech-ui feature` |
| 3.1.6 | Xây dựng Component Card Khách hàng (Hiển thị Dịch vụ, Giờ) | Core/DB | `feat(tech-ui): add 6 tech-ui feature` |
| 3.1.7 | Xây dựng Component Nút Đổi trạng thái (Bắt đầu -> Hoàn thành) | Core/DB | `feat(tech-ui): add 7 tech-ui feature` |
| 3.1.8 | Tích hợp API Cập nhật trạng thái In-Service / Completed | Core/DB | `feat(tech-ui): add 8 tech-ui feature` |
| 3.1.9 | Xây dựng Màn hình Hồ sơ Sức khỏe / Da / Tóc của Khách | Core/DB | `feat(tech-ui): add 9 tech-ui feature` |
| 3.1.10 | Tích hợp API Lấy Lịch sử Khám trước đây của Khách | Core/DB | `feat(tech-ui): add 10 tech-ui feature` |
| 3.1.11 | Xây dựng Form Nhập Ghi chú Liệu trình (Treatment Notes) | Core/DB | `feat(tech-ui): add 11 tech-ui feature` |
| 3.1.12 | Xây dựng Component Upload Ảnh Before/After | Core/DB | `feat(tech-ui): add 12 tech-ui feature` |
| 3.1.13 | Tích hợp API Lưu Ghi chú & Upload Ảnh lên Server | Core/DB | `feat(tech-ui): add 13 tech-ui feature` |
| 3.1.14 | Xây dựng Trang Theo dõi Hoa hồng (Commission Tracking) | Core/DB | `feat(tech-ui): add 14 tech-ui feature` |
| 3.1.15 | Tích hợp API Báo cáo Thu nhập & Hoa hồng Cá nhân | Core/DB | `feat(tech-ui): add 15 tech-ui feature` |
| 3.1.16 | Xây dựng Form Xin nghỉ phép / Đổi ca | Core/DB | `feat(tech-ui): add 16 tech-ui feature` |
| 3.1.17 | Tích hợp API Gửi Yêu cầu Xin nghỉ / Đổi ca | Core/DB | `feat(tech-ui): add 17 tech-ui feature` |
| 3.1.18 | Xây dựng Màn hình Thông báo (Push Notifications cho KTV) | Core/DB | `feat(tech-ui): add 18 tech-ui feature` |
| 3.1.19 | Tích hợp Socket.io để nhận thông báo có khách mới gán | Core/DB | `feat(tech-ui): add 19 tech-ui feature` |
| 3.1.20 | Tối ưu UX PWA: Hỗ trợ Offline lưu Ghi chú tạm thời | Core/DB | `perf(tech-ui): add 20 tech-ui feature` |

### 3.2 Backend API Kỹ Thuật Viên (Commit 21 - 35)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 3.2.1 | Khởi tạo cấu trúc module Tech API | Backend | `feat(tech-api): add 21 tech-api feature` |
| 3.2.2 | Viết Middleware RBAC Guard chuyên biệt cho Role Technician | Backend | `feat(tech-api): add 22 tech-api feature` |
| 3.2.3 | API Lấy Lịch làm việc tuần (Shifts) của KTV hiện tại | Backend | `feat(tech-api): add 23 tech-api feature` |
| 3.2.4 | API Lấy danh sách Nhiệm vụ (Appointments) trong ngày | Backend | `feat(tech-api): add 24 tech-api feature` |
| 3.2.5 | API Đổi trạng thái Lịch hẹn -> Đang phục vụ (In-Service) | Backend | `feat(tech-api): add 25 tech-api feature` |
| 3.2.6 | API Đổi trạng thái Lịch hẹn -> Hoàn thành (Completed) | Backend | `feat(tech-api): add 26 tech-api feature` |
| 3.2.7 | API Lấy Lịch sử Dịch vụ/Liệu trình của một Khách hàng | Backend | `feat(tech-api): add 27 tech-api feature` |
| 3.2.8 | API Lưu Ghi chú Liệu trình mới vào DB | Backend | `feat(tech-api): add 28 tech-api feature` |
| 3.2.9 | Tích hợp Cloudinary/AWS S3 để xử lý Upload Ảnh | Backend | `feat(tech-api): add 29 tech-api feature` |
| 3.2.10 | API Upload Ảnh Before/After liệu trình | Backend | `feat(tech-api): add 30 tech-api feature` |
| 3.2.11 | API Lấy Báo cáo Hoa hồng Cá nhân theo Tháng/Tuần | Backend | `feat(tech-api): add 31 tech-api feature` |
| 3.2.12 | API Tính toán Tỷ lệ phần trăm hoa hồng dựa trên cấu hình | Backend | `chore(tech-api): add 32 tech-api feature` |
| 3.2.13 | API Nộp Đơn xin nghỉ phép / Đổi ca làm việc | Backend | `feat(tech-api): add 33 tech-api feature` |
| 3.2.14 | API Lấy danh sách các Đơn xin nghỉ đã gửi | Backend | `feat(tech-api): add 34 tech-api feature` |
| 3.2.15 | Tích hợp Socket.io: Gửi sự kiện cho KTV khi có Lịch hẹn mới | Backend | `feat(tech-api): add 35 tech-api feature` |

### 3.3 Database Kỹ Thuật Viên (Commit 36 - 43)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 3.3.1 | Tạo Migration bảng treatment_notes | Core/DB | `feat(tech-db): add 36 tech-db feature` |
| 3.3.2 | Tạo Migration bảng treatment_images | Core/DB | `feat(tech-db): add 37 tech-db feature` |
| 3.3.3 | Tạo Migration bảng employee_leaves (Đơn xin nghỉ) | Core/DB | `feat(tech-db): add 38 tech-db feature` |
| 3.3.4 | Tạo Migration bảng commission_rates (Tỷ lệ hoa hồng) | Core/DB | `feat(tech-db): add 39 tech-db feature` |
| 3.3.5 | Tạo Migration bảng commission_logs (Lịch sử nhận hoa hồng) | Core/DB | `feat(tech-db): add 40 tech-db feature` |
| 3.3.6 | Viết Seeder tạo dữ liệu Ghi chú Liệu trình giả lập | Core/DB | `feat(tech-db): add 41 tech-db feature` |
| 3.3.7 | Viết Seeder tạo dữ liệu Hoa hồng giả lập | Core/DB | `feat(tech-db): add 42 tech-db feature` |
| 3.3.8 | Đánh Index bảng treatment_notes theo customer_id | Core/DB | `perf(tech-db): add 43 tech-db feature` |


---
## 👨‍💻 Dev 4: Manager / Admin (Quản Lý) (52 Commits)
*Phụ trách Full-stack cho đối tượng Manager / Admin (Quản Lý)*

### 4.1 Frontend CMS Admin (Commit 1 - 23)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 4.1.1 | Khởi tạo React Admin Dashboard (Sử dụng Ant Design/MUI) | Core/DB | `feat(admin-ui): add 1 admin-ui feature` |
| 4.1.2 | Xây dựng Bố cục Dashboard: Sidebar, Header, Breadcrumbs | Core/DB | `feat(admin-ui): add 2 admin-ui feature` |
| 4.1.3 | Xây dựng Component Chart Doanh thu theo Ngày/Tháng (Recharts/Chart.js) | Core/DB | `feat(admin-ui): add 3 admin-ui feature` |
| 4.1.4 | Xây dựng Component Chart Hiệu suất Kỹ thuật viên | Core/DB | `feat(admin-ui): add 4 admin-ui feature` |
| 4.1.5 | Xây dựng Bảng Danh sách Nhân viên (Data Table có Phân trang, Lọc) | Core/DB | `feat(admin-ui): add 5 admin-ui feature` |
| 4.1.6 | Xây dựng Form Thêm mới Nhân viên (Tạo tài khoản) | Core/DB | `feat(admin-ui): add 6 admin-ui feature` |
| 4.1.7 | Xây dựng Form Chỉnh sửa Thông tin & Đổi Role Nhân viên | Core/DB | `feat(admin-ui): add 7 admin-ui feature` |
| 4.1.8 | Tích hợp API CRUD Nhân viên | Core/DB | `feat(admin-ui): add 8 admin-ui feature` |
| 4.1.9 | Xây dựng Giao diện Xếp ca làm việc (Shift Scheduler Matrix) | Core/DB | `feat(admin-ui): add 9 admin-ui feature` |
| 4.1.10 | Phát triển tính năng Copy Ca làm việc từ tuần trước | Core/DB | `feat(admin-ui): add 10 admin-ui feature` |
| 4.1.11 | Xây dựng Trang Quản lý Danh mục Dịch vụ | Core/DB | `feat(admin-ui): add 11 admin-ui feature` |
| 4.1.12 | Xây dựng Form Tạo Dịch vụ mới (Hỗ trợ Upload Ảnh) | Core/DB | `feat(admin-ui): add 12 admin-ui feature` |
| 4.1.13 | Xây dựng Trang Quản lý Combo / Packages | Core/DB | `feat(admin-ui): add 13 admin-ui feature` |
| 4.1.14 | Xây dựng Modal Build Combo (Kéo thả chọn nhiều dịch vụ) | Core/DB | `feat(admin-ui): add 14 admin-ui feature` |
| 4.1.15 | Tích hợp API CRUD Dịch vụ và Combo | Core/DB | `feat(admin-ui): add 15 admin-ui feature` |
| 4.1.16 | Xây dựng Bảng Danh sách Mã giảm giá (Vouchers) | Core/DB | `feat(admin-ui): add 16 admin-ui feature` |
| 4.1.17 | Xây dựng Form Cấu hình Voucher nâng cao (Số lượng, Ngày hết hạn, % Giảm) | Core/DB | `chore(admin-ui): add 17 admin-ui feature` |
| 4.1.18 | Tích hợp API CRUD Mã giảm giá | Core/DB | `feat(admin-ui): add 18 admin-ui feature` |
| 4.1.19 | Xây dựng Trang Duyệt Đơn xin nghỉ phép của Nhân viên | Core/DB | `feat(admin-ui): add 19 admin-ui feature` |
| 4.1.20 | Xây dựng Màn hình Cài đặt Hệ thống (Giờ hoạt động, Thông tin Tiệm) | Core/DB | `feat(admin-ui): add 20 admin-ui feature` |
| 4.1.21 | Tích hợp API Cập nhật Cài đặt Tiệm | Core/DB | `feat(admin-ui): add 21 admin-ui feature` |
| 4.1.22 | Tối ưu UI: Thêm Toast Notifications cho các thao tác CRUD | Core/DB | `perf(admin-ui): add 22 admin-ui feature` |
| 4.1.23 | Xây dựng Chức năng Export Báo cáo Doanh thu ra file Excel | Core/DB | `feat(admin-ui): add 23 admin-ui feature` |

### 4.2 Backend API Quản Lý (Commit 24 - 42)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 4.2.1 | Khởi tạo cấu trúc module Admin API | Backend | `feat(admin-api): add 24 admin-api feature` |
| 4.2.2 | API Thống kê Doanh thu (Group by Day/Month/Year) | Backend | `feat(admin-api): add 25 admin-api feature` |
| 4.2.3 | API Thống kê Hiệu suất (Số đơn, Doanh số) theo Nhân viên | Backend | `feat(admin-api): add 26 admin-api feature` |
| 4.2.4 | API Báo cáo Top Dịch vụ Bán chạy nhất | Backend | `feat(admin-api): add 27 admin-api feature` |
| 4.2.5 | API CRUD Lấy danh sách Nhân viên (Tìm kiếm, Phân trang) | Backend | `feat(admin-api): add 28 admin-api feature` |
| 4.2.6 | API Thêm Nhân viên mới (Kèm tạo User Account) | Backend | `feat(admin-api): add 29 admin-api feature` |
| 4.2.7 | API Cập nhật thông tin Nhân viên | Backend | `feat(admin-api): add 30 admin-api feature` |
| 4.2.8 | API Khóa / Mở khóa Tài khoản Nhân viên | Backend | `feat(admin-api): add 31 admin-api feature` |
| 4.2.9 | API CRUD Lấy danh sách Ca làm việc của hệ thống | Backend | `feat(admin-api): add 32 admin-api feature` |
| 4.2.10 | API Phân ca làm việc hàng loạt (Bulk Shift Assignment) | Backend | `feat(admin-api): add 33 admin-api feature` |
| 4.2.11 | API CRUD Lấy danh mục & Dịch vụ | Backend | `feat(admin-api): add 34 admin-api feature` |
| 4.2.12 | API Thêm mới / Cập nhật Dịch vụ | Backend | `feat(admin-api): add 35 admin-api feature` |
| 4.2.13 | API CRUD Gói Dịch vụ (Combo) | Backend | `feat(admin-api): add 36 admin-api feature` |
| 4.2.14 | API Thiết lập cấu trúc Dịch vụ con trong Combo | Backend | `feat(admin-api): add 37 admin-api feature` |
| 4.2.15 | API CRUD Mã giảm giá (Vouchers) | Backend | `feat(admin-api): add 38 admin-api feature` |
| 4.2.16 | API Lấy danh sách Đơn xin nghỉ chờ duyệt | Backend | `feat(admin-api): add 39 admin-api feature` |
| 4.2.17 | API Duyệt / Từ chối Đơn xin nghỉ phép | Backend | `feat(admin-api): add 40 admin-api feature` |
| 4.2.18 | API Cập nhật Cấu hình Tiệm (Giờ mở/đóng cửa, Quy định) | Backend | `chore(admin-api): add 41 admin-api feature` |
| 4.2.19 | Phát triển service xuất Excel (xlsx) Báo cáo Doanh thu | Backend | `feat(admin-api): add 42 admin-api feature` |

### 4.3 Database Quản Lý (Commit 43 - 52)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 4.3.1 | Tạo Migration bảng vouchers | Core/DB | `feat(admin-db): add 43 admin-db feature` |
| 4.3.2 | Tạo Migration bảng promotions | Core/DB | `feat(admin-db): add 44 admin-db feature` |
| 4.3.3 | Tạo Migration bảng salon_settings | Core/DB | `feat(admin-db): add 45 admin-db feature` |
| 4.3.4 | Tạo Migration bảng combo_service_items (Bảng trung gian) | Core/DB | `feat(admin-db): add 46 admin-db feature` |
| 4.3.5 | Tạo Migration bảng shifts (Ca làm việc) | Core/DB | `feat(admin-db): add 47 admin-db feature` |
| 4.3.6 | Tạo Migration bảng employee_shifts | Core/DB | `feat(admin-db): add 48 admin-db feature` |
| 4.3.7 | Viết Seeder tạo dữ liệu Dịch vụ & Combo mặc định | Core/DB | `feat(admin-db): add 49 admin-db feature` |
| 4.3.8 | Viết Seeder tạo Mã giảm giá test | Core/DB | `feat(admin-db): add 50 admin-db feature` |
| 4.3.9 | Đánh Index tối ưu truy vấn Báo cáo Doanh thu | Core/DB | `perf(admin-db): add 51 admin-db feature` |
| 4.3.10 | Đánh Index tối ưu truy vấn Ca làm việc | Core/DB | `perf(admin-db): add 52 admin-db feature` |


---
## 👨‍💻 Dev 5: System & AI (Hệ thống Core) (44 Commits)
*Phụ trách Full-stack cho đối tượng System & AI (Hệ thống Core)*

### 5.1 Core System & DevOps (Commit 1 - 15)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 5.1.1 | Khởi tạo cấu trúc Monorepo (Turborepo/Nx) | Core/DB | `feat(core): add 1 core feature` |
| 5.1.2 | Thiết lập Node.js Express server base | Core/DB | `feat(core): add 2 core feature` |
| 5.1.3 | Cấu hình ESLint, Prettier, Husky Pre-commit hooks | Core/DB | `chore(core): add 3 core feature` |
| 5.1.4 | Cấu hình ORM (Prisma/TypeORM/Sequelize) kết nối DB | Core/DB | `chore(core): add 4 core feature` |
| 5.1.5 | Viết Global Error Handler Middleware | Core/DB | `feat(core): add 5 core feature` |
| 5.1.6 | Viết JWT Authentication Middleware | Core/DB | `feat(core): add 6 core feature` |
| 5.1.7 | Viết Role-Based Access Control (RBAC) Guard Middleware | Core/DB | `feat(core): add 7 core feature` |
| 5.1.8 | Cấu hình CORS, Helmet, Rate Limiting bảo mật | Core/DB | `chore(core): add 8 core feature` |
| 5.1.9 | Thiết lập Hệ thống Logging (Winston/Morgan) | Core/DB | `feat(core): add 9 core feature` |
| 5.1.10 | Khởi tạo WebSocket Server (Socket.io) cho Real-time | Core/DB | `feat(core): add 10 core feature` |
| 5.1.11 | Viết Script PowerShell Start/Stop Hệ thống tự động | Core/DB | `feat(core): add 11 core feature` |
| 5.1.12 | Cấu hình Nginx / Cloudflare Tunnel / Ngrok tĩnh | Core/DB | `chore(core): add 12 core feature` |
| 5.1.13 | Cấu hình CI/CD cơ bản (GitHub Actions) | Core/DB | `chore(core): add 13 core feature` |
| 5.1.14 | Viết Tài liệu API Document (Swagger/OpenAPI) | Core/DB | `feat(core): add 14 core feature` |
| 5.1.15 | Tối ưu Performance: Caching cấu hình hệ thống bằng Redis (hoặc memory) | Core/DB | `chore(core): add 15 core feature` |

### 5.2 AI Worker (Python/FastAPI) (Commit 16 - 31)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 5.2.1 | Khởi tạo dự án Python FastAPI | Backend | `feat(ai-worker): add 16 ai-worker feature` |
| 5.2.2 | Cấu hình Uvicorn, CORS, Dotenv cho Worker | Backend | `chore(ai-worker): add 17 ai-worker feature` |
| 5.2.3 | Cài đặt dependencies: OpenCV, PyTorch, NumPy | Backend | `feat(ai-worker): add 18 ai-worker feature` |
| 5.2.4 | Phát triển Endpoint Nhận ảnh Upload dạng Multipart/Form-data | Backend | `feat(ai-worker): add 19 ai-worker feature` |
| 5.2.5 | Phát triển Endpoint Nhận ảnh Upload dạng Base64 | Backend | `feat(ai-worker): add 20 ai-worker feature` |
| 5.2.6 | Viết module Tiền xử lý Ảnh: Resize, Normalize, Crop | Backend | `feat(ai-worker): add 21 ai-worker feature` |
| 5.2.7 | Tích hợp Model Phân tích Da (Skin Analysis) | Backend | `feat(ai-worker): add 22 ai-worker feature` |
| 5.2.8 | Phát triển Thuật toán đếm và định vị Mụn trên ảnh | Backend | `feat(ai-worker): add 23 ai-worker feature` |
| 5.2.9 | Phát triển Thuật toán đánh giá Nếp nhăn & Độ ẩm da | Backend | `feat(ai-worker): add 24 ai-worker feature` |
| 5.2.10 | Tích hợp Model Thử Kiểu Tóc Ảo (Hair Try-on GAN) | Backend | `feat(ai-worker): add 25 ai-worker feature` |
| 5.2.11 | Phát triển Thuật toán căn chỉnh khuôn mặt (Face Alignment) | Backend | `feat(ai-worker): add 26 ai-worker feature` |
| 5.2.12 | Phát triển logic ghép Layer tóc lên khuôn mặt | Backend | `feat(ai-worker): add 27 ai-worker feature` |
| 5.2.13 | Viết Endpoint trả về ảnh kết quả Base64/URL | Backend | `feat(ai-worker): add 28 ai-worker feature` |
| 5.2.14 | Xây dựng Node.js Gateway Http Client gọi sang Python | Backend | `feat(ai-worker): add 29 ai-worker feature` |
| 5.2.15 | Phát triển cơ chế Queue xử lý ảnh bất đồng bộ tránh block server | Backend | `feat(ai-worker): add 30 ai-worker feature` |
| 5.2.16 | Cấu hình Dockerfile để dễ dàng deploy AI Worker | Backend | `chore(ai-worker): add 31 ai-worker feature` |

### 5.3 Frontend AI Features UI (Commit 32 - 44)
| STT | Chi Tiết Nhiệm Vụ (Task) | Phân Loại | Commit Message Suggestion |
| :--- | :--- | :--- | :--- |
| 5.3.1 | Xây dựng Layout khu vực Trải nghiệm AI trên Web Khách hàng | Frontend | `feat(ai-ui): add 32 ai-ui feature` |
| 5.3.2 | Xây dựng Component WebCam chụp ảnh trực tiếp | Frontend | `feat(ai-ui): add 33 ai-ui feature` |
| 5.3.3 | Xây dựng Component Drag & Drop Upload ảnh từ thiết bị | Frontend | `feat(ai-ui): add 34 ai-ui feature` |
| 5.3.4 | Thiết kế UI Màn hình Loading với Animation Quét sinh trắc học | Frontend | `feat(ai-ui): add 35 ai-ui feature` |
| 5.3.5 | Xây dựng Trang Dashboard Kết quả Phân tích Da | Frontend | `feat(ai-ui): add 36 ai-ui feature` |
| 5.3.6 | Tích hợp Biểu đồ Radar (Radar Chart) hiển thị Điểm số Da | Frontend | `feat(ai-ui): add 37 ai-ui feature` |
| 5.3.7 | Xây dựng Giao diện Highlight các vùng lỗi trên mặt (Mụn, Nếp nhăn) | Frontend | `feat(ai-ui): add 38 ai-ui feature` |
| 5.3.8 | Xây dựng Carousel Phòng Thử Kiểu Tóc (Virtual Hair Salon) | Frontend | `feat(ai-ui): add 39 ai-ui feature` |
| 5.3.9 | Tích hợp API Gửi ảnh và Nhận ảnh Kiểu tóc từ AI Worker | Frontend | `feat(ai-ui): add 40 ai-ui feature` |
| 5.3.10 | Xây dựng Tính năng So sánh Before/After (Thanh kéo ngang) | Frontend | `feat(ai-ui): add 41 ai-ui feature` |
| 5.3.11 | Xây dựng Nút Tải ảnh AI về máy thiết bị | Frontend | `feat(ai-ui): add 42 ai-ui feature` |
| 5.3.12 | Tích hợp Socket.io Client hiển thị Tiến trình xử lý AI Real-time | Frontend | `feat(ai-ui): add 43 ai-ui feature` |
| 5.3.13 | Tối ưu Styling: Thêm hiệu ứng Glow/Futuristic cho AI section | Frontend | `perf(ai-ui): add 44 ai-ui feature` |


---

---

## 📈 Đánh Giá Độ Khó & Phần Trăm Đóng Góp (Contribution)

Mặc dù số lượng commit của mỗi thành viên khác nhau do đặc thù của từng phân hệ, nhưng khi xét về **Độ phức tạp (Difficulty)** và **Khối lượng công việc (Workload)**, chúng ta có thể đánh giá tỷ lệ đóng góp của mỗi thành viên trong dự án một cách công bằng nhất như sau:

| Thành Viên | Phụ Trách Actor | Số lượng Commit | Mức độ Khó (Trọng số) | Điểm Đánh Giá | % Đóng Góp |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 👨‍💻 **Dev 1** | **Customer** | 74 | **Trung bình (x1.2)** <br/>*(Khối lượng UI nhiều, luồng nghiệp vụ cơ bản)* | 88.8 | **~22.8%** |
| 👨‍💻 **Dev 2** | **Receptionist** | 50 | **Khó (x1.5)** <br/>*(POS, Kéo thả hàng chờ, Thuật toán gán KTV)* | 75.0 | **~19.2%** |
| 👨‍💻 **Dev 3** | **Technician** | 43 | **Khá Khó (x1.4)** <br/>*(PWA Mobile, Upload đa phương tiện)* | 60.2 | **~15.4%** |
| 👨‍💻 **Dev 4** | **Manager** | 52 | **Khó (x1.5)** <br/>*(Báo cáo Chart phức tạp, Xếp lịch ca làm)* | 78.0 | **~20.0%** |
| 👨‍💻 **Dev 5** | **System & AI** | 44 | **Rất Khó (x2.0)** <br/>*(AI PyTorch/OpenCV, Core Architecture, CI/CD)* | 88.0 | **~22.6%** |
| **TỔNG KẾT** | **Toàn bộ hệ thống** | **263** | | **390.0** | **100%** |

### 💡 Lời bình (Evaluation Summary):
- **Dev 1 (Customer)**: Đóng góp cao nhất về số lượng tính năng (22.8%). Luồng khách hàng là mặt tiền của dự án, yêu cầu làm rất nhiều trang và UI nhưng thuật toán không quá phức tạp.
- **Dev 5 (System & AI)**: Đóng góp cực kỳ lớn (22.6%) mặc dù số commit ít hơn. Việc xây dựng kiến trúc cốt lõi (Core) và xử lý tích hợp mô hình AI (Python/FastAPI) đòi hỏi kỹ năng chuyên sâu và tốn rất nhiều thời gian research.
- **Dev 2 & 4 (Reception & Manager)**: Mức đóng góp cân bằng ở mức 19-20%. Hai role này xử lý các bài toán logic kinh doanh cốt lõi (POS, Doanh thu, Thuật toán).
- **Dev 3 (Technician)**: Khối lượng công việc ít hơn một chút (~15.4%) do tính năng app KTV tập trung vào một luồng đơn giản, rất phù hợp cho thành viên có năng lực trung bình khá hoặc làm Part-time trong nhóm.
