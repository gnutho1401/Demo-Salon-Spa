# Beauty Salon Management System

Dự án quản lý Spa / Nails / Hair Salon dùng React + Node.js Express + SQL Server.

## Chạy backend
```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

## Chạy frontend
```bash
cd frontend
npm install
npm run dev
```

## Database
Mở SQL Server Management Studio, chạy:
1. database/schema.sql
2. database/seed.sql

## Cấu trúc chính
- backend/src/modules/auth: đăng ký, đăng nhập
- backend/src/modules/services: quản lý dịch vụ
- backend/src/modules/appointments: đặt lịch
- backend/src/modules/payments: thanh toán
- backend/src/modules/reports: báo cáo
- frontend/src/pages: giao diện theo actor
