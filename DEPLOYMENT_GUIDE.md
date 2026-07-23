# Hướng dẫn Triển khai Cloud-Native (Production-Ready)

Tài liệu này hướng dẫn bạn cách triển khai hệ thống Demo-Salon-Spa theo Phương án 2 (Phân tán trên các dịch vụ Cloud). Hệ thống bao gồm 4 phần:
1. **Database**: Azure SQL / Amazon RDS
2. **Backend**: Render / Railway (Node.js)
3. **Frontend**: Vercel (React)
4. **AI Worker**: RunPod / EC2 (Python FastAPI)

---

## Bước 1: Triển khai Database (SQL Server)

Vì hệ thống sử dụng Microsoft SQL Server (`mssql`), bạn nên dùng dịch vụ quản lý cơ sở dữ liệu chuyên dụng.
* **Gợi ý**: Azure SQL Database (Microsoft cung cấp gói Basic rất rẻ hoặc miễn phí cho học tập/test), hoặc Amazon RDS.
* **Thực hiện**:
  1. Tạo database trên Azure/AWS và cho phép kết nối từ mọi IP (hoặc IP của Backend).
  2. Lấy Connection String (Chuỗi kết nối).
  3. Dùng công cụ như **SQL Server Management Studio (SSMS)** hoặc **DBeaver** kết nối vào database mới tạo, sau đó chạy nội dung file `database/schema.sql` (và các file SQL khác nếu cần) để khởi tạo các bảng dữ liệu.

---

## Bước 2: Triển khai Backend (Render hoặc Railway)

Cả Render và Railway đều hỗ trợ nhận diện Dockerfile hoặc tự động build Node.js. Ở đây ta sử dụng Render làm ví dụ.

* **Thực hiện**:
  1. Đẩy (push) toàn bộ code của bạn lên một kho lưu trữ **GitHub**.
  2. Đăng nhập vào [Render.com](https://render.com).
  3. Bấm **New > Web Service**.
  4. Chọn repository GitHub chứa code của bạn.
  5. Cài đặt các thông tin sau:
     * **Root Directory**: `backend` (Cực kỳ quan trọng, để báo cho Render biết thư mục gốc của backend).
     * **Environment**: `Docker` (hoặc `Node`).
     * **Build Command**: `npm install` (nếu dùng Node env).
     * **Start Command**: `npm start` (nếu dùng Node env).
  6. **Environment Variables (Biến môi trường)**:
     * Mở file `backend/.env.example` và copy các biến sang Render.
     * Cập nhật thông tin Database (IP, User, Pass) vào các biến DB_*.
     * `FRONTEND_URL` tạm thời để trống hoặc điền tạm, lát nữa tạo Frontend xong sẽ quay lại cập nhật.
  7. Bấm **Create Web Service**. Chờ quá trình build hoàn tất, bạn sẽ có URL của Backend (ví dụ: `https://beauty-backend.onrender.com`).

---

## Bước 3: Triển khai Frontend (Vercel)

Vercel là nền tảng tốt nhất cho các dự án React/Vite.

* **Thực hiện**:
  1. Đăng nhập [Vercel.com](https://vercel.com) (bằng tài khoản GitHub).
  2. Bấm **Add New > Project**.
  3. Chọn repository chứa code.
  4. Ở phần cấu hình (Configure Project):
     * **Root Directory**: `frontend`.
     * **Framework Preset**: Chọn `Vite`.
     * Mở mục **Environment Variables** và thêm:
       * `VITE_API_URL`: URL của Backend vừa lấy ở Bước 2 (ví dụ: `https://beauty-backend.onrender.com`).
       * `VITE_GOOGLE_CLIENT_ID`: ID Google Client của bạn.
  5. Bấm **Deploy**. Vercel sẽ tự động build và cung cấp cho bạn một domain (ví dụ: `https://beauty-salon.vercel.app`).
  6. **Quan trọng**: Quay lại Render (Backend), thêm/sửa biến môi trường `FRONTEND_URL` thành domain của Vercel để Backend chấp nhận (CORS).

---

## Bước 4: Triển khai AI Worker (RunPod hoặc VPS có GPU)

AI Worker yêu cầu cấu hình khá cao. File `Dockerfile` đã được cấu hình sẵn cho bạn.

* **Triển khai bằng RunPod (Gợi ý cho AI)**:
  1. Đăng ký tài khoản trên [RunPod.io](https://runpod.io).
  2. Nạp một ít tiền (vài đô la) để sử dụng GPU.
  3. Tạo Pod mới, chọn cấu hình GPU phù hợp (ví dụ RTX 3090 hoặc 4090).
  4. Bạn có thể sử dụng template sẵn có của RunPod (như PyTorch) hoặc tự build Docker image từ thư mục `ai-worker/hair-tryon` lên Docker Hub rồi kéo về RunPod.
  5. Thiết lập port 8000 được Expose ra ngoài qua TCP/HTTP.
  6. Gắn các biến môi trường nếu có.
  7. Lấy URL của AI Worker và cấu hình vào Backend (biến `LOCAL_HAIR_API_URL` trên Render).

---

## 🎯 Hoàn tất

Sau khi hoàn thành 4 bước trên, bạn đã có một hệ thống hoàn chỉnh chạy trên Cloud:
* Khách hàng truy cập vào URL Vercel.
* Vercel gọi API đến Render.
* Render kết nối đến Azure SQL Database và RunPod (nếu dùng tính năng AI).

Chúc bạn deploy thành công! Nếu có lỗi gì phát sinh (như lỗi CORS, không kết nối được DB), hãy check Logs trên các nền tảng (Render Logs, Vercel Logs) để debug chi tiết.
