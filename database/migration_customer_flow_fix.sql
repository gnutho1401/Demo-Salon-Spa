/* Customer flow fix migration
   Dùng khi database cũ của bạn chưa có đủ cột/bảng cho luồng:
   Booking -> Payment -> My Appointments -> Cancel/Refund -> Review -> Service History
*/

IF COL_LENGTH('Appointments', 'CancelReason') IS NULL
BEGIN
    ALTER TABLE Appointments ADD CancelReason NVARCHAR(255) NULL;
END;
GO

IF COL_LENGTH('Appointments', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE Appointments ADD UpdatedAt DATETIME NULL;
END;
GO

IF OBJECT_ID('AppointmentStatusHistory', 'U') IS NULL
BEGIN
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
END;
GO

IF OBJECT_ID('Invoices', 'U') IS NULL
BEGIN
    CREATE TABLE Invoices (
        InvoiceId INT IDENTITY(1,1) PRIMARY KEY,
        AppointmentId INT NOT NULL UNIQUE,
        TotalAmount DECIMAL(18,2) NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL DEFAULT 0,
        FinalAmount DECIMAL(18,2) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Invoices_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId)
    );
END;
GO

IF OBJECT_ID('Refunds', 'U') IS NULL
BEGIN
    CREATE TABLE Refunds (
        RefundId INT IDENTITY(1,1) PRIMARY KEY,
        PaymentId INT NOT NULL,
        RefundAmount DECIMAL(18,2) NOT NULL,
        Reason NVARCHAR(MAX) NULL,
        RefundedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Refunds_Payments FOREIGN KEY (PaymentId) REFERENCES Payments(PaymentId)
    );
END;
GO

IF OBJECT_ID('Reviews', 'U') IS NOT NULL AND COL_LENGTH('Reviews', 'EmployeeId') IS NULL
BEGIN
    ALTER TABLE Reviews ADD EmployeeId INT NULL;
END;
GO
