/* ==========================================================
   MIGRATION: Add CustomerPackageId to Appointments
   ========================================================== */

IF COL_LENGTH('Appointments', 'CustomerPackageId') IS NULL
BEGIN
    ALTER TABLE Appointments 
    ADD CustomerPackageId INT NULL 
    FOREIGN KEY REFERENCES CustomerPackages(CustomerPackageId);
    PRINT 'Added CustomerPackageId column to Appointments table.';
END
ELSE
BEGIN
    PRINT 'CustomerPackageId column already exists in Appointments table.';
END
GO
