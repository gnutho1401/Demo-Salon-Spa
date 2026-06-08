CREATE DATABASE BeautySalonSystem;
GO

USE BeautySalonSystem;
GO

ALTER TABLE Services
ADD ImageUrl NVARCHAR(255);
GO

UPDATE Services
SET ImageUrl = '/images/services/massage.png'
WHERE ServiceName = N'Massage thư giãn';

UPDATE Services
SET ImageUrl = '/images/services/nail.png'
WHERE ServiceName = N'Nail cao cấp';

UPDATE Services
SET ImageUrl = '/images/services/hair.png'
WHERE ServiceName = N'Cắt & Tạo kiểu tóc';

UPDATE Services
SET ImageUrl = '/images/services/skincare.png'
WHERE ServiceName = N'Chăm sóc da mặt';

UPDATE Services
SET ImageUrl = '/images/services/hair-color.png'
WHERE ServiceName = N'Nhuộm tóc thời trang';

ALTER TABLE Users
ADD IsVerified BIT DEFAULT 0;
GO

ALTER TABLE Users
ADD VerifyCode NVARCHAR(10);
GO
-- =========================
-- 1. ROLES
-- =========================
CREATE TABLE Roles (
    RoleId INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(50) NOT NULL UNIQUE
);
GO

-- =========================
-- 2. USERS
-- =========================
CREATE TABLE Users (
    UserId INT IDENTITY(1,1) PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Phone NVARCHAR(20) UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    RoleId INT NOT NULL,
    Status NVARCHAR(20) DEFAULT 'ACTIVE',
    CreatedAt DATETIME DEFAULT GETDATE(),

    CONSTRAINT FK_Users_Roles
        FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
);
GO

-- =========================
-- 3. CUSTOMERS
-- =========================
CREATE TABLE Customers (
    CustomerId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Gender NVARCHAR(10),
    DateOfBirth DATE,
    Address NVARCHAR(255),
    LoyaltyPoints INT DEFAULT 0,
    MembershipLevel NVARCHAR(50) DEFAULT N'Normal',

    CONSTRAINT FK_Customers_Users
        FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
GO

-- =========================
-- 4. EMPLOYEES
-- =========================
CREATE TABLE Employees (
    EmployeeId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL UNIQUE,
    Position NVARCHAR(100),
    Specialization NVARCHAR(150),
    Salary DECIMAL(18,2),
    HireDate DATE,
    Status NVARCHAR(20) DEFAULT 'ACTIVE',

    CONSTRAINT FK_Employees_Users
        FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
GO

-- =========================
-- 5. WORK SHIFTS
-- =========================
CREATE TABLE WorkShifts (
    ShiftId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    ShiftDate DATE NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,

    CONSTRAINT FK_WorkShifts_Employees
        FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId)
);
GO

-- =========================
-- 6. SERVICE CATEGORIES
-- =========================
CREATE TABLE ServiceCategories (
    CategoryId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255)
);
GO

-- =========================
-- 7. SERVICES
-- =========================
CREATE TABLE Services (
    ServiceId INT IDENTITY(1,1) PRIMARY KEY,
    CategoryId INT NOT NULL,
    ServiceName NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX),
    DurationMinutes INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(20) DEFAULT 'AVAILABLE',

    CONSTRAINT FK_Services_Categories
        FOREIGN KEY (CategoryId) REFERENCES ServiceCategories(CategoryId)
);
GO

-- =========================
-- 8. ROOMS / CHAIRS / BEDS
-- =========================
CREATE TABLE ServiceResources (
    ResourceId INT IDENTITY(1,1) PRIMARY KEY,
    ResourceName NVARCHAR(100) NOT NULL,
    ResourceType NVARCHAR(50),
    Status NVARCHAR(20) DEFAULT 'AVAILABLE'
);
GO

-- =========================
-- 9. PROMOTIONS
-- =========================
CREATE TABLE Promotions (
    PromotionId INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX),
    DiscountPercent DECIMAL(5,2),
    StartDate DATE,
    EndDate DATE,
    Status NVARCHAR(20) DEFAULT 'ACTIVE'
);
GO

-- =========================
-- 10. SERVICE PROMOTIONS
-- =========================
CREATE TABLE ServicePromotions (
    ServiceId INT NOT NULL,
    PromotionId INT NOT NULL,

    PRIMARY KEY (ServiceId, PromotionId),

    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    FOREIGN KEY (PromotionId) REFERENCES Promotions(PromotionId)
);
GO

-- =========================
-- 11. VOUCHERS
-- =========================
CREATE TABLE Vouchers (
    VoucherId INT IDENTITY(1,1) PRIMARY KEY,
    Code NVARCHAR(50) NOT NULL UNIQUE,
    DiscountType NVARCHAR(20) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
    StartDate DATE,
    EndDate DATE,
    Quantity INT DEFAULT 0,
    Status NVARCHAR(20) DEFAULT 'ACTIVE'
);
GO

