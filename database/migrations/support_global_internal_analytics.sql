SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @ManagersLinked INT = 0;
    DECLARE @AppointmentsLinked INT = 0;
    DECLARE @PaymentsDated INT = 0;
    DECLARE @LogsTyped INT = 0;
    DECLARE @CommissionsCalculated INT = 0;

    /* Manager cần BranchId để RBAC giới hạn dữ liệu đúng phạm vi. */
    ;WITH FirstActiveBranch AS (
        SELECT TOP (1) BranchId
        FROM dbo.Branches
        WHERE Status = 'ACTIVE'
        ORDER BY BranchId
    )
    UPDATE e
    SET e.BranchId = b.BranchId
    FROM dbo.Employees e
    JOIN dbo.Users u ON u.UserId = e.UserId
    JOIN dbo.Roles r ON r.RoleId = u.RoleId
    CROSS JOIN FirstActiveBranch b
    WHERE UPPER(r.RoleName) = 'MANAGER'
      AND e.BranchId IS NULL;
    SET @ManagersLinked = @@ROWCOUNT;

    /* Ưu tiên chi nhánh của phòng phục vụ, sau đó mới dùng chi nhánh nhân viên. */
    UPDATE a
    SET a.BranchId = COALESCE(sr.BranchId, e.BranchId)
    FROM dbo.Appointments a
    LEFT JOIN dbo.ServiceResources sr ON sr.ResourceId = a.ResourceId
    LEFT JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
    WHERE a.BranchId IS NULL
      AND COALESCE(sr.BranchId, e.BranchId) IS NOT NULL;
    SET @AppointmentsLinked = @@ROWCOUNT;

    /* Thanh toán PAID cũ phải có mốc thời gian để xuất hiện trong báo cáo. */
    UPDATE dbo.Payments
    SET PaidAt = CreatedAt
    WHERE Status = 'PAID'
      AND PaidAt IS NULL;
    SET @PaymentsDated = @@ROWCOUNT;

    /* Chuẩn hóa nhật ký cũ để biểu đồ hoạt động hệ thống không có nhãn rỗng. */
    UPDATE dbo.SystemLogs
    SET ActionType = CASE
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%LOGIN%' THEN 'AUTH'
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%PAY%' THEN 'PAYMENT'
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%APPOINT%' THEN 'APPOINTMENT'
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%UPDATE%' THEN 'UPDATE'
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%CREATE%' THEN 'CREATE'
        WHEN UPPER(ISNULL(ActionName, '')) LIKE '%DELETE%' THEN 'DELETE'
        ELSE 'OTHER'
    END
    WHERE NULLIF(LTRIM(RTRIM(ActionType)), '') IS NULL;
    SET @LogsTyped = @@ROWCOUNT;

    /* Hoàn thiện chi phí hoa hồng trên hóa đơn thật đã có tỷ lệ. */
    UPDATE dbo.Invoices
    SET TechnicianCommissionAmount = ROUND(FinalAmount * TechnicianCommissionRate / 100.0, 2)
    WHERE TechnicianCommissionRate IS NOT NULL
      AND TechnicianCommissionAmount IS NULL;
    SET @CommissionsCalculated = @@ROWCOUNT;

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Appointments')
          AND name = 'IX_Appointments_InternalAnalytics'
    )
        CREATE INDEX IX_Appointments_InternalAnalytics
        ON dbo.Appointments (AppointmentDate, BranchId, EmployeeId, Status)
        INCLUDE (AppointmentId);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Payments')
          AND name = 'IX_Payments_InternalAnalytics'
    )
        CREATE INDEX IX_Payments_InternalAnalytics
        ON dbo.Payments (Status, PaidAt)
        INCLUDE (Amount, InvoiceId, CreatedAt);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.SystemLogs')
          AND name = 'IX_SystemLogs_InternalAnalytics'
    )
        CREATE INDEX IX_SystemLogs_InternalAnalytics
        ON dbo.SystemLogs (CreatedAt, UserId, ActionType)
        INCLUDE (ActionName);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.Reviews')
          AND name = 'IX_Reviews_InternalAnalytics'
    )
        CREATE INDEX IX_Reviews_InternalAnalytics
        ON dbo.Reviews (CreatedAt, EmployeeId, Status)
        INCLUDE (Rating);

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.AppointmentServices')
          AND name = 'IX_AppointmentServices_Service_Appointment'
    )
        CREATE INDEX IX_AppointmentServices_Service_Appointment
        ON dbo.AppointmentServices (ServiceId, AppointmentId);

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.SystemLogs
        WHERE ActionName = 'GLOBAL_ANALYTICS_DATA_SYNC'
    )
    BEGIN
        INSERT INTO dbo.SystemLogs (
            UserId,
            RoleName,
            ActionName,
            ActionType,
            Description,
            IpAddress,
            CreatedAt
        )
        SELECT TOP (1)
            u.UserId,
            'ADMIN',
            'GLOBAL_ANALYTICS_DATA_SYNC',
            'MIGRATION',
            N'Chuẩn hóa dữ liệu thật và chỉ mục cho bộ lọc báo cáo toàn trang.',
            'LOCAL_MIGRATION',
            GETDATE()
        FROM dbo.Users u
        JOIN dbo.Roles r ON r.RoleId = u.RoleId
        WHERE UPPER(r.RoleName) = 'ADMIN'
        ORDER BY u.UserId;
    END;

    COMMIT TRANSACTION;

    SELECT
        @ManagersLinked AS ManagersLinked,
        @AppointmentsLinked AS AppointmentsLinked,
        @PaymentsDated AS PaymentsDated,
        @LogsTyped AS LogsTyped,
        @CommissionsCalculated AS CommissionsCalculated;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
