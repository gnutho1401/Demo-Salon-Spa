# Hướng dẫn chạy dự án Demo Salon Spa

Tài liệu này hướng dẫn chạy hệ thống trên Windows theo hai chế độ:

- **Development:** frontend và backend chạy riêng để phát triển.
- **Production local/self-host:** frontend được build và phục vụ chung từ backend trên một hostname.

## Cách nhanh nhất — một file, một lệnh

Tại thư mục gốc dự án, chạy:

```powershell
.\salon.cmd
```

Lệnh này tự động build frontend, khởi động frontend ở `5173`, backend ở `5000`, kết nối database, kiểm tra AI Worker và mở website `http://localhost:5173`. Có thể chạy lại an toàn; launcher sẽ tái sử dụng dịch vụ đang khỏe thay vì tạo tiến trình trùng cổng.

Các lệnh quản lý đều dùng cùng một file:

```powershell
.\salon.cmd status
.\salon.cmd restart
.\salon.cmd stop
.\salon.cmd public
```

Chỉ dùng các phần hướng dẫn chi tiết bên dưới khi cần cài đặt lần đầu hoặc chẩn đoán lỗi.

## 1. Thành phần hệ thống

| Thành phần | Công nghệ | Cổng mặc định |
|---|---|---:|
| Frontend | React + Vite | 5173 |
| Backend | Node.js + Express | 5000 |
| Database | Microsoft SQL Server | 1433 |
| AI thử tóc local | Python + FastAPI | 8189 |

## 2. Yêu cầu trước khi chạy

Cài đặt:

1. Node.js phiên bản phù hợp với Vite 8, khuyến nghị Node.js 22 LTS.
2. Microsoft SQL Server và SQL Server Management Studio.
3. Python 3.10–3.12 nếu sử dụng AI thử tóc local.
4. Git và PowerShell.

Kiểm tra:

```powershell
node --version
npm --version
python --version
git --version
```

## 3. Chuẩn bị database

Database mặc định của dự án là:

```text
BeautySalonSystem1
```

Đảm bảo SQL Server đang chạy và tài khoản SQL có quyền truy cập database.

Nếu database chưa tồn tại, tạo database và chạy schema/migration phù hợp trong thư mục:

```text
database/
database/migrations/
```

Chạy một migration:

```powershell
cd E:\Demo-Salon-Spa\backend
node migrate_db.js ..\database\migrations\<ten-migration>.sql
```

Migration runner sẽ:

- Khóa không cho hai migration chạy cùng lúc.
- Lưu checksum vào bảng `SchemaMigrationHistory`.
- Không chạy lại migration đã áp dụng.
- Báo lỗi nếu nội dung migration cũ bị thay đổi.

Kiểm tra lịch sử:

```sql
SELECT *
FROM SchemaMigrationHistory
ORDER BY AppliedAt DESC;
```

## 4. Cấu hình backend

Sao chép file mẫu:

```powershell
cd E:\Demo-Salon-Spa
Copy-Item backend\.env.example backend\.env
```

Mở `backend/.env` và cập nhật tối thiểu:

```dotenv
PORT=5000
NODE_ENV=development

JWT_SECRET=
JWT_SECRET_FILE=../.runtime/jwt-secret

DB_USER=sa
DB_PASSWORD=mat-khau-sql-server
DB_SERVER=localhost
DB_DATABASE=BeautySalonSystem1
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_CERT=true

FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

ALLOW_LEGACY_PLAINTEXT_PASSWORDS=false
EXPOSE_DEV_AUTH_TOKENS=false
```

Tạo JWT secret ngẫu nhiên:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Không commit `backend/.env` lên Git.

## 5. Cấu hình frontend

Tạo hoặc kiểm tra `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_AUTHORIZED_ORIGINS=http://localhost:5173
VITE_ANALYTICS_REFRESH_MS=30000
```

Nếu không dùng Google Login, có thể để trống `VITE_GOOGLE_CLIENT_ID`.

Sau khi đổi file `.env`, phải khởi động lại Vite.

### Google Login

