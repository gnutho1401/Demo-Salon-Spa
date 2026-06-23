/* =================================================================
   BEAUTY SALON - ENTERPRISE PACKAGE MANAGEMENT MIGRATION
   Nâng cấp module Combo thành Hệ thống Quản lý Liệu trình Chuyên nghiệp
   
   Bảng hiện có giữ nguyên: CustomerPackages, PackagePayments, PackageServices
   Bảng mới: PackageFreezeRequests, PackageExtensions, PackageTransferHistory,
             PackageMembers, PackageBenefits
   Cập nhật: CustomerPackages (thêm cột), CustomerPackageUsages (đảm bảo tồn tại)
   ================================================================= */

USE BeautySalonSystem1;
GO

/* ===========================================================
   BƯỚC 1: Mở rộng bảng CustomerPackages - thêm các cột enterprise
   =========================================================== */

-- Thêm cột FreezeDays (số ngày đã đóng băng tổng cộng)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('dbo.CustomerPackages') AND name = 'FreezeDays'
)
BEGIN
  ALTER TABLE CustomerPackages ADD FreezeDays INT NOT NULL DEFAULT 0;
END
GO

-- Thêm cột ExtensionDays (số ngày đã gia hạn tổng cộng)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('dbo.CustomerPackages') AND name = 'ExtensionDays'
)
BEGIN
  ALTER TABLE CustomerPackages ADD ExtensionDays INT NOT NULL DEFAULT 0;
END
GO

-- Thêm cột MembershipLevelAtPurchase (ghi lại hạng thành viên khi mua)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('dbo.CustomerPackages') AND name = 'MembershipLevelAtPurchase'
)
BEGIN
  ALTER TABLE CustomerPackages ADD MembershipLevelAtPurchase NVARCHAR(50) NULL;
END
GO

-- Thêm cột PurchasePrice (giá mua thực tế)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('dbo.CustomerPackages') AND name = 'PurchasePrice'
)
BEGIN
  ALTER TABLE CustomerPackages ADD PurchasePrice DECIMAL(18,2) NULL;
END
GO

-- Cập nhật CHECK constraint cho Status - thêm FROZEN
-- Drop constraint cũ trước
IF EXISTS (
  SELECT 1 FROM sys.check_constraints 
  WHERE name = 'CK_CustomerPackages_Status' 
    AND parent_object_id = OBJECT_ID('dbo.CustomerPackages')
)
BEGIN
  ALTER TABLE CustomerPackages DROP CONSTRAINT CK_CustomerPackages_Status;
END
GO

