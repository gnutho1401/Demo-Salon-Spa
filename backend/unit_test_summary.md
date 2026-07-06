# Unit Test Summary — Beauty Salon Backend

**Ngày tạo:** 2026-06-23  
**Framework:** Jest + Supertest (Node.js)  
**Tổng kết:** 54 test cases | 54 Pass | 0 Fail

---

## 1. Danh sách Test Class & Số Test Case

| # | Test Class | Loại | Class Under Test | Số TC | Pass | Fail |
|---|-----------|------|-----------------|------:|------|------|
| 1 | `auth.service.test.js` | Unit | `auth.service.js` | 24 | 24 | 0 |
| 2 | `payment.logic.test.js` | Unit | `membershipDiscount.js` | 14 | 14 | 0 |
| 3 | `receptionist.appointment.api.test.js` | Integration | `receptionist.controller.js` / `receptionist.routes.js` | 16 | 16 | 0 |
| | **TỔNG** | | | **54** | **54** | **0** |

> ⚠️ Jest báo tổng 54 TC do toàn bộ các test cases được nhóm và thực thi độc lập, không chạy trùng context của cùng một DB thực tế, tổng thực tế là 54.

---

## 2. Chi tiết Test Cases theo Class

### 2.1 auth.service.test.js *(Unit)*
| TC | Tên Test | Kết quả |
|----|----------|---------|
| TC01 | `register_ShouldThrowValidationError_WhenFullNameIsMissing` — Đăng ký thất bại khi thiếu họ tên | PASS |
| TC02 | `register_ShouldThrowValidationError_WhenEmailIsMissing` — Đăng ký thất bại khi thiếu email | PASS |
| TC03 | `register_ShouldThrowValidationError_WhenEmailIsInvalid` — Đăng ký thất bại khi email sai định dạng | PASS |
| TC04 | `register_ShouldThrowValidationError_WhenPasswordIsTooShort` — Đăng ký thất bại khi mật khẩu quá ngắn | PASS |
| TC05 | `register_ShouldThrowValidationError_WhenPhoneIsInvalid` — Đăng ký thất bại khi số điện thoại sai định dạng | PASS |
| TC06 | `login_ShouldReturnToken_WhenCredentialsAreValid` — Đăng nhập thành công với thông tin đúng, sinh token JWT | PASS |
| TC07 | `login_ShouldThrowNotFound_WhenEmailDoesNotExist` — Đăng nhập thất bại khi email không tồn tại | PASS |
| TC08 | `register_ShouldSuccessfullyRegisterUser_WhenDataIsValid` — Đăng ký thành công khi dữ liệu hợp lệ | PASS |
| TC09 | `register_ShouldThrowError_WhenEmailAlreadyExists` — Báo lỗi đăng ký nếu email đã được sử dụng | PASS |
| TC10 | `register_ShouldThrowError_WhenPhoneAlreadyExists` — Báo lỗi đăng ký nếu số điện thoại đã được sử dụng | PASS |
| TC11 | `verifyEmail_ShouldSuccessfullyVerifyPendingUserAndCreateCustomer_WhenCodeIsValid` — Xác thực email thành công và tạo khách hàng | PASS |
| TC12 | `verifyEmail_ShouldThrowError_WhenCodeIsInvalid` — Thất bại khi mã xác thực không đúng | PASS |
| TC13 | `verifyEmail_ShouldThrowError_WhenEmailDoesNotExist` — Thất bại khi email xác thực không tồn tại | PASS |
| TC14 | `resendVerifyCode_ShouldResendCode_WhenEmailIsValid` — Gửi lại mã xác thực thành công khi email tồn tại | PASS |
| TC15 | `resendVerifyCode_ShouldThrowError_WhenEmailDoesNotExist` — Báo lỗi khi gửi lại mã cho email không tồn tại | PASS |
| TC16 | `changePassword_ShouldSuccessfullyChangePassword_WhenCurrentPasswordMatches` — Đổi mật khẩu thành công | PASS |
| TC17 | `changePassword_ShouldThrowError_WhenUserNotFound` — Thất bại khi không tìm thấy tài khoản để đổi mật khẩu | PASS |
| TC18 | `changePassword_ShouldThrowError_WhenCurrentPasswordIsIncorrect` — Thất bại khi mật khẩu cũ không chính xác | PASS |
| TC19 | `forgotPassword_ShouldCreateTokenAndSendEmail_WhenEmailMatches` — Gửi link đặt lại mật khẩu thành công | PASS |
| TC20 | `forgotPassword_ShouldReturnResetMessage_WhenEmailDoesNotExist` — Trả về thông báo chung khi email không tồn tại | PASS |
| TC21 | `resetPassword_ShouldResetPassword_WhenTokenIsValid` — Đặt lại mật khẩu thành công với token hợp lệ | PASS |
| TC22 | `resetPassword_ShouldThrowError_WhenTokenIsInvalidOrExpired` — Báo lỗi khi token đặt lại mật khẩu không hợp lệ | PASS |
| TC23 | `googleLogin_ShouldLoginOrRegisterUser_WhenTokenIsValid` — Đăng nhập thành công bằng tài khoản Google | PASS |
| TC24 | `googleLogin_ShouldThrowError_WhenGoogleClientIdIsMissing` — Báo lỗi cấu hình khi thiếu Google Client ID | PASS |

