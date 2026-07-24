# Kiểm thử backend

Tài liệu này thay thế các báo cáo “Week 4” và bảng kết quả test ghi cứng trước đây. Danh sách test thực tế luôn được lấy trực tiếp từ thư mục `backend/tests`.

## Chạy toàn bộ test

```powershell
cd E:\Demo-Salon-Spa\backend
npm test
```

Jest chạy tuần tự (`--runInBand`) để giảm xung đột tài nguyên và phát hiện handle chưa đóng.

## Chạy báo cáo coverage

```powershell
npm run test:coverage
```

Báo cáo HTML được tạo tại:

```text
backend/coverage/lcov-report/index.html
```

## Chạy một nhóm test

```powershell
npx jest tests/unit/auth.service.test.js --runInBand
npx jest tests/unit/aiHairTryOn.contract.test.js --runInBand
npx jest tests/integration/receptionist.appointment.api.test.js --runInBand
```

## Xem danh sách test hiện tại

```powershell
rg --files tests -g "*.test.js"
```

Không cập nhật thủ công tổng số test trong tài liệu. Kết quả PASS/FAIL và coverage phải lấy từ lần chạy Jest gần nhất để tránh sai lệch khi mã nguồn thay đổi.
