/* =========================================================
   BEAUTY SALON MANAGEMENT SYSTEM - COMPLETE DATABASE
   SQL Server version
   Includes:
   - Auth / email verify / forgot password
   - Customer / Guest
   - Services / Technicians / Appointment
   - Combo / Lieu trinh / Package payment
   - VNPay transaction fields
   - Review by experienced service
   ========================================================= */

--IF DB_ID('BeautySalonSystem') IS NOT NULL
--BEGIN
  --  ALTER DATABASE BeautySalonSystem SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
   -- DROP DATABASE BeautySalonSystem;
--END
--GO

CREATE DATABASE BeautySalonSystem1;
GO

USE BeautySalonSystem1;
GO

/* =========================
   1. ROLES
========================= */
CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);
GO

/* =========================
   2. USERS
========================= */
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Phone NVARCHAR(20) NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    RoleId INT NOT NULL,
    AvatarUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    IsVerified BIT NOT NULL DEFAULT 0,
    VerifyCode NVARCHAR(10) NULL,
    VerifyCodeExpires DATETIME NULL,
    ResetPasswordToken NVARCHAR(255) NULL,
    ResetPasswordExpires DATETIME NULL,
    GoogleId NVARCHAR(255) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
);
GO

CREATE UNIQUE INDEX IX_Users_Phone_NotNull ON Users(Phone) WHERE Phone IS NOT NULL;
GO

/* =========================
   3. PENDING USERS
========================= */
CREATE TABLE PendingUsers (
    PendingUserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Phone NVARCHAR(20) NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Gender NVARCHAR(10) NULL,
    DateOfBirth DATE NULL,
    Address NVARCHAR(255) NULL,
    VerifyCode NVARCHAR(10) NOT NULL,
    VerifyCodeExpires DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

/* =========================
   4. MEMBERSHIP
========================= */
CREATE TABLE MembershipLevels (
    MembershipLevelId INT IDENTITY(1,1) PRIMARY KEY,
    LevelName NVARCHAR(50) NOT NULL UNIQUE,
    MinPoints INT NOT NULL DEFAULT 0,
    DiscountPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
    Description NVARCHAR(255) NULL
);
GO

CREATE TABLE Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Gender NVARCHAR(10) NULL,
    DateOfBirth DATE NULL,
    Address NVARCHAR(255) NULL,
    LoyaltyPoints INT NOT NULL DEFAULT 0,
    MembershipLevelId INT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Customers_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_Customers_MembershipLevels FOREIGN KEY (MembershipLevelId) REFERENCES MembershipLevels(MembershipLevelId)
);
GO

/* =========================
   5. BRANCH / EMPLOYEE / WORKSHIFT
========================= */
CREATE TABLE Branches (
    BranchId INT IDENTITY(1,1) PRIMARY KEY,
    BranchName NVARCHAR(150) NOT NULL,
    Address NVARCHAR(255) NOT NULL,
    Phone NVARCHAR(20) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE Employees (
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    BranchId INT NULL,
    Position NVARCHAR(100) NULL,
    Specialization NVARCHAR(150) NULL,
    Salary DECIMAL(18,2) NULL,
    HireDate DATE NULL,
    YearsOfExperience INT NOT NULL DEFAULT 0,
    Bio NVARCHAR(MAX) NULL,
    ImageUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT FK_Employees_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_Employees_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId)
);
GO

CREATE TABLE WorkShifts (
    ShiftId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    ShiftDate DATE NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    ShiftType NVARCHAR(50) NULL,
    IsDayOff BIT NOT NULL DEFAULT 0,
    Notes NVARCHAR(255) NULL,
    CONSTRAINT FK_WorkShifts_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE
);
GO

/* =========================
   6. SERVICES
========================= */
CREATE TABLE ServiceCategories (
    CategoryId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255) NULL,
    ImageUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE Services (
    ServiceId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryId INT NOT NULL,
    ServiceName NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    DurationMinutes INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    ImageUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT FK_Services_Categories FOREIGN KEY (CategoryId) REFERENCES ServiceCategories(CategoryId)
);
GO

CREATE TABLE EmployeeServices (
    EmployeeId INT NOT NULL,
    ServiceId INT NOT NULL,
    PRIMARY KEY (EmployeeId, ServiceId),
    CONSTRAINT FK_EmployeeServices_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE,
    CONSTRAINT FK_EmployeeServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE
);
GO

