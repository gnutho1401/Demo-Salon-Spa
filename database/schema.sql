/* =========================================================
   BEAUTY SALON MANAGEMENT SYSTEM - FULL DATABASE SQL SERVER
   Clean version: includes email verify + forgot password
   ========================================================= */

IF DB_ID('BeautySalonSystem') IS NOT NULL
BEGIN
    ALTER DATABASE BeautySalonSystem SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE BeautySalonSystem;
END
GO
CREATE DATABASE BeautySalonSystem;
GO

USE BeautySalonSystem;
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

CREATE UNIQUE INDEX IX_Users_Phone ON Users(Phone) WHERE Phone IS NOT NULL;
GO

/* =========================
   3. PENDING USERS - for email verification before creating user
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
   4. MEMBERSHIP LEVELS
========================= */
CREATE TABLE MembershipLevels (
    MembershipLevelId INT IDENTITY(1,1) PRIMARY KEY,
    LevelName NVARCHAR(50) NOT NULL UNIQUE,
    MinPoints INT NOT NULL DEFAULT 0,
    DiscountPercent DECIMAL(5,2) NOT NULL DEFAULT 0,
    Description NVARCHAR(255) NULL
);
GO

/* =========================
   5. CUSTOMERS
========================= */
CREATE TABLE Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Gender NVARCHAR(10) NULL,
    DateOfBirth DATE NULL,
    Address NVARCHAR(255) NULL,
    LoyaltyPoints INT NOT NULL DEFAULT 0,
    MembershipLevelId INT NULL,

    CONSTRAINT FK_Customers_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_Customers_MembershipLevels FOREIGN KEY (MembershipLevelId) REFERENCES MembershipLevels(MembershipLevelId)
);
GO

/* =========================
   6. BRANCHES
========================= */
CREATE TABLE Branches (
    BranchId INT IDENTITY(1,1) PRIMARY KEY,
    BranchName NVARCHAR(150) NOT NULL,
    Address NVARCHAR(255) NOT NULL,
    Phone NVARCHAR(20) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

/* =========================
   7. EMPLOYEES
========================= */
CREATE TABLE Employees (
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    BranchId INT NULL,
    Position NVARCHAR(100) NULL,
    Specialization NVARCHAR(150) NULL,
    Salary DECIMAL(18,2) NULL,
    HireDate DATE NULL,
    ImageUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT FK_Employees_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_Employees_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId)
);
GO

/* =========================
   8. WORK SHIFTS
========================= */
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
   9. SERVICE CATEGORIES
========================= */
CREATE TABLE ServiceCategories (
    CategoryId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255) NULL
);
GO

/* =========================
   10. SERVICES
========================= */
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

/* =========================
   11. SERVICE RESOURCES
========================= */
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
   12. PROMOTIONS
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
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE,
    FOREIGN KEY (PromotionId) REFERENCES Promotions(PromotionId) ON DELETE CASCADE
);
GO

/* =========================
   13. VOUCHERS
========================= */
CREATE TABLE Vouchers (
    VoucherId INT IDENTITY(1,1) PRIMARY KEY,
    Code NVARCHAR(50) NOT NULL UNIQUE,
    DiscountType NVARCHAR(20) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
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
    PRIMARY KEY (CustomerId, VoucherId),
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    FOREIGN KEY (VoucherId) REFERENCES Vouchers(VoucherId) ON DELETE CASCADE
);
GO