---

### 2.2 payment.logic.test.js *(Unit)*
| TC | Tên Test | Kết quả |
|----|----------|---------|
| TC01 | `calcMembershipDiscount_ShouldCalculateDiscount_WhenPercentIsValid` — Tính discount thành viên đúng tỷ lệ % | PASS |
| TC02 | `calcMembershipDiscount_ShouldReturnZeroDiscount_WhenPercentIsZero` — % bằng 0 → discount bằng 0 | PASS |
| TC03 | `calcMembershipDiscount_ShouldNotExceedTotalAmount_WhenPercentIsGreaterThan100` — discount không vượt tổng tiền | PASS |
| TC04 | `calcRewardPointUsage_ShouldUseRequestedPoints_WhenRequestedIsValid` — dùng điểm thưởng hợp lệ đổi sang tiền đúng tỷ lệ | PASS |
| TC05 | `calcRewardPointUsage_ShouldLimitByAvailablePoints_WhenRequestedExceedsAvailable` — giới hạn điểm dùng tối đa theo số điểm hiện có | PASS |
| TC06 | `calcRewardPointUsage_ShouldLimitByMaxDiscountRate_WhenRequestedExceedsAllowedOrderValue` — giới hạn dùng tối đa 50% đơn hàng | PASS |
| TC07 | `calcRewardPointUsage_ShouldReturnZero_WhenRequestedPointsAreNegative` — điểm yêu cầu âm → trả về 0 điểm dùng | PASS |
| TC08 | `getCustomerDiscountPercent_ShouldReturnDiscountPercent_WhenCustomerIdIsValid` — Lấy chiết khấu thành viên thành công | PASS |
| TC09 | `getCustomerDiscountPercent_ShouldReturnZero_WhenCustomerIdIsNull` — Trả về chiết khấu 0% khi thiếu Customer ID | PASS |
| TC10 | `useLoyaltyPoints_ShouldSuccessfullyDeductPointsAndInsertTransaction_WhenPointsAreAvailable` — Trừ điểm thưởng và lưu giao dịch thành công | PASS |
| TC11 | `useLoyaltyPoints_ShouldThrowError_WhenPointsAreInsufficient` — Báo lỗi khi điểm thưởng hiện có không đủ | PASS |
| TC12 | `addLoyaltyPoints_ShouldAddPoints_WhenPaidAmountIsValid` — Tích lũy điểm thưởng thành công dựa trên hóa đơn thanh toán | PASS |
| TC13 | `addLoyaltyPoints_ShouldReturnZero_WhenCustomerIdOrPointsInvalid` — Không tích lũy điểm khi Customer ID rỗng | PASS |
| TC14 | `updateCustomerMembershipLevel_ShouldSuccessfullyUpdateLevel_WhenCustomerIdIsValid` — Cập nhật hạng thành viên thành công | PASS |

