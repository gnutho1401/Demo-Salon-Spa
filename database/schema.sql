
/* =========================================================
   BEAUTY SALON MANAGEMENT SYSTEM - COMPLETE TEST DATABASE
   SQL Server
   Database: BeautySalonSystem1

   Dùng để test đầy đủ:
   - Admin / Manager dashboard
   - Customer booking, payment, history, review, feedback
   - Receptionist appointment, check-in, invoice, waiting list
   - Technician schedule, appointment, treatment notes, earnings
   - Voucher, package, refund, notification, AI demo
   ========================================================= */

IF DB_ID('BeautySalonSystem1') IS NOT NULL
BEGIN
    ALTER DATABASE BeautySalonSystem1 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE BeautySalonSystem1;
END
GO

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
    CONSTRAINT FK_Users_Roles FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),
    CONSTRAINT CK_Users_Status CHECK (Status IN ('ACTIVE', 'INACTIVE', 'BANNED'))
);
GO

CREATE UNIQUE INDEX IX_Users_Phone_NotNull ON Users(Phone) WHERE Phone IS NOT NULL;
GO

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
   3. MEMBERSHIP / CUSTOMER
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
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Customers_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_Customers_MembershipLevels FOREIGN KEY (MembershipLevelId) REFERENCES MembershipLevels(MembershipLevelId)
);
GO

/* =========================
   4. BRANCH / EMPLOYEE / SHIFT
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
    CONSTRAINT FK_WorkShifts_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE,
    CONSTRAINT CK_WorkShifts_Time CHECK (EndTime > StartTime)
);
GO

/* =========================
   5. SERVICES
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
    CONSTRAINT FK_Services_Categories FOREIGN KEY (CategoryId) REFERENCES ServiceCategories(CategoryId),
    CONSTRAINT CK_Services_Duration CHECK (DurationMinutes > 0),
    CONSTRAINT CK_Services_Price CHECK (Price >= 0)
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
   6. PROMOTION / VOUCHER
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
    DiscountType NVARCHAR(20) NOT NULL,
    DiscountValue DECIMAL(18,2) NOT NULL,
    MinOrderAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    MaxDiscountAmount DECIMAL(18,2) NULL,
    StartDate DATE NULL,
    EndDate DATE NULL,
    Quantity INT NOT NULL DEFAULT 0,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT CK_Vouchers_DiscountType CHECK (DiscountType IN ('PERCENT', 'AMOUNT')),
    CONSTRAINT CK_Vouchers_DiscountValue CHECK (DiscountValue >= 0)
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
   7. PACKAGES
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
    CONSTRAINT FK_Packages_PackageCategories FOREIGN KEY (PackageCategoryId) REFERENCES PackageCategories(PackageCategoryId),
    CONSTRAINT CK_Packages_Price CHECK (OriginalPrice >= 0 AND SalePrice >= 0),
    CONSTRAINT CK_Packages_Sessions CHECK (TotalSessions > 0)
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
    Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_CustomerPackages_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerPackages_Packages FOREIGN KEY (PackageId) REFERENCES Packages(PackageId),
    CONSTRAINT CK_CustomerPackages_Status CHECK (Status IN ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'USED_UP'))
);
GO

CREATE TABLE PackagePayments (
    PackagePaymentId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NOT NULL DEFAULT 'VNPAY',
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    TransactionCode NVARCHAR(100) NULL,
    VnpTxnRef NVARCHAR(100) NULL,
    VnpTransactionNo NVARCHAR(100) NULL,
    VnpResponseCode NVARCHAR(20) NULL,
    PaidAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PackagePayments_CustomerPackages FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT CK_PackagePayments_Status CHECK (Status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED'))
);
GO

/* =========================
   8. APPOINTMENTS / PAYMENT
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
    Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
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
    CONSTRAINT FK_Appointments_CustomerPackages FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId),
    CONSTRAINT CK_Appointments_Status CHECK (Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'NO_SHOW')),
    CONSTRAINT CK_Appointments_Time CHECK (EndTime > StartTime)
);
GO

CREATE INDEX IX_Appointments_Customer ON Appointments(CustomerId, AppointmentDate DESC);
CREATE INDEX IX_Appointments_Employee_Date ON Appointments(EmployeeId, AppointmentDate, StartTime, EndTime);
GO

CREATE TABLE AppointmentServices (
    AppointmentServiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    Price DECIMAL(18,2) NOT NULL,
    CONSTRAINT UQ_AppointmentServices UNIQUE (AppointmentId, ServiceId),
    CONSTRAINT FK_AppointmentServices_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE CASCADE,
    CONSTRAINT FK_AppointmentServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    CONSTRAINT CK_AppointmentServices_Price CHECK (Price >= 0)
);
GO

CREATE TABLE AppointmentStatusHistory (
    HistoryId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    OldStatus NVARCHAR(30) NULL,
    NewStatus NVARCHAR(30) NOT NULL,
    ChangedBy INT NULL,
    Reason NVARCHAR(MAX) NULL,
    ChangedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_StatusHistory_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    CONSTRAINT FK_StatusHistory_Users FOREIGN KEY (ChangedBy) REFERENCES Users(UserId)
);
GO

CREATE TABLE Invoices (
    InvoiceId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL UNIQUE,
    VoucherId INT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
    FinalAmount DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    TechnicianCommissionRate DECIMAL(5,2) NULL,
    TechnicianCommissionAmount DECIMAL(18,2) NULL,
    TechnicianTipAmount DECIMAL(18,2) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Invoices_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    CONSTRAINT FK_Invoices_Vouchers FOREIGN KEY (VoucherId) REFERENCES Vouchers(VoucherId),
    CONSTRAINT CK_Invoices_Amount CHECK (TotalAmount >= 0 AND DiscountAmount >= 0 AND FinalAmount >= 0),
    CONSTRAINT CK_Invoices_Status CHECK (Status IN ('UNPAID', 'PAID', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'))
);
GO

CREATE TABLE Payments (
    PaymentId INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    PaymentMethod NVARCHAR(30) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    TransactionCode NVARCHAR(100) NULL,
    VnpTxnRef NVARCHAR(100) NULL,
    VnpTransactionNo NVARCHAR(100) NULL,
    VnpResponseCode NVARCHAR(20) NULL,
    PaidAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Payments_Invoices FOREIGN KEY (InvoiceId) REFERENCES Invoices(InvoiceId),
    CONSTRAINT CK_Payments_Status CHECK (Status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'REFUND_PENDING')),
    CONSTRAINT CK_Payments_Amount CHECK (Amount >= 0)
);
GO

CREATE INDEX IX_Payments_Invoice_CreatedAt ON Payments(InvoiceId, CreatedAt DESC);
GO

CREATE TABLE Refunds (
    RefundId INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    RefundAmount DECIMAL(18,2) NOT NULL,
    Reason NVARCHAR(MAX) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    RefundedAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Refunds_Payments FOREIGN KEY (PaymentId) REFERENCES Payments(PaymentId),
    CONSTRAINT CK_Refunds_Status CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    CONSTRAINT CK_Refunds_Amount CHECK (RefundAmount >= 0)
);
GO

CREATE UNIQUE INDEX UX_Refunds_Payment_Active
ON Refunds(PaymentId)
WHERE Status IN ('PENDING', 'APPROVED', 'COMPLETED');
GO

/* =========================
   9. REVIEWS / FEEDBACK / WAITING
========================= */
CREATE TABLE Reviews (
    ReviewId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NOT NULL,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    EmployeeId INT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 5),
    TechnicianRating INT NOT NULL DEFAULT 5 CHECK (TechnicianRating BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX) NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    AdminResponse NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT UQ_Reviews_Customer_Appointment_Service UNIQUE (CustomerId, AppointmentId, ServiceId),
    CONSTRAINT FK_Reviews_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT FK_Reviews_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId),
    CONSTRAINT FK_Reviews_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    CONSTRAINT FK_Reviews_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT CK_Reviews_Status CHECK (Status IN ('PENDING', 'APPROVED', 'HIDDEN'))
);
GO

CREATE TABLE ReviewImages (
    ReviewImageId INT IDENTITY(1,1) PRIMARY KEY,
    ReviewId INT NOT NULL,
    ImageUrl NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ReviewImages_Reviews FOREIGN KEY (ReviewId) REFERENCES Reviews(ReviewId) ON DELETE CASCADE
);
GO

CREATE TABLE Feedbacks (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerId INT NULL,
    Subject NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    AdminResponse NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_Feedbacks_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE SET NULL,
    CONSTRAINT CK_Feedbacks_Status CHECK (Status IN ('PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED'))
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
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_WaitingList_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_WaitingList_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    CONSTRAINT CK_WaitingList_Status CHECK (Status IN ('WAITING', 'NOTIFIED', 'BOOKED', 'CANCELLED'))
);
GO

/* =========================
   10. FAVORITE / NOTIFICATION / LOG / AI
========================= */
CREATE TABLE CustomerFavoriteServices (
    UserId INT NOT NULL,
    ServiceId INT NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_CustomerFavoriteServices PRIMARY KEY (UserId, ServiceId),
    CONSTRAINT FK_CustomerFavoriteServices_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerFavoriteServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE
);
GO

CREATE TABLE CustomerFavoriteEmployees (
    UserId INT NOT NULL,
    EmployeeId INT NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_CustomerFavoriteEmployees PRIMARY KEY (UserId, EmployeeId),
    CONSTRAINT FK_CustomerFavoriteEmployees_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerFavoriteEmployees_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE
);
GO

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
   11. TREATMENT NOTES / EARNINGS
