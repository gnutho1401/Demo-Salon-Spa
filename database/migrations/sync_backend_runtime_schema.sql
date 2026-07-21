USE [BeautySalonSystem1];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.Appointments', N'U') IS NULL
        THROW 50001, 'Missing prerequisite table dbo.Appointments.', 1;
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
        THROW 50002, 'Missing prerequisite table dbo.Users.', 1;
    IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
        THROW 50003, 'Missing prerequisite table dbo.Customers.', 1;
    IF OBJECT_ID(N'dbo.AISkinAnalysisHistory', N'U') IS NULL
        THROW 50004, 'Missing prerequisite table dbo.AISkinAnalysisHistory.', 1;
    IF OBJECT_ID(N'dbo.Invoices', N'U') IS NULL
        THROW 50005, 'Missing prerequisite table dbo.Invoices.', 1;
    IF OBJECT_ID(N'dbo.TreatmentNotesV2', N'U') IS NULL
        THROW 50006, 'Missing prerequisite table dbo.TreatmentNotesV2.', 1;

    /* Runtime contract for reschedule.service.js. */
    IF OBJECT_ID(N'dbo.AppointmentRescheduleRequests', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.AppointmentRescheduleRequests
        (
            RequestId INT IDENTITY(1,1) NOT NULL,
            AppointmentId INT NOT NULL,
            RequesterId INT NULL,
            RequestedDate DATE NOT NULL,
            RequestedStartTime TIME(0) NOT NULL,
            RequestedEndTime TIME(0) NOT NULL,
            Reason NVARCHAR(1000) NULL,
            Status NVARCHAR(30) NOT NULL
                CONSTRAINT DF_AppointmentRescheduleRequests_Status DEFAULT (N'PENDING'),
            Notes NVARCHAR(1000) NULL,
            CreatedAt DATETIME NOT NULL
                CONSTRAINT DF_AppointmentRescheduleRequests_CreatedAt DEFAULT (GETDATE()),
            UpdatedAt DATETIME NULL,

            CONSTRAINT PK_AppointmentRescheduleRequests
                PRIMARY KEY CLUSTERED (RequestId),
            CONSTRAINT FK_AppointmentRescheduleRequests_Appointments
                FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(AppointmentId),
            CONSTRAINT FK_AppointmentRescheduleRequests_Users
                FOREIGN KEY (RequesterId) REFERENCES dbo.Users(UserId),
            CONSTRAINT CK_AppointmentRescheduleRequests_Time
                CHECK (RequestedEndTime > RequestedStartTime),
            CONSTRAINT CK_AppointmentRescheduleRequests_Status
                CHECK (Status IN
                (
                    N'PENDING',
                    N'AWAITING_CUSTOMER',
                    N'APPROVED',
                    N'REJECTED',
                    N'CUSTOMER_REJECTED',
                    N'SYSTEM_CANCELLED',
                    N'CANCELLED'
                ))
        );
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.AppointmentRescheduleRequests')
          AND name = N'IX_AppointmentRescheduleRequests_Appointment_Status'
    )
    BEGIN
        CREATE INDEX IX_AppointmentRescheduleRequests_Appointment_Status
            ON dbo.AppointmentRescheduleRequests(AppointmentId, Status)
            INCLUDE (RequestedDate, RequestedStartTime, RequestedEndTime, CreatedAt);
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.AppointmentRescheduleRequests')
          AND name = N'IX_AppointmentRescheduleRequests_Status_CreatedAt'
    )
    BEGIN
        CREATE INDEX IX_AppointmentRescheduleRequests_Status_CreatedAt
            ON dbo.AppointmentRescheduleRequests(Status, CreatedAt DESC);
    END;

    /* Membership expiration used by customer and membership services. */
    IF COL_LENGTH(N'dbo.Customers', N'VIPExpiredAt') IS NULL
        ALTER TABLE dbo.Customers ADD VIPExpiredAt DATETIME NULL;

    /* Extended AI skin analysis attributes. */
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'Pores') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD Pores NVARCHAR(100) NULL;
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'Hydration') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD Hydration NVARCHAR(100) NULL;
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'Sebum') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD Sebum NVARCHAR(100) NULL;
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'SkinBarrier') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD SkinBarrier NVARCHAR(100) NULL;
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'Elasticity') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD Elasticity NVARCHAR(100) NULL;
    IF COL_LENGTH(N'dbo.AISkinAnalysisHistory', N'DarkCircles') IS NULL
        ALTER TABLE dbo.AISkinAnalysisHistory ADD DarkCircles NVARCHAR(100) NULL;

    /* Invoice adjustments are always non-negative and default to zero. */
    IF COL_LENGTH(N'dbo.Invoices', N'ManualDiscount') IS NULL
    BEGIN
        ALTER TABLE dbo.Invoices
            ADD ManualDiscount DECIMAL(18,2) NOT NULL
                CONSTRAINT DF_Invoices_ManualDiscount DEFAULT (0) WITH VALUES;
    END;

    IF COL_LENGTH(N'dbo.Invoices', N'Surcharge') IS NULL
    BEGIN
        ALTER TABLE dbo.Invoices
            ADD Surcharge DECIMAL(18,2) NOT NULL
                CONSTRAINT DF_Invoices_Surcharge DEFAULT (0) WITH VALUES;
    END;

    IF OBJECT_ID(N'dbo.CK_Invoices_ManualDiscount_NonNegative', N'C') IS NULL
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.Invoices WITH CHECK
                ADD CONSTRAINT CK_Invoices_ManualDiscount_NonNegative
                    CHECK (ManualDiscount >= 0);';

    IF OBJECT_ID(N'dbo.CK_Invoices_Surcharge_NonNegative', N'C') IS NULL
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.Invoices WITH CHECK
                ADD CONSTRAINT CK_Invoices_Surcharge_NonNegative
                    CHECK (Surcharge >= 0);';

    /* JSON array of detail image URLs used by Treatment Notes V2. */
    IF COL_LENGTH(N'dbo.TreatmentNotesV2', N'detailed_images') IS NULL
        ALTER TABLE dbo.TreatmentNotesV2 ADD detailed_images NVARCHAR(MAX) NULL;

    IF OBJECT_ID(N'dbo.CK_TreatmentNotesV2_DetailedImages_IsJson', N'C') IS NULL
        EXEC sys.sp_executesql N'
            ALTER TABLE dbo.TreatmentNotesV2 WITH CHECK
                ADD CONSTRAINT CK_TreatmentNotesV2_DetailedImages_IsJson
                    CHECK (detailed_images IS NULL OR ISJSON(detailed_images) = 1);';

    COMMIT TRANSACTION;
    PRINT N'Backend runtime schema migration completed successfully.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
