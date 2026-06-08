# Auth + Profile Features

Đã hoàn thiện các chức năng:

- Đăng ký tài khoản customer
- Xác thực địa chỉ email bằng mã 6 số
- Mã hóa password bằng bcryptjs trong database
- Đăng nhập thường bằng email/password
- Đăng nhập với Google
- Đăng xuất
- Đổi mật khẩu
- Quên mật khẩu / đặt lại mật khẩu qua email
- Đổi ảnh đại diện
- Xem profile
- Edit profile

## Database

Nếu tạo database mới:

1. Chạy `database/schema.sql`
2. Chạy `database/seed.sql`

Nếu database đã tồn tại:

1. Chạy `database/migration_auth_profile.sql`

Các cột mới được thêm vào bảng `Users`:

- `AvatarUrl`
- `IsVerified`
- `VerifyCode`
- `VerifyCodeExpires`
- `ResetPasswordToken`
- `ResetPasswordExpires`
- `GoogleId`
- `UpdatedAt`

## Backend .env

File `backend/.env` cần cấu hình:

```env
PORT=5000
JWT_SECRET=dev_secret_key

DB_USER=sa
DB_PASSWORD=sa
DB_SERVER=localhost
DB_DATABASE=BeautySalonSystem
DB_PORT=1433

EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
FRONTEND_URL=http://localhost:5173

GOOGLE_CLIENT_ID=your_google_client_id
```

Nếu chưa cấu hình email, backend vẫn chạy ở chế độ dev và sẽ in mã xác thực/link reset ra response + terminal.

## Frontend .env

Tạo file `frontend/.env` dựa trên `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Chạy project

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## API chính

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verify-code`
- `POST /api/auth/login`
- `POST /api/auth/google-login`
- `POST /api/auth/logout`
- `PUT /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/customers/me/profile`
- `PUT /api/customers/me/profile`
- `PUT /api/customers/me/avatar`