========================= */
CREATE TABLE TreatmentNotes (
    NoteId INT IDENTITY(1,1) PRIMARY KEY,
    AppointmentId INT NOT NULL,
    EmployeeId INT NOT NULL,
    Title NVARCHAR(150) NULL,
    Content NVARCHAR(MAX) NOT NULL,
    NoteType NVARCHAR(50) NULL,
    ProductsUsed NVARCHAR(MAX) NULL,
    SkinCondition NVARCHAR(MAX) NULL,
    Technique NVARCHAR(MAX) NULL,
    CustomerFeedback NVARCHAR(MAX) NULL,
    Recommendation NVARCHAR(MAX) NULL,
    FollowUpDate DATE NULL,
    ProgressStatus NVARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    PersonalNotes NVARCHAR(MAX) NULL,
    SpecialNotice NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_TreatmentNotes_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE CASCADE,
    CONSTRAINT FK_TreatmentNotes_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT CK_TreatmentNotes_ProgressStatus CHECK (ProgressStatus IN ('IN_PROGRESS', 'COMPLETED', 'FOLLOW_UP_REQUIRED'))
);
GO

CREATE TABLE TreatmentNoteAttachments (
    AttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    NoteId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileUrl NVARCHAR(500) NOT NULL,
    FileType NVARCHAR(50) NULL,
    AttachmentType NVARCHAR(30) NULL,
    UploadedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_TreatmentNoteAttachments_Notes FOREIGN KEY (NoteId) REFERENCES TreatmentNotes(NoteId) ON DELETE CASCADE
);
GO

CREATE TABLE TechnicianEarningGoals (
    GoalId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    MonthlyGoal DECIMAL(18,2) NOT NULL DEFAULT 8000000,
    Active BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_TechnicianEarningGoals_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT UQ_TechnicianEarningGoals_Employee UNIQUE (EmployeeId),
    CONSTRAINT CK_TechnicianEarningGoals_MonthlyGoal CHECK (MonthlyGoal >= 0)
);
GO

CREATE TABLE TechnicianPayoutRequests (
    PayoutRequestId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    Note NVARCHAR(MAX) NULL,
    RequestedAt DATETIME NOT NULL DEFAULT GETDATE(),
    ProcessedAt DATETIME NULL,
    ProcessedBy INT NULL,
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_TechnicianPayoutRequests_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT FK_TechnicianPayoutRequests_ProcessedBy FOREIGN KEY (ProcessedBy) REFERENCES Users(UserId),
    CONSTRAINT CK_TechnicianPayoutRequests_Status CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
    CONSTRAINT CK_TechnicianPayoutRequests_Amount CHECK (Amount >= 0)
);
GO

CREATE TABLE TechnicianPayoutLedger (
    LedgerId INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId INT NOT NULL,
    ReferenceType NVARCHAR(30) NOT NULL,
    ReferenceId INT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    EntryType NVARCHAR(20) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_TechnicianPayoutLedger_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
    CONSTRAINT CK_TechnicianPayoutLedger_EntryType CHECK (EntryType IN ('EARNING', 'PAYOUT', 'ADJUSTMENT'))
);
GO

/* =========================
   12. VIEWS
========================= */
CREATE VIEW vw_MonthlyRevenue AS
SELECT 
    YEAR(i.CreatedAt) AS RevenueYear,
    MONTH(i.CreatedAt) AS RevenueMonth,
    COUNT(i.InvoiceId) AS TotalInvoices,
    SUM(CASE WHEN i.Status IN ('PAID','REFUND_PENDING') THEN i.FinalAmount ELSE 0 END) AS TotalRevenue
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
LEFT JOIN Reviews r ON s.ServiceId = r.ServiceId AND r.Status = 'APPROVED'
GROUP BY s.ServiceId, s.ServiceName;
GO