/* =========================
   14. PACKAGES / COMBO
========================= */
CREATE TABLE Packages (
    PackageId INT IDENTITY(1,1) PRIMARY KEY,
    PackageName NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Price DECIMAL(18,2) NOT NULL,
    ValidityDays INT NULL,
    ImageUrl NVARCHAR(255) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
GO

CREATE TABLE PackageServices (
    PackageId INT NOT NULL,
    ServiceId INT NOT NULL,
    PRIMARY KEY (PackageId, ServiceId),
    FOREIGN KEY (PackageId) REFERENCES Packages(PackageId) ON DELETE CASCADE,
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE
);
GO

CREATE TABLE CustomerPackages (
    CustomerPackageId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    PackageId INT NOT NULL,
    StartDate DATE NULL,
    EndDate DATE NULL,
    RemainingSessions INT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    FOREIGN KEY (PackageId) REFERENCES Packages(PackageId)
);
GO

/* =========================
   15. APPOINTMENTS
========================= */
CREATE TABLE Appointments (
    AppointmentId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    EmployeeId INT NOT NULL,
    BranchId INT NULL,
    ResourceId INT NULL,
    AppointmentDate DATE NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
    FOREIGN KEY (ResourceId) REFERENCES ServiceResources(ResourceId)
);
GO

CREATE TABLE AppointmentServices (
    AppointmentServiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE CASCADE,
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

/* =========================
   16. WAITING LIST
========================= */
CREATE TABLE WaitingList (
    WaitingId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    ServiceId INT NOT NULL,
    PreferredDate DATE NULL,
    PreferredTime TIME NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'WAITING',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

/* =========================
   17. INVOICES / PAYMENTS / REFUNDS
========================= */
CREATE TABLE Invoices (
    InvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL UNIQUE,
    TotalAmount DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    FinalAmount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
);
GO

CREATE TABLE Payments (
    PaymentId INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    TransactionCode NVARCHAR(100) NULL,
    PaidAt DATETIME NULL,
    FOREIGN KEY (InvoiceId) REFERENCES Invoices(InvoiceId)
);
GO

CREATE TABLE Refunds (
    RefundId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    RefundAmount DECIMAL(18,2) NOT NULL,
    Reason NVARCHAR(MAX) NULL,
    RefundedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (PaymentId) REFERENCES Payments(PaymentId)
);
GO

/* =========================
   18. REVIEWS / FEEDBACKS
========================= */
CREATE TABLE Reviews (
    ReviewId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AppointmentId INT NOT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
);
GO

CREATE TABLE Feedbacks (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    Subject NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE SET NULL
);
GO

/* =========================
   19. NOTIFICATIONS / LOGS
========================= */
CREATE TABLE Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NULL,
    Type NVARCHAR(50) NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
);
GO

CREATE TABLE SystemLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    ActionName NVARCHAR(200) NULL,
    Description NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
);
GO

/* =========================
   20. AI
========================= */
CREATE TABLE AIRecommendations (
    RecommendationId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    ServiceId INT NULL,
    RecommendationType NVARCHAR(100) NULL,
    Reason NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE SET NULL,
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE SET NULL
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
    FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE SET NULL
);
GO

/* =========================
   SEED DATA
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

INSERT INTO ServiceCategories (CategoryName, Description) VALUES
(N'Massage', N'Dịch vụ massage thư giãn'),
(N'Nail', N'Dịch vụ làm móng'),
(N'Hair', N'Dịch vụ tóc'),
(N'Skincare', N'Chăm sóc da');
GO

INSERT INTO Services (CategoryId, ServiceName, Description, DurationMinutes, Price, ImageUrl) VALUES
(1, N'Massage thư giãn', N'Massage toàn thân giúp thư giãn', 60, 300000, '/images/services/massage.png'),
(2, N'Nail cao cấp', N'Làm móng cao cấp', 45, 250000, '/images/services/nail.png'),
(3, N'Cắt & Tạo kiểu tóc', N'Cắt và tạo kiểu tóc chuyên nghiệp', 45, 200000, '/images/services/hair.png'),
(4, N'Chăm sóc da mặt', N'Chăm sóc da mặt cơ bản', 60, 350000, '/images/services/skincare.png'),
(3, N'Nhuộm tóc thời trang', N'Nhuộm tóc theo xu hướng', 120, 700000, '/images/services/hair-color.png');
GO

INSERT INTO ServiceResources (BranchId, ResourceName, ResourceType) VALUES
(1, N'Phòng Massage 01', N'ROOM'),
(1, N'Ghế Nail 01', N'CHAIR'),
(1, N'Ghế Làm Tóc 01', N'CHAIR'),
(2, N'Phòng Chăm Sóc Da 01', N'ROOM');
GO

INSERT INTO Promotions (Title, Description, DiscountPercent, ImageUrl, StartDate, EndDate) VALUES
(N'Ưu đãi khai trương', N'Giảm giá cho khách hàng mới', 10, '/images/promotions/promo-1.png', GETDATE(), DATEADD(DAY, 30, GETDATE()));
GO

INSERT INTO Vouchers (Code, DiscountType, DiscountValue, StartDate, EndDate, Quantity) VALUES
('WELCOME10', 'PERCENT', 10, GETDATE(), DATEADD(DAY, 30, GETDATE()), 100),
('SALE50000', 'AMOUNT', 50000, GETDATE(), DATEADD(DAY, 30, GETDATE()), 100);
GO

INSERT INTO Packages (PackageName, Description, Price, ValidityDays, ImageUrl) VALUES
(N'Combo Thư Giãn', N'Massage + Chăm sóc da', 600000, 30, '/images/packages/combo-relax.png'),
(N'Combo Làm Đẹp', N'Nail + Tóc', 400000, 30, '/images/packages/combo-beauty.png');
GO

INSERT INTO PackageServices (PackageId, ServiceId) VALUES
(1, 1), (1, 4),
(2, 2), (2, 3);
GO

PRINT 'BeautySalonSystem database created successfully.';
GO



INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, IsVerified)
VALUES
(N'Linh Chi', 'linhchi@salon.com', '0911111111', '123456', 4, 1),
(N'Minh Anh', 'minhanh@salon.com', '0922222222', '123456', 4, 1),
(N'Thảo Vy', 'thaovy@salon.com', '0933333333', '123456', 4, 1);
GO

INSERT INTO Employees (UserId, BranchId, Position, Specialization, ImageUrl, Status)
VALUES
(1, 1, N'Kỹ thuật viên', N'Massage, Skincare', '/images/technicians/1.png', 'ACTIVE'),
(2, 1, N'Kỹ thuật viên', N'Nail', '/images/technicians/2.png', 'ACTIVE'),
(3, 2, N'Tạo mẫu tóc', N'Hair Styling', '/images/technicians/3.png', 'ACTIVE');
GO
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, IsVerified)
VALUES
(N'Quốc Bảo', 'quocbao@salon.com', '0944444444', '123456', 4, 1);
GO

INSERT INTO Employees (UserId, BranchId, Position, Specialization, ImageUrl, Status)
VALUES
(4, 2, N'Tạo mẫu tóc', N'Hair Styling', '/images/technicians/4.png', 'ACTIVE');
GO
