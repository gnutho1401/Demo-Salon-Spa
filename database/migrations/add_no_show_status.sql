IF OBJECT_ID('dbo.Appointments', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_Appointments_Status'
          AND OBJECT_DEFINITION(object_id) LIKE '%NO_SHOW%'
    )
    BEGIN
        DECLARE @sql NVARCHAR(MAX) = N'';

        IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Appointments_Status')
        BEGIN
            ALTER TABLE Appointments DROP CONSTRAINT CK_Appointments_Status;
        END;

        ALTER TABLE Appointments
        ADD CONSTRAINT CK_Appointments_Status CHECK (
            Status IN (
                'PENDING_PAYMENT',
                'PENDING',
                'PAID',
                'CONFIRMED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED',
                'REFUND_PENDING',
                'NO_SHOW'
            )
        );
    END
END
GO