CREATE VIEW vw_EmployeeRatings AS
SELECT
    e.EmployeeId,
    u.FullName,
    COUNT(r.ReviewId) AS ReviewCount,
    CAST(AVG(CAST(r.TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
FROM Employees e
JOIN Users u ON e.UserId = u.UserId
LEFT JOIN Reviews r ON e.EmployeeId = r.EmployeeId AND r.Status = 'APPROVED'
GROUP BY e.EmployeeId, u.FullName;
GO

CREATE VIEW vw_CustomerAppointments AS
SELECT
    a.AppointmentId,
    a.CustomerId,
    cu.FullName AS CustomerName,
    cu.Phone AS CustomerPhone,
    a.EmployeeId,
    eu.FullName AS EmployeeName,
    a.AppointmentDate,
    a.StartTime,
    a.EndTime,
    a.Status AS AppointmentStatus,
    i.InvoiceId,
    i.TotalAmount,
    i.DiscountAmount,
    i.FinalAmount,
    i.Status AS InvoiceStatus,
    p.PaymentId,
    p.Status AS PaymentStatus,
    p.PaymentMethod,
    rf.RefundId,
    rf.Status AS RefundStatus
FROM Appointments a
JOIN Customers c ON a.CustomerId = c.CustomerId
JOIN Users cu ON c.UserId = cu.UserId
JOIN Employees e ON a.EmployeeId = e.EmployeeId
JOIN Users eu ON e.UserId = eu.UserId
LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
OUTER APPLY (
    SELECT TOP 1 *
    FROM Payments p2
    WHERE p2.InvoiceId = i.InvoiceId
    ORDER BY p2.CreatedAt DESC, p2.PaymentId DESC
) p
OUTER APPLY (
    SELECT TOP 1 *
    FROM Refunds rf2
    WHERE rf2.PaymentId = p.PaymentId
    ORDER BY rf2.CreatedAt DESC, rf2.RefundId DESC
) rf;
GO

/* =========================================================
   13. BASE SEED DATA
========================================================= */

INSERT INTO Roles (RoleName) VALUES
('ADMIN'), ('MANAGER'), ('RECEPTIONIST'), ('TECHNICIAN'), ('CUSTOMER');
GO

INSERT INTO MembershipLevels (LevelName, MinPoints, DiscountPercent, Description) VALUES
(N'Normal', 0, 0, N'Khách hàng thường'),
(N'Silver', 100, 5, N'Giảm 5% cho khách hàng thân thiết'),
(N'Gold', 300, 10, N'Giảm 10% cho khách hàng VIP'),
(N'Diamond', 700, 15, N'Giảm 15% và ưu tiên đặt lịch');
GO

INSERT INTO Branches (BranchName, Address, Phone, Status) VALUES
(N'LUNA Beauty Salon - Đà Nẵng', N'123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', '0900000001', 'ACTIVE'),
(N'LUNA Beauty Salon - Hồ Chí Minh', N'88 Nguyễn Trãi, Quận 1, Hồ Chí Minh', '0900000002', 'ACTIVE'),
(N'LUNA Beauty Salon - Hà Nội', N'55 Trần Duy Hưng, Cầu Giấy, Hà Nội', '0900000003', 'ACTIVE');
GO

INSERT INTO ServiceCategories (CategoryName, Description, ImageUrl) VALUES
(N'Massage', N'Dịch vụ massage thư giãn và trị liệu body', '/images/categories/massage.png'),
(N'Nail', N'Dịch vụ làm móng, chăm sóc móng cao cấp', '/images/categories/nail.png'),
(N'Hair', N'Dịch vụ tóc: cắt, nhuộm, uốn, phục hồi', '/images/categories/hair.png'),
(N'Skincare', N'Chăm sóc da mặt, phục hồi và trẻ hóa da', '/images/categories/skincare.png'),
(N'Detox', N'Giảm béo, thải độc và chăm sóc body', '/images/categories/detox.png'),
(N'Spa Combo', N'Combo làm đẹp tổng hợp', '/images/categories/combo.png');
GO

INSERT INTO Services (CategoryId, ServiceName, Description, DurationMinutes, Price, ImageUrl, Status) VALUES
(1, N'Massage thư giãn toàn thân', N'Massage toàn thân giúp thư giãn, giảm căng thẳng.', 60, 300000, '/images/services/massage-relax.png', 'AVAILABLE'),
(1, N'Massage đá nóng', N'Trị liệu đá nóng giúp lưu thông máu và giảm đau mỏi.', 75, 450000, '/images/services/hot-stone.png', 'AVAILABLE'),
(1, N'Massage cổ vai gáy', N'Tập trung giảm đau vùng cổ, vai và gáy.', 45, 250000, '/images/services/neck-shoulder.png', 'AVAILABLE'),
(2, N'Nail cao cấp', N'Làm móng gel cao cấp, bền màu.', 45, 250000, '/images/services/nail-premium.png', 'AVAILABLE'),
(2, N'Sơn gel Hàn Quốc', N'Sơn gel màu Hàn Quốc, bóng đẹp tự nhiên.', 40, 180000, '/images/services/korean-gel.png', 'AVAILABLE'),
(2, N'Chăm sóc móng tay chân', N'Làm sạch, dưỡng móng và chăm sóc da tay chân.', 50, 220000, '/images/services/nail-care.png', 'AVAILABLE'),
(3, N'Cắt & tạo kiểu tóc', N'Cắt và tạo kiểu tóc theo khuôn mặt.', 45, 200000, '/images/services/hair-cut.png', 'AVAILABLE'),
(3, N'Nhuộm tóc thời trang', N'Nhuộm tóc theo xu hướng hiện đại.', 120, 700000, '/images/services/hair-color.png', 'AVAILABLE'),
(3, N'Uốn tóc setting', N'Uốn tóc giữ nếp lâu, phù hợp nhiều phong cách.', 150, 850000, '/images/services/hair-curl.png', 'AVAILABLE'),
(3, N'Phục hồi tóc hư tổn', N'Phục hồi tóc khô xơ do hóa chất.', 90, 500000, '/images/services/hair-repair.png', 'AVAILABLE'),
(4, N'Chăm sóc da mặt cơ bản', N'Làm sạch, cấp ẩm và thư giãn da mặt.', 60, 350000, '/images/services/skincare-basic.png', 'AVAILABLE'),
(4, N'Trị mụn chuyên sâu', N'Điều trị mụn, giảm viêm và phục hồi da.', 75, 650000, '/images/services/acne-care.png', 'AVAILABLE'),
(4, N'Trẻ hóa da', N'Nâng cơ, cải thiện độ đàn hồi và giảm nếp nhăn.', 90, 900000, '/images/services/anti-aging.png', 'AVAILABLE'),
(4, N'Cấy tinh chất phục hồi', N'Cấp dưỡng chất chuyên sâu cho làn da yếu.', 80, 750000, '/images/services/skin-booster.png', 'AVAILABLE'),
(5, N'Detox body', N'Liệu trình thải độc và giảm mỡ body.', 90, 800000, '/images/services/detox-body.png', 'AVAILABLE'),
(5, N'Giảm béo bụng', N'Liệu trình giảm mỡ vùng bụng.', 90, 950000, '/images/services/slim-belly.png', 'AVAILABLE'),
(6, N'Combo tóc và nail', N'Làm đẹp tóc kết hợp chăm sóc móng.', 150, 900000, '/images/services/hair-nail-combo.png', 'AVAILABLE'),
(6, N'Combo thư giãn cuối tuần', N'Massage body kết hợp chăm sóc da mặt.', 120, 850000, '/images/services/weekend-combo.png', 'AVAILABLE');
GO

INSERT INTO ServiceResources (BranchId, ResourceName, ResourceType, Status) VALUES
(1, N'Phòng Massage 01', N'ROOM', 'AVAILABLE'),
(1, N'Phòng Massage 02', N'ROOM', 'AVAILABLE'),
(1, N'Ghế Nail 01', N'CHAIR', 'AVAILABLE'),
(1, N'Ghế Làm Tóc 01', N'CHAIR', 'AVAILABLE'),
(1, N'Phòng Chăm Sóc Da 01', N'ROOM', 'AVAILABLE'),
(1, N'Phòng Detox 01', N'ROOM', 'AVAILABLE'),
(2, N'Phòng Massage 03', N'ROOM', 'AVAILABLE'),
(2, N'Ghế Nail 02', N'CHAIR', 'AVAILABLE'),
(2, N'Ghế Làm Tóc 02', N'CHAIR', 'AVAILABLE'),
(2, N'Phòng Chăm Sóc Da 02', N'ROOM', 'AVAILABLE'),
(3, N'Phòng Massage 04', N'ROOM', 'AVAILABLE'),
(3, N'Ghế Nail 03', N'CHAIR', 'AVAILABLE'),
(3, N'Ghế Làm Tóc 03', N'CHAIR', 'AVAILABLE'),
(3, N'Phòng Chăm Sóc Da 03', N'ROOM', 'AVAILABLE');
GO

/* Main login accounts */
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified) VALUES
(N'Admin Salon', 'admin@salon.com', '0909999999', '123456', 1, '/images/avatars/admin.png', 'ACTIVE', 1),
(N'Manager Salon', 'manager@salon.com', '0909999998', '123456', 2, '/images/avatars/manager.png', 'ACTIVE', 1),
(N'Lễ tân Test', 'receptionist@salon.com', '0901234567', '123456', 3, '/images/avatars/receptionist.png', 'ACTIVE', 1),
(N'Linh Nguyen', 'technician@salon.com', '0907777777', '123456', 4, '/images/technicians/test.png', 'ACTIVE', 1),
(N'Nguyễn Gia Kiên', 'customer@salon.com', '0908888888', '123456', 5, '/images/avatars/customer.png', 'ACTIVE', 1);
GO

INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
VALUES ((SELECT UserId FROM Users WHERE Email = 'customer@salon.com'), N'Nam', '2004-01-01', N'Đà Nẵng', 520, 3);
GO

/* Extra receptionists */
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified) VALUES
(N'Lễ tân Mai Anh', 'receptionist1@salon.com', '0901234501', '123456', 3, '/images/avatars/receptionist-1.png', 'ACTIVE', 1),
(N'Lễ tân Hoài Thương', 'receptionist2@salon.com', '0901234502', '123456', 3, '/images/avatars/receptionist-2.png', 'ACTIVE', 1),
(N'Lễ tân Bảo Ngọc', 'receptionist3@salon.com', '0901234503', '123456', 3, '/images/avatars/receptionist-3.png', 'ACTIVE', 1);
GO

/* Technicians */
INSERT INTO Users (FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified) VALUES
(N'Linh Chi', 'linhchi@salon.com', '0911111111', '123456', 4, '/images/technicians/1.png', 'ACTIVE', 1),
(N'Minh Anh', 'minhanh@salon.com', '0922222222', '123456', 4, '/images/technicians/2.png', 'ACTIVE', 1),
(N'Thảo Vy', 'thaovy@salon.com', '0933333333', '123456', 4, '/images/technicians/3.png', 'ACTIVE', 1),
(N'Quốc Bảo', 'quocbao@salon.com', '0944444444', '123456', 4, '/images/technicians/4.png', 'ACTIVE', 1),
(N'Ngọc Hân', 'ngochan@salon.com', '0955555555', '123456', 4, '/images/technicians/5.png', 'ACTIVE', 1),
(N'Tuấn Kiệt', 'tuankiet@salon.com', '0966666666', '123456', 4, '/images/technicians/6.png', 'ACTIVE', 1),
(N'Bảo Trâm', 'baotram@salon.com', '0977777777', '123456', 4, '/images/technicians/7.png', 'ACTIVE', 1),
(N'Hoàng Nam', 'hoangnam@salon.com', '0988888888', '123456', 4, '/images/technicians/8.png', 'ACTIVE', 1),
(N'Thanh Tâm', 'thanhtam@salon.com', '0999999999', '123456', 4, '/images/technicians/9.png', 'ACTIVE', 1);
GO

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 1, N'Senior Technician', N'Hair, Skincare, Massage', 12000000, '2020-01-10', 5, N'Kỹ thuật viên test chính cho dashboard technician.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'technician@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 1, N'Kỹ thuật viên Massage', N'Massage, Detox', 9000000, '2020-01-10', 5, N'Chuyên viên massage và detox body.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'linhchi@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 1, N'Kỹ thuật viên Nail', N'Nail', 8500000, '2021-03-15', 4, N'Chuyên viên nail cao cấp.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'minhanh@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 2, N'Tạo mẫu tóc', N'Hair Styling', 11000000, '2019-06-20', 6, N'Chuyên viên tạo mẫu tóc.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'thaovy@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 2, N'Tạo mẫu tóc', N'Hair Styling, Skincare', 10000000, '2022-02-01', 3, N'Tạo mẫu tóc và chăm sóc da.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'quocbao@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 2, N'Chuyên viên Skincare', N'Skincare, Acne Treatment', 10500000, '2020-09-05', 5, N'Chuyên viên chăm sóc da và trị mụn.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'ngochan@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 3, N'Chuyên viên Body', N'Detox, Slim Body', 11500000, '2018-11-12', 7, N'Chuyên viên giảm béo và detox.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'tuankiet@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 3, N'Kỹ thuật viên Nail', N'Nail, Combo', 8200000, '2023-02-20', 2, N'Kỹ thuật viên nail và combo làm đẹp.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'baotram@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 3, N'Barber / Hair Stylist', N'Hair Styling, Hair Color', 10800000, '2021-07-18', 4, N'Chuyên viên tóc nam nữ.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'hoangnam@salon.com';

INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
SELECT UserId, 1, N'Chuyên viên Skincare', N'Skincare, Anti Aging', 11200000, '2019-04-22', 6, N'Chuyên viên trẻ hóa da.', AvatarUrl, 'ACTIVE'
FROM Users WHERE Email = 'thanhtam@salon.com';
GO

/* Map service to employee */
INSERT INTO EmployeeServices (EmployeeId, ServiceId)
SELECT e.EmployeeId, s.ServiceId
FROM Employees e
JOIN Services s ON
    (e.Specialization LIKE N'%Massage%' AND s.CategoryId = 1)
 OR (e.Specialization LIKE N'%Detox%' AND s.CategoryId = 5)
 OR (e.Specialization LIKE N'%Nail%' AND s.CategoryId = 2)
 OR (e.Specialization LIKE N'%Hair%' AND s.CategoryId = 3)
 OR (e.Specialization LIKE N'%Skincare%' AND s.CategoryId = 4)
 OR (e.Specialization LIKE N'%Anti Aging%' AND s.ServiceName LIKE N'%Trẻ hóa%')
 OR (e.Specialization LIKE N'%Acne%' AND s.ServiceName LIKE N'%mụn%')
 OR (s.CategoryId = 6);
GO

INSERT INTO TechnicianEarningGoals (EmployeeId, MonthlyGoal)
SELECT EmployeeId, 8000000 + EmployeeId * 500000
FROM Employees;
GO

/* Promotions / vouchers */
INSERT INTO Promotions (Title, Description, DiscountPercent, ImageUrl, StartDate, EndDate, Status) VALUES
(N'Ưu đãi khai trương', N'Giảm giá cho khách hàng mới.', 10, '/images/promotions/promo-1.png', DATEADD(DAY,-30,CAST(GETDATE() AS DATE)), DATEADD(DAY,30,CAST(GETDATE() AS DATE)), 'ACTIVE'),
(N'Combo hè rạng rỡ', N'Ưu đãi liệu trình chăm sóc da mùa hè.', 15, '/images/promotions/promo-2.png', DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,60,CAST(GETDATE() AS DATE)), 'ACTIVE'),
(N'Tri ân khách hàng thân thiết', N'Ưu đãi cho khách hàng Gold và Diamond.', 20, '/images/promotions/promo-3.png', DATEADD(DAY,-5,CAST(GETDATE() AS DATE)), DATEADD(DAY,90,CAST(GETDATE() AS DATE)), 'ACTIVE'),
(N'Ưu đãi cuối tuần', N'Giảm giá dịch vụ massage cuối tuần.', 12, '/images/promotions/promo-4.png', DATEADD(DAY,-20,CAST(GETDATE() AS DATE)), DATEADD(DAY,20,CAST(GETDATE() AS DATE)), 'ACTIVE');
GO

