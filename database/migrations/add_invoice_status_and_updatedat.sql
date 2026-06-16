IF COL_LENGTH('dbo.Invoices', 'Status') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices
    ADD Status NVARCHAR(30) NOT NULL CONSTRAINT DF_Invoices_Status DEFAULT('UNPAID');
END
GO

IF COL_LENGTH('dbo.Invoices', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Invoices
    ADD UpdatedAt DATETIME2 NULL;
END
GO