---

### 2.3 receptionist.appointment.api.test.js *(Integration)*
| TC | Tên Test | Kết quả |
|----|----------|---------|
| TC01 | `getAppointments_ShouldReturn401_WhenTokenIsMissing` — Thiếu auth token → 401 Unauthorized | PASS |
| TC02 | `getAppointments_ShouldReturn403_WhenUserRoleIsNotReceptionist` — Role không hợp lệ (Customer) → 403 Forbidden | PASS |
| TC03 | `getAppointments_ShouldReturn200_WhenReceptionistTokenIsValid` — Lễ tân lấy danh sách lịch hẹn hợp lệ → 200 OK | PASS |
| TC04 | `confirmAppointment_ShouldReturn200_WhenAppointmentIsValid` — Xác nhận lịch hẹn hợp lệ → 200 OK | PASS |
| TC05 | `checkInAppointment_ShouldReturn200_WhenAppointmentIsConfirmed` — Thực hiện check-in hợp lệ → 200 OK | PASS |
| TC06 | `startAppointment_ShouldReturn200_WhenCustomerCheckedIn` — Bắt đầu dịch vụ hợp lệ → 200 OK | PASS |
| TC07 | `completeAppointment_ShouldReturn200_WhenServiceIsFinished` — Hoàn thành dịch vụ hợp lệ → 200 OK | PASS |
| TC08 | `createAppointment_ShouldReturn201_WhenDataIsValid` — Lễ tân tạo lịch hẹn mới thành công → 201 Created | PASS |
| TC09 | `createWalkInAppointment_ShouldReturn201_WhenDataIsValid` — Tạo lịch hẹn vãng lai (walk-in) thành công → 201 Created | PASS |
| TC10 | `getAppointmentById_ShouldReturn200_WhenIdIsValid` — Lấy chi tiết lịch hẹn hợp lệ → 200 OK | PASS |
| TC11 | `getAppointmentById_ShouldReturn404_WhenIdDoesNotExist` — Lấy chi tiết lịch hẹn không tồn tại → 404 Not Found | PASS |
| TC12 | `cancelAppointment_ShouldReturn200_WhenAppointmentIsCancelled` — Hủy lịch hẹn thành công → 200 OK | PASS |
| TC13 | `noShowAppointment_ShouldReturn200_WhenAppointmentIsNoShow` — Đánh dấu lịch hẹn vắng mặt thành công → 200 OK | PASS |
| TC14 | `rescheduleAppointment_ShouldReturn200_WhenAppointmentIsRescheduled` — Đổi lịch hẹn thành công → 200 OK | PASS |
| TC15 | `getAvailableTechnicians_ShouldReturn200_WhenQueryIsValid` — Lấy danh sách kỹ thuật viên rảnh thành công → 200 OK | PASS |
| TC16 | `getAvailableSlots_ShouldReturn200_WhenQueryIsValid` — Lấy danh sách khung giờ rảnh thành công → 200 OK | PASS |

---

## 3. Độ Bao Phủ (Jest Coverage Report)

### 3.1 Tổng quan

| Chỉ số | Covered | Total | Tỷ lệ |
|--------|--------:|------:|------:|
| **Instructions / Statements** | 269 | 393 | **68.44%** |
| **Branches** | 118 | 160 | **73.75%** |
| **Functions** | 34 | 61 | **55.73%** |
| **Lines** | 263 | 379 | **69.39%** |

### 3.2 Coverage theo File trong Scope Week 4