INSERT INTO ServicePromotions (ServiceId, PromotionId)
SELECT ServiceId, 1 FROM Services WHERE ServiceId IN (1, 4, 7, 11)
UNION ALL SELECT ServiceId, 2 FROM Services WHERE ServiceId IN (11, 12, 13, 14)
UNION ALL SELECT ServiceId, 3 FROM Services WHERE ServiceId IN (13, 15, 16)
UNION ALL SELECT ServiceId, 4 FROM Services WHERE ServiceId IN (1, 2, 3, 18);
GO

INSERT INTO Vouchers (Code, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount, StartDate, EndDate, Quantity, Status) VALUES
('WELCOME10', 'PERCENT', 10, 0, 100000, DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,60,CAST(GETDATE() AS DATE)), 500, 'ACTIVE'),
('SALE50000', 'AMOUNT', 50000, 200000, NULL, DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,60,CAST(GETDATE() AS DATE)), 300, 'ACTIVE'),
('VIP15', 'PERCENT', 15, 500000, 200000, DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,90,CAST(GETDATE() AS DATE)), 200, 'ACTIVE'),
('BEAUTY100K', 'AMOUNT', 100000, 800000, NULL, DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,60,CAST(GETDATE() AS DATE)), 150, 'ACTIVE'),
('DIAMOND20', 'PERCENT', 20, 1000000, 300000, DATEADD(DAY,-10,CAST(GETDATE() AS DATE)), DATEADD(DAY,120,CAST(GETDATE() AS DATE)), 100, 'ACTIVE');
GO

/* Packages */
INSERT INTO PackageCategories (CategoryName, Description) VALUES
(N'Chăm sóc da mặt', N'Combo chăm sóc và phục hồi da'),
(N'Trị mụn', N'Liệu trình trị mụn chuyên sâu'),
(N'Trẻ hóa', N'Liệu trình trẻ hóa da'),
(N'Body', N'Giảm béo, detox và thư giãn body'),
(N'Tóc và Nail', N'Combo làm đẹp tóc và móng'),
(N'Thư giãn', N'Combo thư giãn toàn thân');
GO

INSERT INTO Packages (PackageCategoryId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, ValidityDays, ImageUrl, IsHot, Status) VALUES
(1, N'Liệu trình căng bóng phục hồi chuyên sâu', N'Cấp ẩm sâu, phục hồi da hư tổn.', 5000000, 4000000, 5, 60, '/images/packages/glow-skin.png', 1, 'ACTIVE'),
(2, N'Liệu trình trị mụn chuẩn y khoa', N'Điều trị mụn và phục hồi da.', 7000000, 5950000, 8, 90, '/images/packages/acne-package.png', 1, 'ACTIVE'),
(4, N'Combo giảm béo slim body', N'Giảm mỡ, săn chắc và detox.', 8000000, 7200000, 10, 120, '/images/packages/slim-body.png', 0, 'ACTIVE'),
(3, N'Liệu trình trẻ hóa nâng cơ toàn diện', N'Nâng cơ, giảm nếp nhăn.', 12000000, 9000000, 6, 90, '/images/packages/anti-aging-package.png', 1, 'ACTIVE'),
(5, N'Combo làm đẹp tóc và nail', N'Làm tóc kết hợp nail cao cấp.', 1200000, 950000, 3, 45, '/images/packages/hair-nail.png', 0, 'ACTIVE'),
(6, N'Gói thư giãn cuối tuần', N'Massage và chăm sóc da nhẹ nhàng.', 2500000, 1990000, 4, 60, '/images/packages/relax-weekend.png', 1, 'ACTIVE');
GO

INSERT INTO PackageServices (PackageId, ServiceId, SessionCount) VALUES
(1, 11, 3), (1, 14, 2),
(2, 12, 8),
(3, 15, 5), (3, 16, 5),
(4, 13, 6),
(5, 4, 1), (5, 7, 1), (5, 8, 1),
(6, 1, 2), (6, 11, 2);
GO

/* =========================================================
   14. LARGE TEST DATA
========================================================= */

DECLARE @i INT;
DECLARE @UserId INT;
DECLARE @CustomerId INT;
DECLARE @AppointmentId INT;
DECLARE @InvoiceId INT;
DECLARE @PaymentId INT;
DECLARE @ServiceId INT;
DECLARE @EmployeeId INT;
DECLARE @BranchId INT;
DECLARE @Total DECIMAL(18,2);
DECLARE @Discount DECIMAL(18,2);
DECLARE @Final DECIMAL(18,2);
DECLARE @Status NVARCHAR(30);
DECLARE @PaymentStatus NVARCHAR(20);
DECLARE @CreatedDate DATETIME;
DECLARE @AppointmentDate DATE;
DECLARE @StartTime TIME;
DECLARE @EndTime TIME;
DECLARE @Random INT;

/* 80 Customers */
SET @i = 1;
WHILE @i <= 80
BEGIN
    INSERT INTO Users
    (
        FullName, Email, Phone, PasswordHash, RoleId, AvatarUrl, Status, IsVerified, CreatedAt
    )
    VALUES
    (
        CONCAT(N'Khách hàng ', FORMAT(@i, '00')),
        CONCAT('customer', FORMAT(@i, '00'), '@gmail.com'),
        CONCAT('091', FORMAT(@i, '0000000')),
        '123456',
        5,
        CONCAT('/images/avatars/customer-', ((@i - 1) % 12) + 1, '.png'),
        CASE WHEN @i % 25 = 0 THEN 'INACTIVE' ELSE 'ACTIVE' END,
        1,
        DATEADD(DAY, -@i, GETDATE())
    );

    SET @UserId = SCOPE_IDENTITY();

    INSERT INTO Customers
    (
        UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId, CreatedAt
    )
    VALUES
    (
        @UserId,
        CASE WHEN @i % 2 = 0 THEN N'Nữ' ELSE N'Nam' END,
        DATEADD(YEAR, -18 - (@i % 25), CAST(GETDATE() AS DATE)),
        CASE @i % 5
            WHEN 0 THEN N'Đà Nẵng'
            WHEN 1 THEN N'Hồ Chí Minh'
            WHEN 2 THEN N'Hà Nội'
            WHEN 3 THEN N'Huế'
            ELSE N'Quảng Nam'
        END,
        (@i * 37) % 1000,
        CASE
            WHEN (@i * 37) % 1000 >= 700 THEN 4
            WHEN (@i * 37) % 1000 >= 300 THEN 3
            WHEN (@i * 37) % 1000 >= 100 THEN 2
            ELSE 1
        END,
        DATEADD(DAY, -@i, GETDATE())
    );

    SET @i += 1;
END
GO

/* Pending users */
INSERT INTO PendingUsers (FullName, Email, Phone, PasswordHash, Gender, DateOfBirth, Address, VerifyCode, VerifyCodeExpires)
VALUES
(N'User Chờ Xác Minh 1', 'pending1@gmail.com', '0880000001', '123456', N'Nữ', '2003-01-01', N'Đà Nẵng', '111111', DATEADD(MINUTE, 10, GETDATE())),
(N'User Chờ Xác Minh 2', 'pending2@gmail.com', '0880000002', '123456', N'Nam', '2002-02-02', N'Hà Nội', '222222', DATEADD(MINUTE, 10, GETDATE())),
(N'User Chờ Xác Minh 3', 'pending3@gmail.com', '0880000003', '123456', N'Nữ', '2001-03-03', N'Hồ Chí Minh', '333333', DATEADD(MINUTE, 10, GETDATE()));
GO

/* Work shifts for 45 days around today */
DECLARE @d INT = -15;
WHILE @d <= 30
BEGIN
    INSERT INTO WorkShifts (EmployeeId, ShiftDate, StartTime, EndTime, ShiftType, IsDayOff, Notes)
    SELECT
        EmployeeId,
        DATEADD(DAY, @d, CAST(GETDATE() AS DATE)),
        CASE WHEN EmployeeId % 3 = 0 THEN '13:00' ELSE '08:00' END,
        CASE WHEN EmployeeId % 3 = 0 THEN '21:00' ELSE '17:00' END,
        CASE WHEN EmployeeId % 3 = 0 THEN N'Ca chiều' ELSE N'Ca ngày' END,
        CASE WHEN DATEPART(WEEKDAY, DATEADD(DAY, @d, CAST(GETDATE() AS DATE))) = 1 AND EmployeeId % 2 = 0 THEN 1 ELSE 0 END,
        N'Lịch làm việc demo'
    FROM Employees;

    SET @d += 1;
END
GO

/* Customer vouchers */
INSERT INTO CustomerVouchers (CustomerId, VoucherId, UsedStatus, UsedAt)
SELECT c.CustomerId, v.VoucherId,
       CASE WHEN (c.CustomerId + v.VoucherId) % 9 = 0 THEN 1 ELSE 0 END,
       CASE WHEN (c.CustomerId + v.VoucherId) % 9 = 0 THEN DATEADD(DAY, -c.CustomerId % 20, GETDATE()) ELSE NULL END
