# Cấu trúc CSS đã tách lại

```text
src/styles/
├── main.css                 # File import tổng, App.jsx chỉ import file này
├── global/
│   ├── variables.css        # Màu, font, shadow, biến dùng chung
│   ├── reset.css            # Reset mặc định browser
│   ├── base.css             # Body, container, section, tiêu đề
│   ├── utilities.css        # Class dùng chung: grid, muted, price...
│   └── responsive.css       # Responsive mobile/tablet
├── layouts/
│   ├── header.css           # Topbar, navbar, logo, menu
│   ├── footer.css           # Footer
│   └── customer-layout.css  # Sidebar + layout customer
├── components/
│   ├── buttons.css          # Button, outline button, card button
│   ├── cards.css            # Service card, technician card, dashboard card
│   ├── forms.css            # Field, input, select, form-grid
│   └── tables.css           # Table, status badge
└── pages/
    ├── home.css             # Hero, search box, banner, why, newsletter
    ├── auth.css             # Login/Register
    ├── customer.css         # Dashboard customer
    ├── services.css         # Service detail/list style riêng
    └── simple-dashboard.css # Admin/Receptionist/Technician demo page
```

Muốn sửa giao diện trang nào thì mở đúng file của trang đó. Ví dụ sửa trang chủ thì vào `src/styles/pages/home.css`, sửa navbar thì vào `src/styles/layouts/header.css`.
