/* ==========================================================
   MIGRATION: Full stack Combo / Lieu trinh
   Run this after schema.sql / current database.
========================================================== */

IF COL_LENGTH('Packages', 'CategoryName') IS NULL
BEGIN
    ALTER TABLE Packages ADD CategoryName NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('Packages', 'DiscountPercent') IS NULL
BEGIN
    ALTER TABLE Packages ADD DiscountPercent INT NOT NULL CONSTRAINT DF_Packages_DiscountPercent DEFAULT 0;
END
GO

IF COL_LENGTH('Packages', 'TotalSessions') IS NULL
BEGIN
    ALTER TABLE Packages ADD TotalSessions INT NULL;
END
GO

IF OBJECT_ID('PackagePayments', 'U') IS NULL
BEGIN
    CREATE TABLE PackagePayments (
        PackagePaymentId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerPackageId INT NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        PaymentMethod NVARCHAR(30) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        TransactionCode NVARCHAR(100) NULL,
        PaidAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE
    );
END
GO

UPDATE Packages
SET CategoryName = COALESCE(CategoryName, N'Chăm sóc da mặt'),
    DiscountPercent = CASE WHEN ISNULL(DiscountPercent, 0) = 0 THEN 15 ELSE DiscountPercent END,
    TotalSessions = COALESCE(TotalSessions, 5)
WHERE PackageName LIKE N'%Thư Giãn%' OR PackageName LIKE N'%Thư giãn%';
GO

UPDATE Packages
SET CategoryName = COALESCE(CategoryName, N'Làm đẹp tổng hợp'),
    DiscountPercent = CASE WHEN ISNULL(DiscountPercent, 0) = 0 THEN 10 ELSE DiscountPercent END,
    TotalSessions = COALESCE(TotalSessions, 4)
WHERE PackageName LIKE N'%Làm Đẹp%' OR PackageName LIKE N'%Làm đẹp%';
GO

IF NOT EXISTS (SELECT 1 FROM Packages WHERE PackageName = N'Liệu trình căng bóng phục hồi chuyên sâu')
BEGIN
    INSERT INTO Packages (PackageName, Description, Price, ValidityDays, ImageUrl, Status, CategoryName, DiscountPercent, TotalSessions)
    VALUES
    (N'Liệu trình căng bóng phục hồi chuyên sâu', N'Cấp ẩm sâu, phục hồi da hư tổn, giúp da căng bóng và mịn màng hơn.', 5000000, 90, '/images/services/skincare.png', 'ACTIVE', N'Chăm sóc da mặt', 20, 5),
    (N'Liệu trình trị mụn chuẩn y khoa', N'Kết hợp làm sạch, điều trị mụn và phục hồi để hạn chế tái phát.', 7000000, 120, '/images/services/skincare.png', 'ACTIVE', N'Trị mụn', 15, 8),
    (N'Combo giảm béo slim body', N'Liệu trình massage, detox và chăm sóc body giúp cơ thể săn chắc hơn.', 8000000, 120, '/images/services/massage.png', 'ACTIVE', N'Giảm béo - Detox', 10, 10),
    (N'Liệu trình trẻ hóa nâng cơ toàn diện', N'Nâng cơ, cải thiện độ đàn hồi và hỗ trợ làm mờ dấu hiệu lão hóa.', 12000000, 180, '/images/services/skincare.png', 'ACTIVE', N'Trẻ hóa - Chống lão hóa', 25, 6);
END
GO

/* Gắn dịch vụ vào các combo mới nếu database đã có service tương ứng */
INSERT INTO PackageServices (PackageId, ServiceId)
SELECT p.PackageId, s.ServiceId
FROM Packages p
CROSS APPLY (
    SELECT TOP 2 ServiceId FROM Services WHERE Status = 'ACTIVE' ORDER BY ServiceId
) s
WHERE p.PackageName IN (N'Liệu trình căng bóng phục hồi chuyên sâu', N'Liệu trình trị mụn chuẩn y khoa', N'Combo giảm béo slim body', N'Liệu trình trẻ hóa nâng cơ toàn diện')
  AND NOT EXISTS (SELECT 1 FROM PackageServices ps WHERE ps.PackageId = p.PackageId AND ps.ServiceId = s.ServiceId);
GO