FROM Customers c
CROSS JOIN Vouchers v
WHERE c.CustomerId <= 45;
GO

/* Customer packages */
DECLARE @cp INT = 1;
WHILE @cp <= 45
BEGIN
    DECLARE @CId INT = ((@cp - 1) % (SELECT COUNT(*) FROM Customers)) + 1;
    DECLARE @PId INT = ((@cp - 1) % (SELECT COUNT(*) FROM Packages)) + 1;
    DECLARE @Sessions INT = (SELECT TotalSessions FROM Packages WHERE PackageId = @PId);
    DECLARE @Used INT = @cp % @Sessions;
    DECLARE @PkgAmount DECIMAL(18,2) = (SELECT SalePrice FROM Packages WHERE PackageId = @PId);

    INSERT INTO CustomerPackages
    (CustomerId, PackageId, StartDate, EndDate, TotalSessions, UsedSessions, RemainingSessions, Status, CreatedAt)
    VALUES
    (
        @CId,
        @PId,
        DATEADD(DAY, -@cp, CAST(GETDATE() AS DATE)),
        DATEADD(DAY, 60 + @cp, CAST(GETDATE() AS DATE)),
        @Sessions,
        @Used,
        @Sessions - @Used,
        CASE WHEN @cp % 8 = 0 THEN 'USED_UP' WHEN @cp % 10 = 0 THEN 'EXPIRED' ELSE 'ACTIVE' END,
        DATEADD(DAY, -@cp, GETDATE())
    );

    INSERT INTO PackagePayments
    (CustomerPackageId, Amount, PaymentMethod, Status, TransactionCode, VnpTxnRef, VnpTransactionNo, VnpResponseCode, PaidAt, CreatedAt)
    VALUES
    (
        SCOPE_IDENTITY(),
        @PkgAmount,
        CASE WHEN @cp % 2 = 0 THEN 'VNPAY' ELSE 'CASH' END,
        CASE WHEN @cp % 12 = 0 THEN 'FAILED' ELSE 'PAID' END,
        CONCAT('PKG-', FORMAT(@cp, '0000')),
        CONCAT('VNP-PKG-', FORMAT(@cp, '0000')),
        CONCAT('VNPTRX-PKG-', FORMAT(@cp, '0000')),
        CASE WHEN @cp % 12 = 0 THEN '24' ELSE '00' END,
        CASE WHEN @cp % 12 = 0 THEN NULL ELSE DATEADD(DAY, -@cp, GETDATE()) END,
        DATEADD(DAY, -@cp, GETDATE())
    );

    SET @cp += 1;
END
GO

/* 420 Appointments with invoice/payment/history */
DECLARE @i2 INT = 1;
WHILE @i2 <= 420
BEGIN
    SET @CustomerId = ((@i2 - 1) % (SELECT COUNT(*) FROM Customers)) + 1;
    SET @EmployeeId = ((@i2 - 1) % (SELECT COUNT(*) FROM Employees)) + 1;
    SET @BranchId = (SELECT ISNULL(BranchId,1) FROM Employees WHERE EmployeeId = @EmployeeId);
    SET @ServiceId = (
        SELECT TOP 1 ServiceId
        FROM EmployeeServices
        WHERE EmployeeId = @EmployeeId
        ORDER BY NEWID()
    );

    IF @ServiceId IS NULL
        SET @ServiceId = ((@i2 - 1) % (SELECT COUNT(*) FROM Services)) + 1;

    SET @Total = (SELECT Price FROM Services WHERE ServiceId = @ServiceId);
    SET @Discount = CASE WHEN @i2 % 7 = 0 THEN @Total * 0.1 WHEN @i2 % 11 = 0 THEN 50000 ELSE 0 END;
    IF @Discount > @Total SET @Discount = 0;
    SET @Final = @Total - @Discount;

    SET @Random = @i2 % 10;

    SET @Status =
        CASE @Random
            WHEN 0 THEN 'PENDING_PAYMENT'
            WHEN 1 THEN 'CONFIRMED'
            WHEN 2 THEN 'CHECKED_IN'
            WHEN 3 THEN 'IN_PROGRESS'
            WHEN 4 THEN 'COMPLETED'
            WHEN 5 THEN 'COMPLETED'
            WHEN 6 THEN 'COMPLETED'
            WHEN 7 THEN 'CANCELLED'
            WHEN 8 THEN 'REFUND_PENDING'
            ELSE 'NO_SHOW'
        END;

    SET @PaymentStatus =
        CASE
            WHEN @Status = 'PENDING_PAYMENT' THEN 'PENDING'
            WHEN @Status = 'CANCELLED' AND @i2 % 2 = 0 THEN 'FAILED'
            WHEN @Status = 'REFUND_PENDING' THEN 'REFUND_PENDING'
            WHEN @Status IN ('CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED','NO_SHOW') THEN 'PAID'
            ELSE 'PENDING'
        END;

    SET @AppointmentDate =
        CASE
            WHEN @Status IN ('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','IN_PROGRESS') THEN DATEADD(DAY, @i2 % 21, CAST(GETDATE() AS DATE))
            ELSE DATEADD(DAY, -(@i2 % 120), CAST(GETDATE() AS DATE))
        END;

    SET @StartTime =
        CASE @i2 % 8
            WHEN 0 THEN '08:00'
            WHEN 1 THEN '09:00'
            WHEN 2 THEN '10:00'
            WHEN 3 THEN '11:00'
            WHEN 4 THEN '13:00'
            WHEN 5 THEN '14:00'
            WHEN 6 THEN '15:00'
            ELSE '16:00'
        END;

    SET @EndTime = DATEADD(MINUTE, (SELECT DurationMinutes FROM Services WHERE ServiceId = @ServiceId), CAST(@StartTime AS DATETIME));
    SET @CreatedDate = DATEADD(DAY, -(@i2 % 150), GETDATE());

    INSERT INTO Appointments
    (
        CustomerId, EmployeeId, BranchId, ResourceId, AppointmentDate, StartTime, EndTime,
        Status, Notes, CancelReason, CheckedInAt, CheckedOutAt, CompletedAt, CreatedAt, UpdatedAt
    )
    VALUES
    (
        @CustomerId,
        @EmployeeId,
        @BranchId,
        ((@i2 - 1) % (SELECT COUNT(*) FROM ServiceResources)) + 1,
        @AppointmentDate,
        @StartTime,
        @EndTime,
        @Status,
        CONCAT(N'Lịch hẹn demo số ', @i2),
        CASE WHEN @Status IN ('CANCELLED','REFUND_PENDING') THEN N'Khách bận việc cá nhân' ELSE NULL END,
        CASE WHEN @Status IN ('CHECKED_IN','IN_PROGRESS','COMPLETED') THEN DATEADD(MINUTE, -10, CAST(CAST(@AppointmentDate AS DATETIME) + CAST(@StartTime AS DATETIME) AS DATETIME)) ELSE NULL END,
        CASE WHEN @Status = 'COMPLETED' THEN DATEADD(MINUTE, (SELECT DurationMinutes FROM Services WHERE ServiceId = @ServiceId), CAST(CAST(@AppointmentDate AS DATETIME) + CAST(@StartTime AS DATETIME) AS DATETIME)) ELSE NULL END,
        CASE WHEN @Status = 'COMPLETED' THEN DATEADD(MINUTE, (SELECT DurationMinutes FROM Services WHERE ServiceId = @ServiceId), CAST(CAST(@AppointmentDate AS DATETIME) + CAST(@StartTime AS DATETIME) AS DATETIME)) ELSE NULL END,
        @CreatedDate,
        DATEADD(HOUR, 2, @CreatedDate)
    );

    SET @AppointmentId = SCOPE_IDENTITY();

    INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price)
    VALUES (@AppointmentId, @ServiceId, @Total);

    /* add second service sometimes */
    IF @i2 % 9 = 0
    BEGIN
        DECLARE @ServiceId2 INT = (
            SELECT TOP 1 ServiceId
            FROM Services
            WHERE ServiceId <> @ServiceId
            ORDER BY NEWID()
        );

        INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price)
        SELECT @AppointmentId, @ServiceId2, Price
        FROM Services
        WHERE ServiceId = @ServiceId2;

        SET @Total = @Total + (SELECT Price FROM Services WHERE ServiceId = @ServiceId2);
        SET @Final = @Total - @Discount;
    END

    INSERT INTO Invoices
    (
        AppointmentId, VoucherId, TotalAmount, DiscountAmount, FinalAmount, Status,
        TechnicianCommissionRate, TechnicianCommissionAmount, TechnicianTipAmount,
        CreatedAt, UpdatedAt
    )
    VALUES
    (
        @AppointmentId,
        CASE WHEN @Discount > 0 THEN ((@i2 - 1) % (SELECT COUNT(*) FROM Vouchers)) + 1 ELSE NULL END,
        @Total,
        @Discount,
        @Final,
        CASE
            WHEN @PaymentStatus = 'PAID' THEN 'PAID'
            WHEN @PaymentStatus = 'REFUND_PENDING' THEN 'REFUND_PENDING'
            WHEN @Status = 'CANCELLED' THEN 'CANCELLED'
            ELSE 'UNPAID'
        END,
        30,
        CASE WHEN @PaymentStatus IN ('PAID','REFUND_PENDING') THEN @Final * 0.3 ELSE 0 END,
        CASE WHEN @i2 % 13 = 0 THEN 50000 ELSE 0 END,
        @CreatedDate,
        DATEADD(HOUR, 1, @CreatedDate)
    );

    SET @InvoiceId = SCOPE_IDENTITY();

    INSERT INTO Payments
    (
        InvoiceId, Amount, PaymentMethod, Status, TransactionCode,
        VnpTxnRef, VnpTransactionNo, VnpResponseCode, PaidAt, CreatedAt
    )
    VALUES
    (
        @InvoiceId,
        @Final,
        CASE WHEN @i2 % 3 = 0 THEN 'CASH' WHEN @i2 % 3 = 1 THEN 'VNPAY' ELSE 'CARD' END,
        @PaymentStatus,
        CONCAT('PAY-', FORMAT(@i2, '000000')),
        CONCAT('VNP-', FORMAT(@i2, '000000')),
        CONCAT('VNPTRX-', FORMAT(@i2, '000000')),
        CASE WHEN @PaymentStatus IN ('PAID','REFUND_PENDING') THEN '00' WHEN @PaymentStatus = 'FAILED' THEN '24' ELSE NULL END,
        CASE WHEN @PaymentStatus IN ('PAID','REFUND_PENDING') THEN DATEADD(MINUTE, 5, @CreatedDate) ELSE NULL END,
        @CreatedDate
    );

    SET @PaymentId = SCOPE_IDENTITY();

    INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    VALUES (@AppointmentId, NULL, 'PENDING_PAYMENT', (SELECT TOP 1 UserId FROM Users WHERE RoleId = 5 ORDER BY NEWID()), N'Khách tạo lịch', @CreatedDate);

    IF @PaymentStatus IN ('PAID','REFUND_PENDING')
    BEGIN
        INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES (@AppointmentId, 'PENDING_PAYMENT', 'PAID', (SELECT TOP 1 UserId FROM Users WHERE RoleId = 5 ORDER BY NEWID()), N'Đã thanh toán', DATEADD(MINUTE, 5, @CreatedDate));
    END

    IF @Status <> 'PENDING_PAYMENT' AND @Status <> 'PAID'
    BEGIN
        INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
        VALUES (@AppointmentId, CASE WHEN @PaymentStatus IN ('PAID','REFUND_PENDING') THEN 'PAID' ELSE 'PENDING_PAYMENT' END, @Status, (SELECT TOP 1 UserId FROM Users WHERE RoleId IN (1,3) ORDER BY NEWID()), N'Cập nhật trạng thái demo', DATEADD(HOUR, 1, @CreatedDate));
    END

    IF @Status = 'REFUND_PENDING'
    BEGIN
        INSERT INTO Refunds (PaymentId, RefundAmount, Reason, Status, CreatedAt)
        VALUES (@PaymentId, @Final, N'Khách hủy lịch đã thanh toán', CASE WHEN @i2 % 4 = 0 THEN 'APPROVED' ELSE 'PENDING' END, DATEADD(HOUR, 2, @CreatedDate));
    END

    IF @PaymentStatus = 'PAID'
    BEGIN
        INSERT INTO TechnicianPayoutLedger (EmployeeId, ReferenceType, ReferenceId, Amount, EntryType, Description, CreatedAt)
        VALUES (@EmployeeId, 'INVOICE', @InvoiceId, @Final * 0.3, 'EARNING', N'Hoa hồng từ lịch hẹn', DATEADD(HOUR, 2, @CreatedDate));
    END

    SET @i2 += 1;
