-- Migration: Upgrade WaitingList Table with Smart Same-Day Queue columns

IF COL_LENGTH('dbo.WaitingList', 'AcceptOtherTechnician') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD AcceptOtherTechnician BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('dbo.WaitingList', 'AcceptOtherTimeSlots') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD AcceptOtherTimeSlots BIT NOT NULL DEFAULT 0;
END

IF COL_LENGTH('dbo.WaitingList', 'HoldExpiresAt') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD HoldExpiresAt DATETIME NULL;
END

IF COL_LENGTH('dbo.WaitingList', 'ExpireAt') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD ExpireAt DATETIME NULL;
END

IF COL_LENGTH('dbo.WaitingList', 'MatchedEmployeeId') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD MatchedEmployeeId INT NULL;
END

IF COL_LENGTH('dbo.WaitingList', 'MatchedDate') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD MatchedDate DATE NULL;
END

IF COL_LENGTH('dbo.WaitingList', 'MatchedStartTime') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD MatchedStartTime TIME(0) NULL;
END

IF COL_LENGTH('dbo.WaitingList', 'MatchedEndTime') IS NULL
BEGIN
    ALTER TABLE WaitingList ADD MatchedEndTime TIME(0) NULL;
END

-- Add Foreign Key if not exists
IF NOT EXISTS (
    SELECT 1 
    FROM sys.foreign_keys 
    WHERE name = 'FK_WaitingList_MatchedEmployee' 
      AND parent_object_id = OBJECT_ID('dbo.WaitingList')
)
BEGIN
    ALTER TABLE WaitingList 
    ADD CONSTRAINT FK_WaitingList_MatchedEmployee 
    FOREIGN KEY (MatchedEmployeeId) REFERENCES Employees(EmployeeId);
END

-- Drop and recreate CHECK constraint for Status to support MATCHED, SKIPPED, EXPIRED values
IF EXISTS (
    SELECT 1 
    FROM sys.check_constraints 
    WHERE name = 'CK_WaitingList_Status' 
      AND parent_object_id = OBJECT_ID('dbo.WaitingList')
)
BEGIN
    ALTER TABLE [dbo].[WaitingList] DROP CONSTRAINT [CK_WaitingList_Status];
END

ALTER TABLE [dbo].[WaitingList] 
ADD CONSTRAINT [CK_WaitingList_Status] 
CHECK (Status IN ('WAITING', 'NOTIFIED', 'BOOKED', 'CANCELLED', 'MATCHED', 'SKIPPED', 'EXPIRED'));