-- =========================
-- 12. CUSTOMER VOUCHERS
-- =========================
CREATE TABLE CustomerVouchers (
    CustomerId INT NOT NULL,
    VoucherId INT NOT NULL,
    UsedStatus BIT DEFAULT 0,

    PRIMARY KEY (CustomerId, VoucherId),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (VoucherId) REFERENCES Vouchers(VoucherId)
);
GO

-- =========================
-- 13. PACKAGES / COMBO
-- =========================
CREATE TABLE Packages (
    PackageId INT IDENTITY(1,1) PRIMARY KEY,
    PackageName NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX),
    Price DECIMAL(18,2) NOT NULL,
    ValidityDays INT,
    Status NVARCHAR(20) DEFAULT 'ACTIVE'
);
GO

-- =========================
-- 14. PACKAGE SERVICES
-- =========================
CREATE TABLE PackageServices (
    PackageId INT NOT NULL,
    ServiceId INT NOT NULL,

    PRIMARY KEY (PackageId, ServiceId),

    FOREIGN KEY (PackageId) REFERENCES Packages(PackageId),
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

-- =========================
-- 15. CUSTOMER PACKAGES
-- =========================
CREATE TABLE CustomerPackages (
    CustomerPackageId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    PackageId INT NOT NULL,
    StartDate DATE,
    EndDate DATE,
    RemainingSessions INT,
    Status NVARCHAR(20) DEFAULT 'ACTIVE',

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (PackageId) REFERENCES Packages(PackageId)
);
GO

-- =========================
-- 16. APPOINTMENTS
-- =========================
CREATE TABLE Appointments (
    AppointmentId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    EmployeeId INT NOT NULL,
    ResourceId INT NULL,
    AppointmentDate DATE NOT NULL,
    StartTime TIME NOT NULL,
    EndTime TIME NOT NULL,
    Status NVARCHAR(30) DEFAULT 'PENDING',
    Notes NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    FOREIGN KEY (ResourceId) REFERENCES ServiceResources(ResourceId)
);
GO

-- =========================
-- 17. APPOINTMENT SERVICES
-- =========================
CREATE TABLE AppointmentServices (
    AppointmentServiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,

    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

-- =========================
-- 18. WAITING LIST
-- =========================
CREATE TABLE WaitingList (
    WaitingId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    ServiceId INT NOT NULL,
    PreferredDate DATE,
    PreferredTime TIME,
    Status NVARCHAR(20) DEFAULT 'WAITING',
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

-- =========================
-- 19. INVOICES
-- =========================
CREATE TABLE Invoices (
    InvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL UNIQUE,
    TotalAmount DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) DEFAULT 0,
    FinalAmount DECIMAL(18,2) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
);
GO

-- =========================
-- 20. PAYMENTS
-- =========================
CREATE TABLE Payments (
    PaymentId INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30),
    Status NVARCHAR(20) DEFAULT 'PENDING',
    TransactionCode NVARCHAR(100),
    PaidAt DATETIME,

    FOREIGN KEY (InvoiceId) REFERENCES Invoices(InvoiceId)
);
GO

-- =========================
-- 21. REFUNDS
-- =========================
CREATE TABLE Refunds (
    RefundId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    RefundAmount DECIMAL(18,2) NOT NULL,
    Reason NVARCHAR(MAX),
    RefundedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (PaymentId) REFERENCES Payments(PaymentId)
);
GO

-- =========================
-- 22. REVIEWS
-- =========================
CREATE TABLE Reviews (
    ReviewId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AppointmentId INT NOT NULL,
    Rating INT CHECK (Rating BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
);
GO

-- =========================
-- 23. FEEDBACKS / COMPLAINTS
-- =========================
CREATE TABLE Feedbacks (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    Subject NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) DEFAULT 'PENDING',
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);
GO

-- =========================
-- 24. NOTIFICATIONS
-- =========================
CREATE TABLE Notifications (
    NotificationId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX),
    Type NVARCHAR(50),
    IsRead BIT DEFAULT 0,
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
GO

-- =========================
-- 25. SYSTEM LOGS
-- =========================
CREATE TABLE SystemLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    ActionName NVARCHAR(200),
    Description NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
GO

-- =========================
-- 26. AI RECOMMENDATIONS
-- =========================
CREATE TABLE AIRecommendations (
    RecommendationId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    ServiceId INT NULL,
    RecommendationType NVARCHAR(100),
    Reason NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId)
);
GO

-- =========================
-- 27. AI PREDICTIONS
-- =========================
CREATE TABLE AIPredictions (
    PredictionId INT IDENTITY(1,1) PRIMARY KEY,
    PredictionType NVARCHAR(100),
    Result NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- =========================
-- 28. AI CHAT LOGS
-- =========================
CREATE TABLE AIChatLogs (
    ChatId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL,
    Question NVARCHAR(MAX),
    Answer NVARCHAR(MAX),
    CreatedAt DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
GO