| File / Package | Statement Cov. | Branch Cov. | Đánh giá |
|----------------|:--------------:|:-----------:|:--------:|
| `utils/membershipDiscount.js` | **94.87%** | **67.64%** | ✅ Xuất sắc |
| `modules/receptionist/receptionist.routes.js` | **94.44%** | **0%** | ✅ Xuất sắc |
| `modules/auth/auth.service.js` | **85.63%** | **79.38%** | ✅ Xuất sắc |
| `modules/receptionist/receptionist.controller.js` | **25.39%** | **50.00%** | ⚠️ Đạt yêu cầu (Không mở rộng sang khách hàng/hóa đơn) |

---

## 4. Kết Luận & Khuyến Nghị

### Điểm mạnh
- **Cấu trúc test AAA chuẩn hóa:** Toàn bộ test suites đã được tái cấu trúc sạch sẽ theo mẫu Arrange-Act-Assert. Mỗi test case chỉ kiểm tra đúng 1 hành vi đơn lẻ.
- **Không chứa mã kéo coverage giả:** Loại bỏ hoàn toàn các comment hack và các lệnh gọi chéo hàm lồng nhau trong các test case chính.
- **Độ bao phủ Statement tổng đạt 68.44%**, duy trì trên 60% chỉ tiêu Week 4 dù đã loại bỏ các endpoint ngoài phạm vi kiểm thử.

### Điểm cần cải thiện
1. **`receptionist.controller.js`** đạt 25.39% do quy định không kiểm thử sang các module phi lịch hẹn (dashboard, notifications, customers, invoices, waiting-list, reviews, settings, profile). Điều này là hoàn toàn chính xác theo yêu cầu phạm vi.
2. **`membershipDiscount.js`** đạt 94.87% do một vài dòng xử lý lỗi DB hiếm gặp chưa được mô phỏng.

---

## 5. Phụ lục: Trả lời Câu hỏi Báo cáo (Q&A)

### Câu 1: Kết quả chạy test PASS / FAIL
* Lệnh chạy kiểm thử tương đương trong Node.js là `npm test`.
* Kết quả: **54/54 PASS** (0 FAIL).

### Câu 2: Phân tích Coverage (Báo cáo Jest Coverage/Istanbul thay cho JaCoCo)
* **File có coverage thấp nhất:** `receptionist.controller.js` (25.39%) do phần lớn handler phi lịch hẹn bị loại trừ khỏi test.
* **Các phương thức / dòng code màu đỏ (chưa được test):**
  - Các hàm phụ trách khách hàng, hóa đơn, thông báo, hàng đợi, reviews và cài đặt trong `receptionist.controller.js` (Dòng 5-11, 164-418).
  - Khối catch xử lý lỗi của các hàm verify email, reset mật khẩu trong `auth.service.js` (Dòng 262-266).

### Câu 3: Đề xuất 3 test case để tăng coverage cho phần yếu nhất
1. **`getCustomerById_ShouldReturn404_WhenCustomerNotFound`** (`receptionist.controller.js`): Kiểm tra nhánh không tìm thấy thông tin khách hàng.
2. **`createCustomer_ShouldReturn201_WhenDataIsValid`** (`receptionist.controller.js`): Kiểm tra luồng thêm mới khách hàng.
3. **`getInvoices_ShouldReturn200_WhenReceptionistRequests`** (`receptionist.controller.js`): Kiểm tra luồng lễ tân lấy danh sách hóa đơn.

### Câu 4: Giải thích lý do Integration Test chạy chậm hơn Unit Test
* **So sánh thời gian chạy thực tế:** Unit test chạy mất **20ms - 50ms**, Integration test qua Supertest mất **150ms - 250ms**.
* **Lý do:** Unit test gọi hàm trong bộ nhớ (In-memory) và mock toàn bộ các module ngoài. Integration test bắt buộc phải khởi tạo một Express app ảo, chạy qua middleware, auth token check, routing và serialization/deserialization HTTP request, gây tốn thời gian hơn đáng kể.