CREATE TABLE ServiceResources (
    ResourceId INT IDENTITY(1,1) PRIMARY KEY,
    BranchId INT NULL,
    ResourceName NVARCHAR(100) NOT NULL,
    ResourceType NVARCHAR(50) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT FK_ServiceResources_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId)
);
GO

/* =========================
   7. PROMOTIONS / VOUCHERS
========================= */
CREATE TABLE Promotions (
    PromotionId INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    DiscountPercent DECIMAL(5,2) NULL,
    ImageUrl NVARCHAR(255) NULL,
    StartDate DATE NULL,
    EndDate DATE NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE ServicePromotions (
    ServiceId INT NOT NULL,
    PromotionId INT NOT NULL,
    PRIMARY KEY (ServiceId, PromotionId),
    CONSTRAINT FK_ServicePromotions_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE,
    CONSTRAINT FK_ServicePromotions_Promotions FOREIGN KEY (PromotionId) REFERENCES Promotions(PromotionId) ON DELETE CASCADE
);
GO

CREATE TABLE Vouchers (
    VoucherId INT IDENTITY(1,1) PRIMARY KEY,
    Code NVARCHAR(50) NOT NULL UNIQUE,
    DiscountType NVARCHAR(20) NOT NULL, -- PERCENT / AMOUNT
    DiscountValue DECIMAL(18,2) NOT NULL,
    MinOrderAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    MaxDiscountAmount DECIMAL(18,2) NULL,
    StartDate DATE NULL,
    EndDate DATE NULL,
    Quantity INT NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE CustomerVouchers (
    CustomerId INT NOT NULL,
    VoucherId INT NOT NULL,
    UsedStatus BIT NOT NULL DEFAULT 0,
    UsedAt DATETIME NULL,
    PRIMARY KEY (CustomerId, VoucherId),
    CONSTRAINT FK_CustomerVouchers_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerVouchers_Vouchers FOREIGN KEY (VoucherId) REFERENCES Vouchers(VoucherId) ON DELETE CASCADE
);
GO

/* =========================
   8. PACKAGES / COMBO / LIEU TRINH
========================= */
CREATE TABLE PackageCategories (
    PackageCategoryId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE Packages (
    PackageId INT IDENTITY(1,1) PRIMARY KEY,
    PackageCategoryId INT NULL,
    PackageName NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OriginalPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    SalePrice DECIMAL(18,2) NOT NULL DEFAULT 0,
    TotalSessions INT NOT NULL DEFAULT 1,
    ValidityDays INT NOT NULL DEFAULT 30,
    ImageUrl NVARCHAR(255) NULL,
    IsHot BIT NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Packages_PackageCategories FOREIGN KEY (PackageCategoryId) REFERENCES PackageCategories(PackageCategoryId)
);
GO

CREATE TABLE PackageServices (
    PackageServiceId INT IDENTITY(1,1) PRIMARY KEY,
    PackageId INT NOT NULL,
    ServiceId INT NOT NULL,
    SessionCount INT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_PackageServices UNIQUE (PackageId, ServiceId),
    CONSTRAINT FK_PackageServices_Packages FOREIGN KEY (PackageId) REFERENCES Packages(PackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE
);
GO

CREATE TABLE CustomerPackages (
    CustomerPackageId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    PackageId INT NOT NULL,
    StartDate DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    EndDate DATE NOT NULL,
    TotalSessions INT NOT NULL,
    UsedSessions INT NOT NULL DEFAULT 0,
    RemainingSessions INT NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT / ACTIVE / EXPIRED / CANCELLED / USED_UP
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_CustomerPackages_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerPackages_Packages FOREIGN KEY (PackageId) REFERENCES Packages(PackageId)
);
GO

CREATE TABLE PackagePayments (
    PackagePaymentId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NOT NULL DEFAULT 'VNPAY',
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / PAID / FAILED / REFUNDED
    TransactionCode NVARCHAR(100) NULL,
    VnpTxnRef NVARCHAR(100) NULL,
    VnpTransactionNo NVARCHAR(100) NULL,
    VnpResponseCode NVARCHAR(20) NULL,
    PaidAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PackagePayments_CustomerPackages FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE
);
GO

/* =========================
   9. APPOINTMENTS
========================= */
CREATE TABLE Appointments (
    AppointmentId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    EmployeeId INT NOT NULL,
    BranchId INT NULL,
    ResourceId INT NULL,
    CustomerPackageId INT NULL,
    AppointmentDate DATE NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
    Notes NVARCHAR(MAX) NULL,
    CancelReason NVARCHAR(255) NULL,
    CheckedInAt DATETIME NULL,
    CheckedOutAt DATETIME NULL,
    CompletedAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Appointments_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT FK_Appointments_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT FK_Appointments_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
    CONSTRAINT FK_Appointments_Resources FOREIGN KEY (ResourceId) REFERENCES ServiceResources(ResourceId),
    CONSTRAINT FK_Appointments_CustomerPackages FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId)
);
GO

CREATE TABLE AppointmentServices (
    AppointmentServiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_AppointmentServices_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE CASCADE,
    CONSTRAINT FK_AppointmentServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

CREATE TABLE AppointmentStatusHistory (
    HistoryId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    OldStatus NVARCHAR(30) NULL,
    NewStatus NVARCHAR(30) NOT NULL,
    ChangedBy INT NULL,
    Reason NVARCHAR(MAX) NULL,
    ChangedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_StatusHistory_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    CONSTRAINT FK_StatusHistory_Users FOREIGN KEY (ChangedBy) REFERENCES Users(UserId)
);
GO

/* =========================
   10. INVOICES / PAYMENTS / REFUNDS
========================= */
CREATE TABLE Invoices (
    InvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL UNIQUE,
    TotalAmount DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    FinalAmount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Invoices_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
);
GO

CREATE TABLE Payments (
    PaymentId INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NULL, -- CASH / BANKING / VNPAY
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    TransactionCode NVARCHAR(100) NULL,
    VnpTxnRef NVARCHAR(100) NULL,
    VnpTransactionNo NVARCHAR(100) NULL,
    VnpResponseCode NVARCHAR(20) NULL,
    PaidAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(InvoiceId)
);
GO

CREATE TABLE Refunds (
    RefundId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    RefundAmount DECIMAL(18,2) NOT NULL,
    Reason NVARCHAR(MAX) NULL,
    RefundedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Refunds_Payments FOREIGN KEY (PaymentId) REFERENCES Payments(PaymentId)
);
GO

/* =========================
   11. REVIEW / FEEDBACK
========================= */
CREATE TABLE Reviews (
    ReviewId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    EmployeeId INT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Reviews_Customer_Appointment_Service UNIQUE (CustomerId, AppointmentId, ServiceId),
    CONSTRAINT FK_Reviews_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT FK_Reviews_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    CONSTRAINT FK_Reviews_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    CONSTRAINT FK_Reviews_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId)
);
GO

CREATE TABLE Feedbacks (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    Subject NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Feedbacks_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE SET NULL
);
GO

CREATE TABLE WaitingList (
    WaitingId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    ServiceId INT NOT NULL,
    PreferredDate DATE NULL,
    PreferredTime TIME NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'WAITING',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_WaitingList_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_WaitingList_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

/* =========================
   12. NOTIFICATION / LOG / AI
========================= */
CREATE TABLE Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NULL,
    Type NVARCHAR(50) NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Notifications_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
);
GO

CREATE TABLE SystemLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    RoleName NVARCHAR(50) NULL,
    ActionName NVARCHAR(200) NULL,
    ActionType NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    IpAddress NVARCHAR(50) NULL,
    OldValue NVARCHAR(MAX) NULL,
    NewValue NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_SystemLogs_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
);
GO

CREATE TABLE AIRecommendations (
    RecommendationId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    ServiceId INT NULL,
    RecommendationType NVARCHAR(100) NULL,
    Reason NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_AIRecommendations_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE SET NULL,
    CONSTRAINT FK_AIRecommendations_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE SET NULL
);
GO

CREATE TABLE AIPredictions (
    PredictionId INT IDENTITY(1,1) PRIMARY KEY,
    PredictionType NVARCHAR(100) NULL,
    Result NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE AIChatLogs (
    ChatId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    Question NVARCHAR(MAX) NULL,
    Answer NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_AIChatLogs_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
);
GO

CREATE TABLE AIAuditLogs (
    AuditId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    FeatureName NVARCHAR(100) NULL,
    Prompt NVARCHAR(MAX) NOT NULL,
    AIResponse NVARCHAR(MAX) NULL,
    ModelName NVARCHAR(100) NULL,
    InputToken INT NULL,
    OutputToken INT NULL,
    Cost DECIMAL(18,4) NULL,
    IsChecked BIT DEFAULT 0,
    CheckResult NVARCHAR(MAX) NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_AIAuditLogs_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
);
GO

CREATE TABLE EmployeePerformance (
    PerformanceId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    TotalAppointments INT DEFAULT 0,
    CompletedAppointments INT DEFAULT 0,
    CancelledAppointments INT DEFAULT 0,
    AverageRating DECIMAL(3,2) NULL,
    Revenue DECIMAL(18,2) DEFAULT 0,
    Month INT NOT NULL,
    Year INT NOT NULL,
    CONSTRAINT FK_EmployeePerformance_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId)
);
GO

/* =========================
   13. USEFUL VIEWS
========================= */
CREATE VIEW vw_MonthlyRevenue AS
SELECT 
    YEAR(i.CreatedAt) AS RevenueYear,
    MONTH(i.CreatedAt) AS RevenueMonth,
    COUNT(i.InvoiceId) AS TotalInvoices,
    SUM(i.FinalAmount) AS TotalRevenue
FROM Invoices i
GROUP BY YEAR(i.CreatedAt), MONTH(i.CreatedAt);
GO

CREATE VIEW vw_ServiceRatings AS
SELECT
    s.ServiceId,
    s.ServiceName,
    COUNT(r.ReviewId) AS ReviewCount,
    CAST(AVG(CAST(r.Rating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
FROM Services s
LEFT JOIN Reviews r ON s.ServiceId = r.ServiceId
GROUP BY s.ServiceId, s.ServiceName;
GO

CREATE VIEW vw_EmployeeRatings AS
SELECT
    e.EmployeeId,
    u.FullName,
    COUNT(r.ReviewId) AS ReviewCount,
    CAST(AVG(CAST(r.Rating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
FROM Employees e
JOIN Users u ON e.UserId = u.UserId
LEFT JOIN Reviews r ON e.EmployeeId = r.EmployeeId
GROUP BY e.EmployeeId, u.FullName;
GO

/* =========================
   14. SEED DATA
========================= */
INSERT INTO Roles (RoleName) VALUES
('ADMIN'), ('MANAGER'), ('RECEPTIONIST'), ('TECHNICIAN'), ('CUSTOMER');
GO

INSERT INTO MembershipLevels (LevelName, MinPoints, DiscountPercent, Description) VALUES
(N'Normal', 0, 0, N'Khách hàng thường'),
(N'Silver', 100, 5, N'Giảm 5%'),
(N'Gold', 300, 10, N'Giảm 10%'),
(N'Diamond', 700, 15, N'Giảm 15%');
GO

INSERT INTO Branches (BranchName, Address, Phone) VALUES
(N'Beauty Salon Chi nhánh 1', N'Đà Nẵng', '0900000001'),
(N'Beauty Salon Chi nhánh 2', N'Hồ Chí Minh', '0900000002');
GO

INSERT INTO ServiceCategories (CategoryName, Description, ImageUrl) VALUES
(N'Massage', N'Dịch vụ massage thư giãn', '/images/categories/massage.png'),
(N'Nail', N'Dịch vụ làm móng', '/images/categories/nail.png'),
(N'Hair', N'Dịch vụ tóc', '/images/categories/hair.png'),
(N'Skincare', N'Chăm sóc da', '/images/categories/skincare.png'),
(N'Detox', N'Giảm béo và thải độc', '/images/categories/detox.png');
GO

INSERT INTO Services (CategoryId, ServiceName, Description, DurationMinutes, Price, ImageUrl) VALUES
(1, N'Massage thư giãn', N'Massage toàn thân giúp thư giãn', 60, 300000, '/images/services/massage.png'),
(2, N'Nail cao cấp', N'Làm móng cao cấp', 45, 250000, '/images/services/nail.png'),
(3, N'Cắt & Tạo kiểu tóc', N'Cắt và tạo kiểu tóc chuyên nghiệp', 45, 200000, '/images/services/hair.png'),
(4, N'Chăm sóc da mặt', N'Chăm sóc da mặt cơ bản', 60, 350000, '/images/services/skincare.png'),
(3, N'Nhuộm tóc thời trang', N'Nhuộm tóc theo xu hướng', 120, 700000, '/images/services/hair-color.png'),
(5, N'Detox body', N'Liệu trình thải độc và giảm mỡ body', 90, 800000, '/images/services/detox-body.png'),
(4, N'Trị mụn chuyên sâu', N'Điều trị mụn và phục hồi da', 75, 650000, '/images/services/acne-care.png'),
(4, N'Trẻ hóa da', N'Nâng cơ và cải thiện độ đàn hồi da', 90, 900000, '/images/services/anti-aging.png');
GO

INSERT INTO ServiceResources (BranchId, ResourceName, ResourceType) VALUES
(1, N'Phòng Massage 01', N'ROOM'),
(1, N'Ghế Nail 01', N'CHAIR'),
(1, N'Ghế Làm Tóc 01', N'CHAIR'),
(2, N'Phòng Chăm Sóc Da 01', N'ROOM'),
(2, N'Phòng Detox 01', N'ROOM');
GO

-- Technician users
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, IsVerified) VALUES
(N'Linh Chi', 'linhchi@salon.com', '0911111111', '123456', 4, 1),
(N'Minh Anh', 'minhanh@salon.com', '0922222222', '123456', 4, 1),
(N'Thảo Vy', 'thaovy@salon.com', '0933333333', '123456', 4, 1),
(N'Quốc Bảo', 'quocbao@salon.com', '0944444444', '123456', 4, 1);
GO

INSERT INTO Employees (UserId, BranchId, Position, Specialization, HireDate, YearsOfExperience, Bio, ImageUrl, Status) VALUES
(1, 1, N'Kỹ thuật viên', N'Massage, Skincare', '2020-01-10', 5, N'Chuyên viên massage và chăm sóc da.', '/images/technicians/1.png', 'ACTIVE'),
(2, 1, N'Kỹ thuật viên', N'Nail', '2021-03-15', 4, N'Chuyên viên nail cao cấp.', '/images/technicians/2.png', 'ACTIVE'),
(3, 2, N'Tạo mẫu tóc', N'Hair Styling', '2019-06-20', 6, N'Chuyên viên tạo mẫu tóc.', '/images/technicians/3.png', 'ACTIVE'),
(4, 2, N'Tạo mẫu tóc', N'Hair Styling, Skincare', '2022-02-01', 3, N'Tạo mẫu tóc và chăm sóc da.', '/images/technicians/4.png', 'ACTIVE');
GO

INSERT INTO EmployeeServices (EmployeeId, ServiceId) VALUES
(1, 1), (1, 4), (1, 7), (1, 8),
(2, 2),
(3, 3), (3, 5),
(4, 3), (4, 5), (4, 4), (4, 8);
GO

INSERT INTO WorkShifts (EmployeeId, ShiftDate, StartTime, EndTime, ShiftType, IsDayOff) VALUES
(1, CAST(GETDATE() AS DATE), '08:00', '17:00', N'Ca ngày', 0),
(2, CAST(GETDATE() AS DATE), '08:00', '17:00', N'Ca ngày', 0),
(3, CAST(GETDATE() AS DATE), '13:00', '21:00', N'Ca chiều', 0),
(4, CAST(GETDATE() AS DATE), '08:00', '17:00', N'Ca ngày', 0);
GO

INSERT INTO Promotions (Title, Description, DiscountPercent, ImageUrl, StartDate, EndDate) VALUES
(N'Ưu đãi khai trương', N'Giảm giá cho khách hàng mới', 10, '/images/promotions/promo-1.png', CAST(GETDATE() AS DATE), DATEADD(DAY, 30, CAST(GETDATE() AS DATE))),
(N'Combo hè rạng rỡ', N'Ưu đãi liệu trình chăm sóc da mùa hè', 15, '/images/promotions/promo-2.png', CAST(GETDATE() AS DATE), DATEADD(DAY, 60, CAST(GETDATE() AS DATE)));
GO

INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount, StartDate, EndDate, Quantity) VALUES
('WELCOME10', 'PERCENT', 10, 0, 100000, CAST(GETDATE() AS DATE), DATEADD(DAY, 30, CAST(GETDATE() AS DATE)), 100),
('SALE50000', 'AMOUNT', 50000, 200000, NULL, CAST(GETDATE() AS DATE), DATEADD(DAY, 30, CAST(GETDATE() AS DATE)), 100);
GO

INSERT INTO PackageCategories (CategoryName, Description) VALUES
(N'Chăm sóc da mặt', N'Combo chăm sóc và phục hồi da'),
(N'Trị mụn', N'Liệu trình trị mụn chuyên sâu'),
(N'Trẻ hóa', N'Liệu trình trẻ hóa da'),
(N'Body', N'Giảm béo, detox và thư giãn body'),
(N'Tóc và Nail', N'Combo làm đẹp tóc và móng');
GO

INSERT INTO Packages (PackageCategoryId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, ValidityDays, ImageUrl, IsHot) VALUES
(1, N'Liệu trình căng bóng phục hồi chuyên sâu', N'Cấp ẩm sâu, phục hồi da hư tổn, giúp da căng bóng và mịn màng.', 5000000, 4000000, 5, 60, '/images/packages/glow-skin.png', 1),
(2, N'Liệu trình trị mụn chuẩn y khoa', N'Điều trị mụn tận gốc, ngăn ngừa tái phát và phục hồi da.', 7000000, 5950000, 8, 90, '/images/packages/acne-package.png', 1),
(4, N'Combo giảm béo slim body', N'Giảm mỡ, săn chắc cơ thể, thanh lọc và thải độc.', 8000000, 7200000, 10, 120, '/images/packages/slim-body.png', 0),
(3, N'Liệu trình trẻ hóa nâng cơ toàn diện', N'Nâng cơ, giảm nếp nhăn và cải thiện độ đàn hồi.', 12000000, 9000000, 6, 90, '/images/packages/anti-aging-package.png', 1),
(5, N'Combo làm đẹp tóc và nail', N'Làm tóc kết hợp nail cao cấp.', 1200000, 950000, 3, 45, '/images/packages/hair-nail.png', 0);
GO

INSERT INTO PackageServices (PackageId, ServiceId, SessionCount) VALUES
(1, 4, 3), (1, 8, 2),
(2, 7, 8),
(3, 6, 10),
(4, 8, 6),
(5, 2, 1), (5, 3, 1), (5, 5, 1);
GO

-- Admin and customer demo users
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, IsVerified) VALUES
(N'Admin Salon', 'admin@salon.com', '0909999999', '123456', 1, 1),
(N'Nguyễn Gia Kiên', 'customer@salon.com', '0908888888', '123456', 5, 1);
GO

INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId) VALUES
(6, N'Nam', '2004-01-01', N'Đà Nẵng', 120, 2);
GO

-- Demo completed appointment for review test
INSERT INTO Appointments (CustomerId, EmployeeId, BranchId, ResourceId, AppointmentDate, StartTime, EndTime, Status, Notes, CompletedAt) VALUES
(1, 1, 1, 1, DATEADD(DAY, -1, CAST(GETDATE() AS DATE)), '09:00', '10:00', 'COMPLETED', N'Lịch demo đã hoàn thành', DATEADD(DAY, -1, GETDATE()));
GO

INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price) VALUES
(1, 1, 300000),
(1, 4, 350000);
GO

INSERT INTO Invoices (AppointmentId, TotalAmount, DiscountAmount, FinalAmount) VALUES
(1, 650000, 0, 650000);
GO

INSERT INTO Payments (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt) VALUES
(1, 650000, 'CASH', 'PAID', 'DEMO-CASH-001', GETDATE());
GO

PRINT 'BeautySalonSystem COMPLETE database created successfully.';
GO

SELECT * INTO Reviews_Backup FROM Reviews;
SELECT * INTO Feedbacks_Backup FROM Feedbacks;

ALTER TABLE Reviews ADD
    ReviewType NVARCHAR(30) NOT NULL DEFAULT 'SERVICE',
    Title NVARCHAR(255) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    AdminResponse NVARCHAR(MAX) NULL;

	INSERT INTO Reviews
(
    CustomerId,
    AppointmentId,
    ServiceId,
    EmployeeId,
    ReviewType,
    Rating,
    Title,
    Comment,
    Status,
    AdminResponse,
    CreatedAt
)
SELECT
    CustomerId,
    NULL,
    NULL,
    NULL,
    'GENERAL',
    NULL,
    Subject,
    Content,
    Status,
    NULL,
    CreatedAt
FROM Feedbacks;

DROP TABLE Feedbacks;