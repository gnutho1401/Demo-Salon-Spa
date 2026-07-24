# Self-host Salon Spa trên Windows với chi phí 0 đồng

## Kiến trúc đã chuẩn hóa

Frontend được build thành file tĩnh và do chính backend Express phục vụ. Toàn bộ website,
API, ảnh và AI Stylist dùng **một hostname HTTPS duy nhất**:

```text
Internet -> HTTPS tunnel/reverse proxy -> Express :5000
                                      -> SQL Server localhost
                                      -> Local AI :8189
```

Cách này bỏ hai Quick Tunnel ngẫu nhiên trước đây, tránh lỗi CORS và không phải ghi lại
`VITE_API_URL` mỗi lần khởi động.

## Phương án A — Tailscale Funnel (khuyên dùng cho demo/cá nhân)

- Chi phí: 0 đồng với Tailscale Personal.
- URL cố định: `https://ten-may.ten-tailnet.ts.net`.
- Không cần IP public, port forwarding hoặc cấu hình router.
- HTTPS tự động; IP nhà được ẩn sau Funnel relay.
- Giới hạn: Personal không dành cho hoạt động thương mại; Funnel có giới hạn băng thông.

Các bước:

1. Cài Tailscale trên Windows và đăng nhập bằng tài khoản cá nhân.
2. Bật MagicDNS, HTTPS Certificates và Funnel trong Tailscale Admin.
3. Tạo `backend/.env`, đặt JWT secret mạnh và thông tin SQL Server.
4. Chạy launcher duy nhất:

```powershell
cd E:\Demo-Salon-Spa
.\salon.cmd public
```

Kiểm tra:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/health
tailscale funnel status
```

Dừng:

```powershell
.\salon.cmd stop
```

## Phương án B — DuckDNS + Caddy (0 đồng, phù hợp public lâu dài)

- DuckDNS cấp miễn phí hostname cố định `ten-salon.duckdns.org`.
- Caddy tự xin và gia hạn chứng chỉ HTTPS.
- Có thể dùng cho mục đích thương mại theo chính sách dịch vụ hiện hành.
- Bắt buộc nhà mạng cấp IPv4 public hoặc IPv6 truy cập được.
- Phải forward TCP 80/443 từ router về máy Windows.
- Không dùng được trực tiếp nếu đường truyền nằm sau CGNAT.

Các bước chính:

1. Tạo subdomain và token tại DuckDNS.
2. Cấu hình tác vụ Windows cập nhật IP bằng HTTPS DuckDNS API mỗi 5 phút.
3. Forward port 80 và 443 trên router về máy server.
4. Cài Caddy và sao chép `deploy/Caddyfile.duckdns.example` thành `Caddyfile`.
5. Thay hostname/email rồi chạy Caddy như Windows service.
6. Đặt trong `backend/.env`:

```dotenv
NODE_ENV=production
TRUST_PROXY=true
CORS_ORIGINS=https://ten-salon.duckdns.org
FRONTEND_URL=https://ten-salon.duckdns.org
BACKEND_URL=https://ten-salon.duckdns.org
```

Không mở port SQL Server 1433 hoặc AI Worker 8189 ra Internet.

## Phương án Cloudflare

Quick Tunnel `trycloudflare.com` chỉ dành cho thử nghiệm, hostname thay đổi và không có SLA.
Named Cloudflare Tunnel an toàn và miễn phí nhưng hostname cố định yêu cầu một domain do bạn
sở hữu; vì vậy không thể đảm bảo tổng chi phí 0 đồng nếu chưa có domain.

## Điều kiện vận hành máy cá nhân như server

- Tắt Sleep/Hibernate khi cắm điện; bật tự khởi động sau mất điện trong BIOS nếu có.
- Dùng tài khoản Windows riêng cho service và không chạy Node/AI bằng Administrator.
- Chỉ expose port 5000 qua tunnel; SQL Server và AI chỉ bind localhost/LAN cần thiết.
- Sao lưu database và `backend/private` sang ổ khác hằng ngày.
- Không commit `.env`, ảnh khách hàng, model hoặc log lên Git.
- Đặt mật khẩu SQL Server mạnh, bật Windows Update và Microsoft Defender.
- Máy tắt, mất mạng hoặc nhà mất điện thì website cũng ngừng hoạt động.