END
GO

/* Reviews for completed appointments */
INSERT INTO Reviews
(
    CustomerId, AppointmentId, ServiceId, EmployeeId, Rating, TechnicianRating,
    Comment, Status, AdminResponse, CreatedAt
)
SELECT TOP 220
    a.CustomerId,
    a.AppointmentId,
    aps.ServiceId,
    a.EmployeeId,
    3 + (a.AppointmentId % 3),
    3 + ((a.AppointmentId + 1) % 3),
    CASE a.AppointmentId % 5
        WHEN 0 THEN N'Dịch vụ rất tốt, nhân viên nhiệt tình.'
        WHEN 1 THEN N'Không gian đẹp, trải nghiệm dễ chịu.'
        WHEN 2 THEN N'Tôi hài lòng với chất lượng dịch vụ.'
        WHEN 3 THEN N'Thời gian phục vụ đúng lịch, kỹ thuật viên chuyên nghiệp.'
        ELSE N'Sẽ quay lại lần sau.'
    END,
    CASE WHEN a.AppointmentId % 20 = 0 THEN 'PENDING' WHEN a.AppointmentId % 33 = 0 THEN 'HIDDEN' ELSE 'APPROVED' END,
    CASE WHEN a.AppointmentId % 8 = 0 THEN N'Cảm ơn quý khách đã đánh giá.' ELSE NULL END,
    DATEADD(DAY, 1, a.CompletedAt)
FROM Appointments a
JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
WHERE a.Status = 'COMPLETED'
ORDER BY a.AppointmentId DESC;
GO

INSERT INTO ReviewImages (ReviewId, ImageUrl)
SELECT TOP 80 ReviewId, CONCAT('/images/reviews/review-', ((ReviewId - 1) % 10) + 1, '.png')
FROM Reviews
WHERE ReviewId % 2 = 0;
GO

/* Feedbacks */
DECLARE @fb INT = 1;
WHILE @fb <= 90
BEGIN
    INSERT INTO Feedbacks (CustomerId, Subject, Content, Status, AdminResponse, CreatedAt, UpdatedAt)
    VALUES
    (
        ((@fb - 1) % (SELECT COUNT(*) FROM Customers)) + 1,
        CASE @fb % 5
            WHEN 0 THEN N'Góp ý về đặt lịch'
            WHEN 1 THEN N'Phản hồi về dịch vụ'
            WHEN 2 THEN N'Yêu cầu hỗ trợ thanh toán'
            WHEN 3 THEN N'Góp ý về kỹ thuật viên'
            ELSE N'Tư vấn thêm dịch vụ'
        END,
        CONCAT(N'Nội dung phản hồi demo số ', @fb, N'. Tôi muốn salon kiểm tra và hỗ trợ thêm.'),
        CASE @fb % 4
            WHEN 0 THEN 'PENDING'
            WHEN 1 THEN 'PROCESSING'
            WHEN 2 THEN 'RESOLVED'
            ELSE 'REJECTED'
        END,
        CASE WHEN @fb % 4 IN (2,3) THEN N'Cảm ơn quý khách, salon đã tiếp nhận và xử lý.' ELSE NULL END,
        DATEADD(DAY, -(@fb % 60), GETDATE()),
        CASE WHEN @fb % 4 IN (2,3) THEN DATEADD(DAY, -(@fb % 50), GETDATE()) ELSE NULL END
    );

    SET @fb += 1;
END
GO

/* Waiting list */
DECLARE @wl INT = 1;
WHILE @wl <= 50
BEGIN
    INSERT INTO WaitingList (CustomerId, ServiceId, PreferredDate, PreferredTime, Status, CreatedAt, UpdatedAt)
    VALUES
    (
        ((@wl - 1) % (SELECT COUNT(*) FROM Customers)) + 1,
        ((@wl - 1) % (SELECT COUNT(*) FROM Services)) + 1,
        DATEADD(DAY, @wl % 20, CAST(GETDATE() AS DATE)),
        CASE @wl % 5 WHEN 0 THEN '09:00' WHEN 1 THEN '10:00' WHEN 2 THEN '13:00' WHEN 3 THEN '15:00' ELSE '16:00' END,
        CASE @wl % 4 WHEN 0 THEN 'WAITING' WHEN 1 THEN 'NOTIFIED' WHEN 2 THEN 'BOOKED' ELSE 'CANCELLED' END,
        DATEADD(DAY, -(@wl % 30), GETDATE()),
        DATEADD(DAY, -(@wl % 20), GETDATE())
    );

    SET @wl += 1;
END
GO

/* Treatment notes for completed / in-progress appointments */
INSERT INTO TreatmentNotes
(
    AppointmentId, EmployeeId, Title, Content, NoteType, ProductsUsed,
    SkinCondition, Technique, CustomerFeedback, Recommendation, FollowUpDate,
    ProgressStatus, CreatedAt
)
SELECT TOP 120
    a.AppointmentId,
    a.EmployeeId,
    CONCAT(N'Ghi chú điều trị #', a.AppointmentId),
    N'Khách đã được kiểm tra tình trạng và thực hiện liệu trình theo đúng quy trình.',
    CASE WHEN a.Status = 'COMPLETED' THEN 'FINAL' ELSE 'PROGRESS' END,
    N'Serum cấp ẩm, kem phục hồi, tinh dầu thư giãn',
    CASE a.AppointmentId % 3
        WHEN 0 THEN N'Da hơi khô, cần cấp ẩm'
        WHEN 1 THEN N'Da dầu nhẹ vùng chữ T'
        ELSE N'Tình trạng ổn định'
    END,
    N'Làm sạch, massage nhẹ, đắp mặt nạ và phục hồi',
    N'Khách cảm thấy dễ chịu sau buổi dịch vụ',
    N'Nên quay lại sau 7-14 ngày để duy trì hiệu quả',
    DATEADD(DAY, 14, a.AppointmentDate),
    CASE WHEN a.Status = 'COMPLETED' THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
    ISNULL(a.CompletedAt, GETDATE())
FROM Appointments a
WHERE a.Status IN ('COMPLETED','IN_PROGRESS')
ORDER BY a.AppointmentId DESC;
GO

INSERT INTO TreatmentNoteAttachments (NoteId, FileName, FileUrl, FileType, AttachmentType)
SELECT TOP 50
    NoteId,
    CONCAT('treatment-note-', NoteId, '.png'),
    CONCAT('/images/treatment-notes/note-', ((NoteId - 1) % 10) + 1, '.png'),
    'image/png',
    CASE WHEN NoteId % 2 = 0 THEN 'BEFORE' ELSE 'AFTER' END
FROM TreatmentNotes;
GO

