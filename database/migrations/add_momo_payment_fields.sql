IF COL_LENGTH('dbo.Payments', 'MomoOrderId') IS NULL
    ALTER TABLE Payments ADD MomoOrderId NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Payments', 'MomoRequestId') IS NULL
    ALTER TABLE Payments ADD MomoRequestId NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Payments', 'MomoTransId') IS NULL
    ALTER TABLE Payments ADD MomoTransId NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Payments', 'MomoResultCode') IS NULL
    ALTER TABLE Payments ADD MomoResultCode INT NULL;
GO
IF COL_LENGTH('dbo.Payments', 'MomoMessage') IS NULL
    ALTER TABLE Payments ADD MomoMessage NVARCHAR(255) NULL;
GO
IF COL_LENGTH('dbo.Payments', 'PaymentProvider') IS NULL
    ALTER TABLE Payments ADD PaymentProvider NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'MomoRefundRequestId') IS NULL
    ALTER TABLE Refunds ADD MomoRefundRequestId NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'MomoRefundTransId') IS NULL
    ALTER TABLE Refunds ADD MomoRefundTransId NVARCHAR(100) NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'MomoResultCode') IS NULL
    ALTER TABLE Refunds ADD MomoResultCode INT NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'MomoMessage') IS NULL
    ALTER TABLE Refunds ADD MomoMessage NVARCHAR(255) NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'RequestedBy') IS NULL
    ALTER TABLE Refunds ADD RequestedBy INT NULL;
GO
IF COL_LENGTH('dbo.Refunds', 'RequestedAt') IS NULL
    ALTER TABLE Refunds ADD RequestedAt DATETIME NULL;
GO
