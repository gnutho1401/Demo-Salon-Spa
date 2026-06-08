USE BeautySalonSystem;
GO

-- Chạy file này nếu database đã tồn tại rồi.
-- Nếu tạo database mới từ schema.sql thì không cần chạy migration này.

IF COL_LENGTH('Users', 'AvatarUrl') IS NULL
    ALTER TABLE Users ADD AvatarUrl NVARCHAR(255) NULL;
GO

IF COL_LENGTH('Users', 'IsVerified') IS NULL
    ALTER TABLE Users ADD IsVerified BIT DEFAULT 0;
GO

IF COL_LENGTH('Users', 'VerifyCode') IS NULL
    ALTER TABLE Users ADD VerifyCode NVARCHAR(10) NULL;
GO

IF COL_LENGTH('Users', 'VerifyCodeExpires') IS NULL
    ALTER TABLE Users ADD VerifyCodeExpires DATETIME NULL;
GO

IF COL_LENGTH('Users', 'ResetPasswordToken') IS NULL
    ALTER TABLE Users ADD ResetPasswordToken NVARCHAR(255) NULL;
GO

IF COL_LENGTH('Users', 'ResetPasswordExpires') IS NULL
    ALTER TABLE Users ADD ResetPasswordExpires DATETIME NULL;
GO

IF COL_LENGTH('Users', 'GoogleId') IS NULL
    ALTER TABLE Users ADD GoogleId NVARCHAR(100) NULL;
GO

IF COL_LENGTH('Users', 'UpdatedAt') IS NULL
    ALTER TABLE Users ADD UpdatedAt DATETIME NULL;
GO

IF COL_LENGTH('Services', 'ImageUrl') IS NULL
    ALTER TABLE Services ADD ImageUrl NVARCHAR(255) NULL;
GO

-- Cho các tài khoản seed cũ được đăng nhập ngay sau khi migration.
UPDATE Users
SET IsVerified = 1
WHERE Email IN (
  'admin@gmail.com',
  'customer1@gmail.com',
  'customer2@gmail.com',
  'reception@gmail.com',
  'hair@gmail.com',
  'nail@gmail.com',
  'manager@gmail.com'
);
GO