/* Favorite services and employees */
INSERT INTO CustomerFavoriteServices (UserId, ServiceId, CreatedAt)
SELECT DISTINCT TOP 140
    c.UserId,
    ((c.CustomerId + s.ServiceId) % (SELECT COUNT(*) FROM Services)) + 1,
    DATEADD(DAY, -c.CustomerId % 30, GETDATE())
FROM Customers c
CROSS JOIN Services s
WHERE (c.CustomerId + s.ServiceId) % 7 = 0;
GO

INSERT INTO CustomerFavoriteEmployees (UserId, EmployeeId, CreatedAt)
SELECT DISTINCT TOP 100
    c.UserId,
    ((c.CustomerId + e.EmployeeId) % (SELECT COUNT(*) FROM Employees)) + 1,
    DATEADD(DAY, -c.CustomerId % 30, GETDATE())
FROM Customers c
CROSS JOIN Employees e
WHERE (c.CustomerId + e.EmployeeId) % 9 = 0;
GO

/* Notifications */
DECLARE @nt INT = 1;
WHILE @nt <= 500
BEGIN
    INSERT INTO Notifications (UserId, Title, Content, Type, IsRead, CreatedAt)
    VALUES
    (
        ((@nt - 1) % (SELECT COUNT(*) FROM Users)) + 1,
        CASE @nt % 5
            WHEN 0 THEN N'Lịch hẹn mới'
            WHEN 1 THEN N'Thanh toán thành công'
            WHEN 2 THEN N'Nhắc lịch hẹn'
            WHEN 3 THEN N'Phản hồi từ salon'
            ELSE N'Ưu đãi mới'
        END,
        CONCAT(N'Thông báo demo số ', @nt, N' dành cho người dùng.'),
        CASE @nt % 5
            WHEN 0 THEN 'APPOINTMENT'
            WHEN 1 THEN 'PAYMENT'
            WHEN 2 THEN 'REMINDER'
            WHEN 3 THEN 'FEEDBACK'
            ELSE 'PROMOTION'
        END,
        CASE WHEN @nt % 3 = 0 THEN 1 ELSE 0 END,
        DATEADD(HOUR, -@nt, GETDATE())
    );

    SET @nt += 1;
END
GO

/* System logs */
DECLARE @lg INT = 1;
WHILE @lg <= 250
BEGIN
    INSERT INTO SystemLogs (UserId, RoleName, ActionName, ActionType, Description, IpAddress, OldValue, NewValue, CreatedAt)
    VALUES
    (
        ((@lg - 1) % (SELECT COUNT(*) FROM Users)) + 1,
        CASE @lg % 5 WHEN 0 THEN 'ADMIN' WHEN 1 THEN 'CUSTOMER' WHEN 2 THEN 'RECEPTIONIST' WHEN 3 THEN 'TECHNICIAN' ELSE 'MANAGER' END,
        CASE @lg % 6 WHEN 0 THEN 'LOGIN' WHEN 1 THEN 'CREATE_APPOINTMENT' WHEN 2 THEN 'UPDATE_STATUS' WHEN 3 THEN 'PAYMENT' WHEN 4 THEN 'REVIEW' ELSE 'UPDATE_PROFILE' END,
        CASE @lg % 4 WHEN 0 THEN 'CREATE' WHEN 1 THEN 'UPDATE' WHEN 2 THEN 'VIEW' ELSE 'DELETE' END,
        CONCAT(N'Log demo số ', @lg),
        CONCAT('192.168.1.', (@lg % 200) + 1),
        NULL,
        NULL,
        DATEADD(HOUR, -@lg, GETDATE())
    );

    SET @lg += 1;
END
GO

/* AI demo */
INSERT INTO AIRecommendations (CustomerId, ServiceId, RecommendationType, Reason)
SELECT TOP 80
    c.CustomerId,
    ((c.CustomerId - 1) % (SELECT COUNT(*) FROM Services)) + 1,
    CASE WHEN c.CustomerId % 2 = 0 THEN N'SERVICE_RECOMMENDATION' ELSE N'PACKAGE_RECOMMENDATION' END,
    N'Đề xuất dựa trên lịch sử đặt lịch và sở thích khách hàng.'
FROM Customers c;
GO

INSERT INTO AIPredictions (PredictionType, Result) VALUES
(N'REVENUE_FORECAST', N'Dự đoán doanh thu tháng tới tăng 12% dựa trên số lịch hẹn hiện tại.'),
(N'CUSTOMER_CHURN', N'Có 8 khách hàng có khả năng không quay lại trong 30 ngày tới.'),
(N'SERVICE_TREND', N'Dịch vụ skincare và massage đang có xu hướng tăng.');
GO

INSERT INTO AIChatLogs (UserId, Question, Answer)
SELECT TOP 40
    UserId,
    N'Tôi nên chọn dịch vụ nào cho da khô?',
    N'Bạn có thể chọn chăm sóc da mặt cơ bản hoặc cấy tinh chất phục hồi.'
FROM Users
WHERE RoleId = 5;
GO

INSERT INTO AIAuditLogs (UserId, FeatureName, Prompt, AIResponse, ModelName, InputToken, OutputToken, Cost, IsChecked, CheckResult)
SELECT TOP 40
    UserId,
    N'Service Suggestion',
    N'Gợi ý dịch vụ phù hợp cho khách hàng.',
    N'Đề xuất chăm sóc da mặt cơ bản.',
    N'gpt-demo',
    120,
    80,
    0.0120,
    1,
    N'OK'
FROM Users
WHERE RoleId = 5;
GO

/* Employee performance for 12 months */
DECLARE @m INT = 1;
WHILE @m <= 12
BEGIN
    INSERT INTO EmployeePerformance
    (EmployeeId, TotalAppointments, CompletedAppointments, CancelledAppointments, AverageRating, Revenue, Month, Year)
    SELECT
        e.EmployeeId,
        20 + (e.EmployeeId * @m) % 30,
        15 + (e.EmployeeId * @m) % 20,
        (e.EmployeeId + @m) % 5,
        CAST(3.5 + ((e.EmployeeId + @m) % 15) / 10.0 AS DECIMAL(3,2)),
        5000000 + (e.EmployeeId * @m * 350000),
        @m,
        YEAR(GETDATE())
    FROM Employees e;

    SET @m += 1;
END
GO

/* Payout requests */
INSERT INTO TechnicianPayoutRequests (EmployeeId, Amount, Status, Note, RequestedAt, ProcessedAt, ProcessedBy)
SELECT TOP 25
    EmployeeId,
    1000000 + EmployeeId * 200000,
    CASE EmployeeId % 4 WHEN 0 THEN 'PENDING' WHEN 1 THEN 'APPROVED' WHEN 2 THEN 'REJECTED' ELSE 'PAID' END,
    N'Yêu cầu rút tiền hoa hồng demo',
    DATEADD(DAY, -EmployeeId * 2, GETDATE()),
    CASE WHEN EmployeeId % 4 = 0 THEN NULL ELSE DATEADD(DAY, -EmployeeId, GETDATE()) END,
    CASE WHEN EmployeeId % 4 = 0 THEN NULL ELSE (SELECT TOP 1 UserId FROM Users WHERE RoleId IN (1,2)) END
FROM Employees;
GO

/* Fix customer main account has vouchers/favorites/packages */
INSERT INTO CustomerVouchers (CustomerId, VoucherId, UsedStatus, UsedAt)
SELECT 1, VoucherId, 0, NULL
FROM Vouchers
WHERE NOT EXISTS (
    SELECT 1 FROM CustomerVouchers cv WHERE cv.CustomerId = 1 AND cv.VoucherId = Vouchers.VoucherId
);
GO

/* =========================================================
   15. SUMMARY CHECK
========================================================= */

PRINT '=========================================================';
PRINT 'BeautySalonSystem1 COMPLETE TEST DATABASE CREATED';
PRINT 'Login accounts:';
PRINT 'ADMIN        admin@salon.com        / 123456';
PRINT 'MANAGER      manager@salon.com      / 123456';
PRINT 'RECEPTIONIST receptionist@salon.com / 123456';
PRINT 'TECHNICIAN   technician@salon.com   / 123456';
PRINT 'CUSTOMER     customer@salon.com     / 123456';
PRINT '=========================================================';
GO

SELECT 'Users' AS TableName, COUNT(*) AS TotalRows FROM Users
UNION ALL SELECT 'Customers', COUNT(*) FROM Customers
UNION ALL SELECT 'Employees', COUNT(*) FROM Employees
UNION ALL SELECT 'Services', COUNT(*) FROM Services
UNION ALL SELECT 'Appointments', COUNT(*) FROM Appointments
UNION ALL SELECT 'Invoices', COUNT(*) FROM Invoices
UNION ALL SELECT 'Payments', COUNT(*) FROM Payments
UNION ALL SELECT 'Reviews', COUNT(*) FROM Reviews
UNION ALL SELECT 'Feedbacks', COUNT(*) FROM Feedbacks
UNION ALL SELECT 'WaitingList', COUNT(*) FROM WaitingList
UNION ALL SELECT 'Notifications', COUNT(*) FROM Notifications
UNION ALL SELECT 'TreatmentNotes', COUNT(*) FROM TreatmentNotes
UNION ALL SELECT 'EmployeePerformance', COUNT(*) FROM EmployeePerformance;
GO


USE BeautySalonSystem1;
GO

