-- Migration: Add bank fields to Refunds table for real Payouts via PayOS
IF COL_LENGTH('dbo.Refunds', 'BankCode') IS NULL
BEGIN
    ALTER TABLE Refunds ADD BankCode NVARCHAR(20) NULL;
END

IF COL_LENGTH('dbo.Refunds', 'AccountNumber') IS NULL
BEGIN
    ALTER TABLE Refunds ADD AccountNumber NVARCHAR(50) NULL;
END

IF COL_LENGTH('dbo.Refunds', 'AccountName') IS NULL
BEGIN
    ALTER TABLE Refunds ADD AccountName NVARCHAR(100) NULL;
END

IF COL_LENGTH('dbo.Refunds', 'PayosPayoutId') IS NULL
BEGIN
    ALTER TABLE Refunds ADD PayosPayoutId NVARCHAR(100) NULL;
END