Trong Google Cloud Console, mở **Google Auth Platform → Clients**, chọn đúng
OAuth 2.0 Web Client tương ứng với `VITE_GOOGLE_CLIENT_ID`, rồi thêm chính xác:

```text
Authorized JavaScript origins
http://localhost:5173
```

Client ID ở `frontend/.env` và `backend/.env` phải giống nhau. Origin ở
`VITE_GOOGLE_AUTHORIZED_ORIGINS`, `GOOGLE_AUTHORIZED_ORIGINS` và Google Cloud
phải trùng tuyệt đối cả giao thức, hostname và port. Không dùng
`http://127.0.0.1:5173` để đăng nhập Google. Nếu trình duyệt chặn popup, cho phép
popup đối với `http://localhost:5173`.

Khi dùng hostname công khai, thêm origin HTTPS thực tế vào Google Cloud và hai
biến allowlist trên, sau đó chạy lại:

```powershell
.\salon.cmd restart
```

## 6. Cài dependency

Backend:

```powershell
cd E:\Demo-Salon-Spa\backend
npm install
```

Frontend:

```powershell
cd E:\Demo-Salon-Spa\frontend
npm install
```

## 7. Chạy development

Mở hai cửa sổ PowerShell.

### Cửa sổ 1 — Backend

```powershell
cd E:\Demo-Salon-Spa\backend
npm run dev
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Cửa sổ 2 — Frontend

```powershell
cd E:\Demo-Salon-Spa\frontend
npm run dev
```

Mở:

```text
http://localhost:5173
```

## 8. Chạy AI thử tóc local

Chỉ cần bước này nếu muốn sinh ảnh thử tóc bằng máy local.

### Tạo môi trường Python

```powershell
cd E:\Demo-Salon-Spa\ai-worker\hair-tryon
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Nếu PowerShell chặn activate:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
```

### Khởi động AI Worker

```powershell
cd E:\Demo-Salon-Spa\ai-worker\hair-tryon
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-ai.ps1
```

Có thể chạy lại lệnh này an toàn. Nếu AI Worker đã sẵn sàng trên cổng 8189, script sẽ dùng lại tiến trình hiện có.

Kiểm tra:

```text
http://127.0.0.1:8189/health
```

Cấu hình trong `backend/.env`:

```dotenv
LOCAL_HAIR_API_URL=http://127.0.0.1:8189
AI_HAIR_PROVIDER_ORDER=local
AI_HAIR_LOCAL_ENABLED=true
AI_VISION_LOCAL_ENABLED=true
AI_JOB_WORKER_ENABLED=true
```

Lần sinh ảnh đầu tiên có thể chậm vì model được tải vào bộ nhớ.

## 9. Chạy production trên máy local

Production sử dụng một địa chỉ duy nhất:

```text
Browser -> Express :5000 -> frontend dist + API
```

Không cần chạy `npm run dev` cho frontend.

Đảm bảo `backend/.env` có:

```dotenv
NODE_ENV=production
JWT_SECRET=
JWT_SECRET_FILE=../.runtime/jwt-secret
TRUST_PROXY=true
ALLOW_LEGACY_PLAINTEXT_PASSWORDS=false
EXPOSE_DEV_AUTH_TOKENS=false
```

Chạy production local kèm AI:

```powershell
cd E:\Demo-Salon-Spa
.\salon.cmd
```

Mở:

```text
http://localhost:5173
```

Dừng:

```powershell
.\salon.cmd stop
```

Log nằm trong:

```text
.runtime/
```

## 10. Public website miễn phí bằng Tailscale Funnel

Phù hợp cho demo hoặc sử dụng cá nhân.

1. Cài Tailscale trên Windows.
2. Đăng nhập Tailscale.
3. Bật MagicDNS, HTTPS Certificates và Funnel.
4. Chạy:

```powershell
cd E:\Demo-Salon-Spa
.\salon.cmd public
```

Script sẽ in URL HTTPS dạng:

```text
https://ten-may.ten-tailnet.ts.net
```

Dừng server và Funnel:

```powershell
.\salon.cmd stop
```

Thông tin chi tiết về DuckDNS, Caddy, Cloudflare và Tailscale nằm tại:

```text
docs/SELF_HOST_ZERO_COST.md
```

## 11. Kiểm tra hệ thống

### Backend test

```powershell
cd E:\Demo-Salon-Spa\backend
npm test
```

Không ghi cứng số lượng test vì test suite thay đổi theo mã nguồn. Hướng dẫn kiểm thử chi tiết:

```text
backend/TESTING.md
```

### Frontend build

```powershell
cd E:\Demo-Salon-Spa\frontend
npm run build
```

### Kiểm tra dependency

```powershell
cd E:\Demo-Salon-Spa\backend
npm audit