ALTER TABLE CustomerPackages
ADD CONSTRAINT CK_CustomerPackages_Status 
CHECK (Status IN ('PENDING_PAYMENT', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED', 'USED_UP', 'COMPLETED'));
GO

/* ===========================================================
   BƯỚC 2: Đảm bảo bảng CustomerPackageUsages tồn tại
   =========================================================== */
IF OBJECT_ID('dbo.CustomerPackageUsages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomerPackageUsages (
    UsageId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    AppointmentId INT NULL,
    ServiceId INT NOT NULL,
    SessionsUsed INT NOT NULL DEFAULT 1,
    UsedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UsedBy INT NULL,
    Notes NVARCHAR(MAX) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    CONSTRAINT FK_CustomerPackageUsages_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerPackageUsages_Appointments 
      FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE SET NULL,
    CONSTRAINT FK_CustomerPackageUsages_Services 
      FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
    CONSTRAINT CK_CustomerPackageUsages_Status 
      CHECK (Status IN ('COMPLETED', 'CANCELLED')),
    CONSTRAINT CK_CustomerPackageUsages_Sessions 
      CHECK (SessionsUsed > 0)
  );

  -- Chống trừ buổi trùng: mỗi Appointment chỉ được trừ 1 lần (khi COMPLETED)
  CREATE UNIQUE INDEX UX_CustomerPackageUsages_Appointment_Used
    ON dbo.CustomerPackageUsages(AppointmentId)
    WHERE AppointmentId IS NOT NULL AND Status = 'COMPLETED';

  CREATE INDEX IX_CustomerPackageUsages_CustomerPackage
    ON dbo.CustomerPackageUsages(CustomerPackageId, UsedAt DESC);
END
GO

/* ===========================================================
   BƯỚC 3: Bảng PackageFreezeRequests - Yêu cầu đóng băng liệu trình
   =========================================================== */
IF OBJECT_ID('dbo.PackageFreezeRequests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PackageFreezeRequests (
    FreezeRequestId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    FreezeStartDate DATE NOT NULL,
    FreezeEndDate DATE NULL,
    Reason NVARCHAR(500) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    RequestedAt DATETIME NOT NULL DEFAULT GETDATE(),
    ApprovedBy INT NULL,
    ApprovedAt DATETIME NULL,
    CONSTRAINT FK_PackageFreezeRequests_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageFreezeRequests_Users 
      FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),
    CONSTRAINT CK_PackageFreezeRequests_Status 
      CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED', 'UNFROZEN'))
  );

  CREATE INDEX IX_PackageFreezeRequests_CustomerPackage 
    ON PackageFreezeRequests(CustomerPackageId, Status);
  CREATE INDEX IX_PackageFreezeRequests_Status 
    ON PackageFreezeRequests(Status, RequestedAt DESC);
END
GO

/* ===========================================================
   BƯỚC 4: Bảng PackageExtensions - Yêu cầu gia hạn liệu trình
   =========================================================== */
IF OBJECT_ID('dbo.PackageExtensions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PackageExtensions (
    ExtensionId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    DaysToExtend INT NOT NULL,
    Reason NVARCHAR(500) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    RequestedAt DATETIME NOT NULL DEFAULT GETDATE(),
    ApprovedBy INT NULL,
    ApprovedAt DATETIME NULL,
    CONSTRAINT FK_PackageExtensions_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageExtensions_Users 
      FOREIGN KEY (ApprovedBy) REFERENCES Users(UserId),
    CONSTRAINT CK_PackageExtensions_Status 
      CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT CK_PackageExtensions_Days 
      CHECK (DaysToExtend > 0 AND DaysToExtend <= 365)
  );

  CREATE INDEX IX_PackageExtensions_CustomerPackage 
    ON PackageExtensions(CustomerPackageId, Status);
  CREATE INDEX IX_PackageExtensions_Status 
    ON PackageExtensions(Status, RequestedAt DESC);
END
GO

/* ===========================================================
   BƯỚC 5: Bảng PackageBenefits - Quà tặng kèm (voucher, loyalty points)
   =========================================================== */
IF OBJECT_ID('dbo.PackageBenefits', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PackageBenefits (
    BenefitId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    BenefitType NVARCHAR(50) NOT NULL,
    VoucherId INT NULL,
    PointsAwarded INT NOT NULL DEFAULT 0,
    GrantedAt DATETIME NOT NULL DEFAULT GETDATE(),
    Status NVARCHAR(20) NOT NULL DEFAULT 'GRANTED',
    CONSTRAINT FK_PackageBenefits_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageBenefits_Vouchers 
      FOREIGN KEY (VoucherId) REFERENCES Vouchers(VoucherId),
    CONSTRAINT CK_PackageBenefits_Type 
      CHECK (BenefitType IN ('VOUCHER', 'LOYALTY_POINTS')),
    CONSTRAINT CK_PackageBenefits_Status 
      CHECK (Status IN ('GRANTED', 'REVOKED'))
  );

  CREATE INDEX IX_PackageBenefits_CustomerPackage 
    ON PackageBenefits(CustomerPackageId);
END
GO

/* ===========================================================
   BƯỚC 6: Bảng PackageTransferHistory - Lịch sử chuyển nhượng
   =========================================================== */
IF OBJECT_ID('dbo.PackageTransferHistory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PackageTransferHistory (
    TransferId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    FromCustomerId INT NOT NULL,
    ToCustomerId INT NOT NULL,
    SessionsTransferred INT NOT NULL,
    Reason NVARCHAR(500) NULL,
    TransferredAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PackageTransfer_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId),
    CONSTRAINT FK_PackageTransfer_FromCustomer 
      FOREIGN KEY (FromCustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT FK_PackageTransfer_ToCustomer 
      FOREIGN KEY (ToCustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT CK_PackageTransfer_Sessions 
      CHECK (SessionsTransferred > 0)
  );

  CREATE INDEX IX_PackageTransferHistory_CustomerPackage 
    ON PackageTransferHistory(CustomerPackageId);
END
GO

/* ===========================================================
   BƯỚC 7: Bảng PackageMembers - Combo gia đình (chia sẻ dùng chung)
   =========================================================== */
IF OBJECT_ID('dbo.PackageMembers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.PackageMembers (
    PackageMemberId INT IDENTITY(1,1) PRIMARY KEY,
    CustomerPackageId INT NOT NULL,
    FamilyCustomerId INT NOT NULL,
    Relationship NVARCHAR(50) NOT NULL,
    AddedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PackageMembers_CustomerPackages 
      FOREIGN KEY (CustomerPackageId) REFERENCES CustomerPackages(CustomerPackageId) ON DELETE CASCADE,
    CONSTRAINT FK_PackageMembers_Customers 
      FOREIGN KEY (FamilyCustomerId) REFERENCES Customers(CustomerId),
    CONSTRAINT UQ_PackageMembers 
      UNIQUE (CustomerPackageId, FamilyCustomerId)
  );

  CREATE INDEX IX_PackageMembers_Family 
    ON PackageMembers(FamilyCustomerId);
END
GO

PRINT N'=== Enterprise Package Management Migration hoàn tất ===';
GO