IF OBJECT_ID('dbo.CustomerFavoriteEmployees', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.CustomerFavoriteEmployees;
END
GO

CREATE TABLE CustomerFavoriteEmployees (
    UserId INT NOT NULL,
    EmployeeId INT NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT PK_CustomerFavoriteEmployees 
        PRIMARY KEY (UserId, EmployeeId),

    CONSTRAINT FK_CustomerFavoriteEmployees_Users 
        FOREIGN KEY (UserId) 
        REFERENCES Users(UserId) 
        ON DELETE CASCADE,

    CONSTRAINT FK_CustomerFavoriteEmployees_Employees 
        FOREIGN KEY (EmployeeId) 
        REFERENCES Employees(EmployeeId)
);
GO

IF COL_LENGTH('WaitingList', 'Note') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD Note NVARCHAR(500) NULL;
END;

IF COL_LENGTH('WaitingList', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD UpdatedAt DATETIME NULL;
END;

IF COL_LENGTH('dbo.WaitingList', 'Note') IS NULL
BEGIN
    ALTER TABLE dbo.WaitingList ADD Note NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('dbo.WaitingList', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.WaitingList ADD UpdatedAt DATETIME NULL;
END;
GO

UPDATE dbo.WaitingList
SET UpdatedAt = ISNULL(UpdatedAt, CreatedAt)
WHERE UpdatedAt IS NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'Note') IS NULL
    ALTER TABLE dbo.WaitingList ADD Note NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'UpdatedAt') IS NULL
    ALTER TABLE dbo.WaitingList ADD UpdatedAt DATETIME NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'PreferredEmployeeId') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredEmployeeId INT NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'PreferredBranchId') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredBranchId INT NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'PreferredTimeFrom') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredTimeFrom TIME NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'PreferredTimeTo') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredTimeTo TIME NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'FlexibleTimeSlot') IS NULL
    ALTER TABLE dbo.WaitingList ADD FlexibleTimeSlot NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'PriorityLevel') IS NULL
    ALTER TABLE dbo.WaitingList ADD PriorityLevel NVARCHAR(20) NOT NULL DEFAULT 'NORMAL';
GO

IF COL_LENGTH('dbo.WaitingList', 'ContactMethod') IS NULL
    ALTER TABLE dbo.WaitingList ADD ContactMethod NVARCHAR(30) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'ContactPhone') IS NULL
    ALTER TABLE dbo.WaitingList ADD ContactPhone NVARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'Reason') IS NULL
    ALTER TABLE dbo.WaitingList ADD Reason NVARCHAR(255) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'CancelReason') IS NULL
    ALTER TABLE dbo.WaitingList ADD CancelReason NVARCHAR(255) NULL;
GO

IF COL_LENGTH('dbo.WaitingList', 'ConvertedAppointmentId') IS NULL
    ALTER TABLE dbo.WaitingList ADD ConvertedAppointmentId INT NULL;
GO

UPDATE dbo.WaitingList
SET UpdatedAt = ISNULL(UpdatedAt, CreatedAt)
WHERE UpdatedAt IS NULL;
GO

IF OBJECT_ID('dbo.LoyaltyPointTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LoyaltyPointTransactions (
        TransactionId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId INT NOT NULL,
        AppointmentId INT NULL,
        PaymentId INT NULL,
        Type NVARCHAR(20) NOT NULL,
        Points INT NOT NULL,
        Amount DECIMAL(18,2) NULL,
        Note NVARCHAR(255) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LoyaltyPointTransactions_Customers
            FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId)
    );
END;
GO

IF COL_LENGTH('dbo.Invoices', 'RewardPointsUsed') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices ADD RewardPointsUsed INT NOT NULL DEFAULT 0;
END;
GO

IF COL_LENGTH('dbo.Invoices', 'RewardDiscountAmount') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices ADD RewardDiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0;
END;
GO


/*
  Luồng combo chuẩn:
  - Đặt lịch bằng combo: không trừ buổi.
  - Khi lịch chuyển COMPLETED: tạo CustomerPackageUsages và trừ buổi đúng 1 lần.
  - Hủy lịch: chỉ cộng trả buổi nếu lịch đó đã có usage USED.
*/

IF OBJECT_ID('dbo.CustomerPackageUsages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomerPackageUsages (
    UsageId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    AppointmentId INT NOT NULL,
    ServiceId INT NOT NULL,
    SessionsUsed INT NOT NULL DEFAULT 1,
    Status NVARCHAR(20) NOT NULL DEFAULT 'USED',
    UsedAt DATETIME NULL,
    UsedBy INT NULL,
    CancelledAt DATETIME NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NULL,
    CONSTRAINT FK_CustomerPackageUsages_CustomerPackages
      FOREIGN KEY (CustomerPackageId) REFERENCES dbo.CustomerPackages(CustomerPackageId),
    CONSTRAINT FK_CustomerPackageUsages_Appointments
      FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId),
    CONSTRAINT FK_CustomerPackageUsages_Services
      FOREIGN KEY (ServiceId) REFERENCES dbo.Services(ServiceId),
    CONSTRAINT CK_CustomerPackageUsages_Status
      CHECK (Status IN ('USED', 'CANCELLED')),
    CONSTRAINT CK_CustomerPackageUsages_Sessions
      CHECK (SessionsUsed > 0)
  );

  CREATE UNIQUE INDEX UX_CustomerPackageUsages_Appointment_Used
    ON dbo.CustomerPackageUsages(AppointmentId)
    WHERE Status = 'USED';

  CREATE INDEX IX_CustomerPackageUsages_CustomerPackage
    ON dbo.CustomerPackageUsages(CustomerPackageId, UsedAt DESC);
END
GO

/* Nếu database cũ đã từng trừ buổi ngay khi đặt lịch, chạy phần dưới để đồng bộ lại theo appointment COMPLETED.
   Chỉ bật khi bạn hiểu dữ liệu thật của mình. Với database mới thì bỏ qua.
*/
-- UPDATE cp
-- SET
--   UsedSessions = ISNULL(x.UsedCount, 0),
--   RemainingSessions = cp.TotalSessions - ISNULL(x.UsedCount, 0),
--   Status = CASE
--     WHEN cp.Status IN ('CANCELLED', 'PENDING_PAYMENT', 'EXPIRED') THEN cp.Status
--     WHEN cp.TotalSessions - ISNULL(x.UsedCount, 0) <= 0 THEN 'USED_UP'
--     ELSE 'ACTIVE'
--   END,
--   UpdatedAt = GETDATE()
-- FROM CustomerPackages cp
-- OUTER APPLY (
--   SELECT COUNT(*) AS UsedCount
--   FROM Appointments a
--   WHERE a.CustomerPackageId = cp.CustomerPackageId
--     AND a.Status = 'COMPLETED'
-- ) x;


IF OBJECT_ID('dbo.WaitingList', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.WaitingList (
        WaitingId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId INT NOT NULL,
        ServiceId INT NOT NULL,
        PreferredEmployeeId INT NULL,
        PreferredBranchId INT NULL,
        PreferredDate DATE NULL,
        PreferredTime TIME(0) NULL,
        PreferredTimeFrom TIME(0) NULL,
        PreferredTimeTo TIME(0) NULL,
        FlexibleTimeSlot NVARCHAR(20) NOT NULL DEFAULT 'ANY',
        PriorityLevel NVARCHAR(20) NOT NULL DEFAULT 'NORMAL',
        ContactMethod NVARCHAR(20) NOT NULL DEFAULT 'PHONE',
        ContactPhone NVARCHAR(30) NULL,
        Reason NVARCHAR(255) NULL,
        Note NVARCHAR(500) NULL,
        CancelReason NVARCHAR(255) NULL,
        ConvertedAppointmentId INT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'WAITING',
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.WaitingList', 'WaitingId') IS NULL
BEGIN
    EXEC sp_rename 'dbo.WaitingList.WaitingListId', 'WaitingId', 'COLUMN';
END
GO

IF COL_LENGTH('dbo.WaitingList', 'PreferredEmployeeId') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredEmployeeId INT NULL;
IF COL_LENGTH('dbo.WaitingList', 'PreferredBranchId') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredBranchId INT NULL;
IF COL_LENGTH('dbo.WaitingList', 'PreferredTime') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredTime TIME(0) NULL;
IF COL_LENGTH('dbo.WaitingList', 'PreferredTimeFrom') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredTimeFrom TIME(0) NULL;
IF COL_LENGTH('dbo.WaitingList', 'PreferredTimeTo') IS NULL
    ALTER TABLE dbo.WaitingList ADD PreferredTimeTo TIME(0) NULL;
IF COL_LENGTH('dbo.WaitingList', 'FlexibleTimeSlot') IS NULL
    ALTER TABLE dbo.WaitingList ADD FlexibleTimeSlot NVARCHAR(20) NOT NULL DEFAULT 'ANY';
IF COL_LENGTH('dbo.WaitingList', 'PriorityLevel') IS NULL
    ALTER TABLE dbo.WaitingList ADD PriorityLevel NVARCHAR(20) NOT NULL DEFAULT 'NORMAL';
IF COL_LENGTH('dbo.WaitingList', 'ContactMethod') IS NULL
    ALTER TABLE dbo.WaitingList ADD ContactMethod NVARCHAR(20) NOT NULL DEFAULT 'PHONE';
IF COL_LENGTH('dbo.WaitingList', 'ContactPhone') IS NULL
    ALTER TABLE dbo.WaitingList ADD ContactPhone NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.WaitingList', 'Reason') IS NULL
    ALTER TABLE dbo.WaitingList ADD Reason NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.WaitingList', 'CancelReason') IS NULL
    ALTER TABLE dbo.WaitingList ADD CancelReason NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.WaitingList', 'ConvertedAppointmentId') IS NULL
    ALTER TABLE dbo.WaitingList ADD ConvertedAppointmentId INT NULL;
IF COL_LENGTH('dbo.WaitingList', 'UpdatedAt') IS NULL
    ALTER TABLE dbo.WaitingList ADD UpdatedAt DATETIME NOT NULL DEFAULT GETDATE();
GO