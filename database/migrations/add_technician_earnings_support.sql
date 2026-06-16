/* =========================================================
   Add technician earnings support for SQL Server
   Purpose:
   - Store technician payout requests
   - Store technician earning goals
   - Keep history of payout processing
   ========================================================= */

IF OBJECT_ID('dbo.TechnicianEarningGoals', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TechnicianEarningGoals (
        GoalId INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId INT NOT NULL,
        MonthlyGoal DECIMAL(18,2) NOT NULL CONSTRAINT DF_TechnicianEarningGoals_MonthlyGoal DEFAULT 8000000,
        Active BIT NOT NULL CONSTRAINT DF_TechnicianEarningGoals_Active DEFAULT 1,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_TechnicianEarningGoals_CreatedAt DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_TechnicianEarningGoals_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
        CONSTRAINT UQ_TechnicianEarningGoals_Employee UNIQUE (EmployeeId),
        CONSTRAINT CK_TechnicianEarningGoals_MonthlyGoal CHECK (MonthlyGoal >= 0)
    );
END
GO

IF OBJECT_ID('dbo.TechnicianPayoutRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TechnicianPayoutRequests (
        PayoutRequestId INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId INT NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_TechnicianPayoutRequests_Status DEFAULT 'PENDING',
        Note NVARCHAR(MAX) NULL,
        RequestedAt DATETIME NOT NULL CONSTRAINT DF_TechnicianPayoutRequests_RequestedAt DEFAULT GETDATE(),
        ProcessedAt DATETIME NULL,
        ProcessedBy INT NULL,
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_TechnicianPayoutRequests_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
        CONSTRAINT FK_TechnicianPayoutRequests_ProcessedBy FOREIGN KEY (ProcessedBy) REFERENCES Users(UserId),
        CONSTRAINT CK_TechnicianPayoutRequests_Status CHECK (Status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
        CONSTRAINT CK_TechnicianPayoutRequests_Amount CHECK (Amount >= 0)
    );
END
GO

IF OBJECT_ID('dbo.TechnicianPayoutLedger', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.TechnicianPayoutLedger (
        LedgerId INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId INT NOT NULL,
        ReferenceType NVARCHAR(30) NOT NULL,
        ReferenceId INT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        EntryType NVARCHAR(20) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL CONSTRAINT DF_TechnicianPayoutLedger_CreatedAt DEFAULT GETDATE(),
        CONSTRAINT FK_TechnicianPayoutLedger_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
        CONSTRAINT CK_TechnicianPayoutLedger_EntryType CHECK (EntryType IN ('EARNING', 'PAYOUT', 'ADJUSTMENT'))
    );
END
GO

IF COL_LENGTH('dbo.Invoices', 'TechnicianCommissionAmount') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices
    ADD TechnicianCommissionAmount DECIMAL(18,2) NULL;
END
GO

IF COL_LENGTH('dbo.Invoices', 'TechnicianTipAmount') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices
    ADD TechnicianTipAmount DECIMAL(18,2) NULL;
END
GO

IF COL_LENGTH('dbo.Invoices', 'TechnicianCommissionRate') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices
    ADD TechnicianCommissionRate DECIMAL(5,2) NULL;
END
GO