cd E:\Demo-Salon-Spa\frontend
npm audit
```

### Kiểm tra API

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
```

Kết quả đúng:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## 12. Lỗi thường gặp

### Không đăng nhập được

Kiểm tra:

1. Backend có đang chạy không.
2. `VITE_API_URL` có đúng `http://localhost:5000` không.
3. Tài khoản có `Status = 'ACTIVE'` và `IsVerified = 1` không.
4. Mật khẩu trong database có bắt đầu bằng `$2` không.
5. Xóa token cũ trong trình duyệt rồi đăng nhập lại.

```javascript
localStorage.removeItem("token");
localStorage.removeItem("user");
location.reload();
```

### Backend không kết nối SQL Server

Kiểm tra:

- SQL Server service đang chạy.
- SQL Authentication đã bật.
- `DB_USER`, `DB_PASSWORD`, `DB_DATABASE` đúng.
- TCP/IP và cổng 1433 đã cấu hình nếu SQL Server không dùng cổng mặc định.
- `DB_TRUST_CERT=true` khi dùng certificate local.

### Lỗi CORS

Thêm đúng origin, không có dấu `/` cuối:

```dotenv
CORS_ORIGINS=http://localhost:5173
```

Với nhiều origin:

```dotenv
CORS_ORIGINS=http://localhost:5173,https://ten-may.ten-tailnet.ts.net
```

Khởi động lại backend sau khi đổi.

### AI Worker không chạy

Kiểm tra:

```powershell
cd E:\Demo-Salon-Spa\ai-worker\hair-tryon
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local-ai.ps1
```

Script sẽ tái sử dụng AI Worker nếu `http://127.0.0.1:8189/health` đã trả về `status=ready`; không chạy thêm lệnh Uvicorn thủ công.

Nếu xuất hiện `WinError 10048`, một tiến trình khác đã giữ cổng. Kiểm tra `/health` trước: nếu trạng thái là `ready` thì dịch vụ đã chạy và không cần khởi động lại. Nếu endpoint không khỏe, dùng phần kiểm tra cổng bên dưới để xác định đúng PID, không dừng cưỡng bức một tiến trình chưa xác định.

Nếu thiếu RAM/GPU, giảm cấu hình model hoặc chạy chế độ không bật AI Worker.

### Cổng đang bị chiếm

Kiểm tra:

```powershell
Get-NetTCPConnection -LocalPort 5000,5173,8189 -ErrorAction SilentlyContinue
```

Xem process:

```powershell
Get-Process -Id <PID>
```

### Frontend vẫn gọi URL cũ

1. Kiểm tra `frontend/.env`.
2. Dừng Vite.
3. Xóa `frontend/dist` nếu cần.
4. Chạy lại `npm run dev` hoặc `npm run build`.

## 13. Lưu ý bảo mật khi public

- Không mở SQL Server 1433 ra Internet.
- Không mở AI Worker 8189 ra Internet.
- Chỉ expose backend 5000 qua Funnel hoặc reverse proxy HTTPS.
- Không commit `.env`, ảnh khách hàng, log, model AI hoặc database backup.
- Sao lưu database và `backend/private` hằng ngày.
- Không chạy Node/Python bằng tài khoản Administrator.
- Bật Windows Update, Defender và mật khẩu Windows mạnh.
- Máy tắt hoặc mất mạng thì website cũng ngừng hoạt động.
