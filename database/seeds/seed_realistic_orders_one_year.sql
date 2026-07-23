/*
  REALISTIC ONE-YEAR OPERATIONAL DATASET FOR BEAUTY SALON
  SQL Server / BeautySalonSystem1

  IMPORTANT
  - The application does not have a standalone Orders table.
    A business order is normalized as:
      Appointments -> AppointmentServices -> Invoices -> Payments
  - This script creates realistic operational seed records. It does not claim that
    the generated transactions are genuine historical customer transactions.
  - Existing Customers, TECHNICIAN Employees, Services and Branches are reused.
  - Default mode is DRY RUN. Set @DryRun = 0 only after reviewing the summaries.
  - The committed batch is idempotent through @BatchCode and SystemLogs.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET DATEFIRST 1; -- Monday = 1, Saturday = 6, Sunday = 7.

DECLARE @DryRun BIT = 1;
DECLARE @BatchCode NVARCHAR(80) = N'REALISTIC_ONE_YEAR_V1';
DECLARE @EndDate DATE = EOMONTH(GETDATE(), -1);
DECLARE @StartDate DATE = DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(@EndDate), MONTH(@EndDate), 1));
DECLARE @SystemUserId INT = (
    SELECT TOP (1) u.UserId
    FROM dbo.Users AS u
    JOIN dbo.Roles AS r ON r.RoleId = u.RoleId
    WHERE r.RoleName IN (N'ADMIN', N'MANAGER', N'RECEPTIONIST')
      AND u.Status = N'ACTIVE'
    ORDER BY CASE r.RoleName WHEN N'ADMIN' THEN 1 WHEN N'MANAGER' THEN 2 ELSE 3 END, u.UserId
);

IF EXISTS (
    SELECT 1
    FROM dbo.SystemLogs
    WHERE ActionName = N'REALISTIC_ONE_YEAR_SEED'
      AND NewValue LIKE N'%"batchCode":"' + @BatchCode + N'"%'
)
BEGIN
    SELECT
        N'SKIPPED_ALREADY_APPLIED' AS ExecutionStatus,
        @BatchCode AS BatchCode,
        @StartDate AS StartDate,
        @EndDate AS EndDate;
    RETURN;
END;

IF OBJECT_ID(N'dbo.Appointments', N'U') IS NULL
   OR OBJECT_ID(N'dbo.AppointmentServices', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Invoices', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Payments', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Reviews', N'U') IS NULL
BEGIN
    THROW 51001, N'Missing one or more required operational tables.', 1;
END;

IF @SystemUserId IS NULL
BEGIN
    THROW 51002, N'No active internal user is available for status history and audit records.', 1;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Customers)
BEGIN
    THROW 51003, N'At least one existing customer is required.', 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.Employees AS e
    JOIN dbo.Users AS u ON u.UserId = e.UserId
    JOIN dbo.Roles AS r ON r.RoleId = u.RoleId AND r.RoleName = N'TECHNICIAN'
    JOIN dbo.EmployeeServices AS es ON es.EmployeeId = e.EmployeeId
    JOIN dbo.Services AS s ON s.ServiceId = es.ServiceId
    JOIN dbo.Branches AS b ON b.BranchId = e.BranchId
    WHERE e.Status = N'ACTIVE'
      AND u.Status = N'ACTIVE'
      AND b.Status = N'ACTIVE'
      AND s.Status IN (N'ACTIVE', N'AVAILABLE')
)
BEGIN
    THROW 51004, N'No active technician with an active service and branch is available.', 1;
END;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @AppLockResult INT;
    DECLARE @AppLockResource NVARCHAR(255) = N'BeautySalon:' + @BatchCode;
    EXEC @AppLockResult = sys.sp_getapplock
        @Resource = @AppLockResource,
        @LockMode = N'Exclusive',
        @LockOwner = N'Transaction',
        @LockTimeout = 0;

    IF @AppLockResult < 0
    BEGIN
        THROW 51005, N'Another one-year seed process is already running.', 1;
    END;

    /* Stable catalogs: all generated facts reference these existing records. */
    CREATE TABLE #Customers
    (
        CustomerRank INT NOT NULL PRIMARY KEY,
        CustomerId INT NOT NULL UNIQUE,
        UserId INT NOT NULL
    );

    INSERT INTO #Customers (CustomerRank, CustomerId, UserId)
    SELECT
        ROW_NUMBER() OVER (ORDER BY c.CustomerId),
        c.CustomerId,
        c.UserId
    FROM dbo.Customers AS c
    JOIN dbo.Users AS u ON u.UserId = c.UserId
    WHERE u.Status = N'ACTIVE';

    IF NOT EXISTS (SELECT 1 FROM #Customers)
    BEGIN
        THROW 51006, N'No active customer account is available.', 1;
    END;

    CREATE TABLE #Technicians
    (
        TechnicianRank INT NOT NULL PRIMARY KEY,
        EmployeeId INT NOT NULL UNIQUE,
        BranchId INT NOT NULL
    );

    INSERT INTO #Technicians (TechnicianRank, EmployeeId, BranchId)
    SELECT
        ROW_NUMBER() OVER (ORDER BY e.EmployeeId),
        e.EmployeeId,
        e.BranchId
    FROM dbo.Employees AS e
    JOIN dbo.Users AS u ON u.UserId = e.UserId
    JOIN dbo.Roles AS r ON r.RoleId = u.RoleId AND r.RoleName = N'TECHNICIAN'
    JOIN dbo.Branches AS b ON b.BranchId = e.BranchId AND b.Status = N'ACTIVE'
    WHERE e.Status = N'ACTIVE'
      AND u.Status = N'ACTIVE'
      AND EXISTS (
          SELECT 1
          FROM dbo.EmployeeServices AS es
          JOIN dbo.Services AS s ON s.ServiceId = es.ServiceId
          WHERE es.EmployeeId = e.EmployeeId
            AND s.Status IN (N'ACTIVE', N'AVAILABLE')
      );

    DECLARE @CustomerCount INT = (SELECT COUNT(*) FROM #Customers);
    DECLARE @TechnicianCount INT = (SELECT COUNT(*) FROM #Technicians);

    /*
      Daily distribution:
      - Normal weekdays: 8-10 orders.
      - Weekends, fixed holidays and peak months: 18-30 orders.
      - Peak months for salon demand: Jan-Feb, Jun-Jul, Nov-Dec.
      - Special dates include Vietnamese public holidays and beauty/event peaks.
    */
    CREATE TABLE #Calendar
    (
        BusinessDate DATE NOT NULL PRIMARY KEY,
        IsWeekend BIT NOT NULL,
        IsHoliday BIT NOT NULL,
        IsPeakSeason BIT NOT NULL,
        IsHighDemand BIT NOT NULL,
        TargetOrders INT NOT NULL
    );

    ;WITH CalendarDays AS
    (
        SELECT @StartDate AS BusinessDate
        UNION ALL
        SELECT DATEADD(DAY, 1, BusinessDate)
        FROM CalendarDays
        WHERE BusinessDate < @EndDate
    ), Classified AS
    (
        SELECT
            BusinessDate,
            CONVERT(BIT, CASE WHEN DATEPART(WEEKDAY, BusinessDate) IN (6, 7) THEN 1 ELSE 0 END) AS IsWeekend,
            CONVERT(BIT, CASE
                WHEN RIGHT(CONVERT(CHAR(8), BusinessDate, 112), 4) IN
                     ('0101', '0214', '0308', '0430', '0501', '0902', '1020', '1120', '1224', '1231')
                THEN 1 ELSE 0
            END) AS IsHoliday,
            CONVERT(BIT, CASE WHEN MONTH(BusinessDate) IN (1, 2, 6, 7, 11, 12) THEN 1 ELSE 0 END) AS IsPeakSeason
        FROM CalendarDays
    )
    INSERT INTO #Calendar
    (
        BusinessDate, IsWeekend, IsHoliday, IsPeakSeason, IsHighDemand, TargetOrders
    )
    SELECT
        BusinessDate,
        IsWeekend,
        IsHoliday,
        IsPeakSeason,
        CONVERT(BIT, CASE WHEN IsWeekend = 1 OR IsHoliday = 1 OR IsPeakSeason = 1 THEN 1 ELSE 0 END),
        CASE
            WHEN IsWeekend = 1 OR IsHoliday = 1 OR IsPeakSeason = 1
                THEN 18 + CONVERT(INT, ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, BusinessDate, N'HIGH'))) % 13)
            ELSE 8 + CONVERT(INT, ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, BusinessDate, N'NORMAL'))) % 3)
        END
    FROM Classified
    OPTION (MAXRECURSION 0);

    /* Four non-overlapping waves; max service bundle is capped at 165 minutes. */
    CREATE TABLE #Slots
    (
        SlotRank INT NOT NULL PRIMARY KEY,
        StartMinute INT NOT NULL UNIQUE
    );

    INSERT INTO #Slots (SlotRank, StartMinute)
    VALUES (1, 480), (2, 660), (3, 840), (4, 1020); -- 08:00, 11:00, 14:00, 17:00

    CREATE TABLE #CandidateOrders
    (
        BusinessDate DATE NOT NULL,
        TargetOrders INT NOT NULL,
        EmployeeId INT NOT NULL,
        BranchId INT NOT NULL,
        SlotRank INT NOT NULL,
        StartMinute INT NOT NULL,
        EndMinute INT NOT NULL,
        PrimaryServiceId INT NOT NULL,
        SecondaryServiceId INT NULL,
        PrimaryPrice DECIMAL(18,2) NOT NULL,
        SecondaryPrice DECIMAL(18,2) NULL,
        CandidateScore BIGINT NOT NULL
    );

    INSERT INTO #CandidateOrders
    (
        BusinessDate, TargetOrders, EmployeeId, BranchId, SlotRank, StartMinute, EndMinute,
        PrimaryServiceId, SecondaryServiceId, PrimaryPrice, SecondaryPrice, CandidateScore
    )
    SELECT
        c.BusinessDate,
        c.TargetOrders,
        t.EmployeeId,
        t.BranchId,
        slot.SlotRank,
        slot.StartMinute,
        slot.StartMinute + primaryService.DurationMinutes + ISNULL(secondaryService.DurationMinutes, 0),
        primaryService.ServiceId,
        secondaryService.ServiceId,
        primaryService.Price,
        secondaryService.Price,
        ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, c.BusinessDate, t.EmployeeId, slot.SlotRank, N'CANDIDATE')))
    FROM #Calendar AS c
    CROSS JOIN #Technicians AS t
    CROSS JOIN #Slots AS slot
    CROSS APPLY
    (
        SELECT TOP (1)
            s.ServiceId,
            s.DurationMinutes,
            s.Price
        FROM dbo.EmployeeServices AS es
        JOIN dbo.Services AS s ON s.ServiceId = es.ServiceId
        WHERE es.EmployeeId = t.EmployeeId
          AND s.Status IN (N'ACTIVE', N'AVAILABLE')
          AND s.DurationMinutes BETWEEN 15 AND 165
        ORDER BY ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, c.BusinessDate, t.EmployeeId, slot.SlotRank, s.ServiceId)))
    ) AS primaryService
    OUTER APPLY
    (
        SELECT TOP (1)
            s2.ServiceId,
            s2.DurationMinutes,
            s2.Price
        FROM dbo.EmployeeServices AS es2
        JOIN dbo.Services AS s2 ON s2.ServiceId = es2.ServiceId
        WHERE es2.EmployeeId = t.EmployeeId
          AND s2.ServiceId <> primaryService.ServiceId
          AND s2.Status IN (N'ACTIVE', N'AVAILABLE')
          AND primaryService.DurationMinutes + s2.DurationMinutes <= 165
          AND ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, c.BusinessDate, t.EmployeeId, slot.SlotRank, N'SECOND'))) % 100 < 18
        ORDER BY ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, c.BusinessDate, t.EmployeeId, slot.SlotRank, s2.ServiceId, N'SECOND_SERVICE')))
    ) AS secondaryService
    WHERE NOT EXISTS
    (
        SELECT 1
        FROM dbo.Appointments AS existingAppointment
        WHERE existingAppointment.EmployeeId = t.EmployeeId
          AND existingAppointment.AppointmentDate = c.BusinessDate
          AND existingAppointment.Status NOT IN (N'CANCELLED', N'NO_SHOW')
          AND existingAppointment.StartTime < CONVERT(TIME, DATEADD(MINUTE,
                slot.StartMinute + primaryService.DurationMinutes + ISNULL(secondaryService.DurationMinutes, 0), 0))
          AND existingAppointment.EndTime > CONVERT(TIME, DATEADD(MINUTE, slot.StartMinute, 0))
    );

    IF EXISTS
    (
        SELECT c.BusinessDate
        FROM #Calendar AS c
        LEFT JOIN #CandidateOrders AS candidate ON candidate.BusinessDate = c.BusinessDate
        GROUP BY c.BusinessDate, c.TargetOrders
        HAVING COUNT(candidate.EmployeeId) < c.TargetOrders
    )
    BEGIN
        THROW 51007, N'Insufficient conflict-free technician capacity for one or more days.', 1;
    END;

    CREATE TABLE #Orders
    (
        SeedOrderNo INT NOT NULL PRIMARY KEY,
        BusinessDate DATE NOT NULL,
        EmployeeId INT NOT NULL,
        BranchId INT NOT NULL,
        CustomerId INT NOT NULL,
        CustomerUserId INT NOT NULL,
        PrimaryServiceId INT NOT NULL,
        SecondaryServiceId INT NULL,
        StartTime TIME NOT NULL,
        EndTime TIME NOT NULL,
        AppointmentStatus NVARCHAR(30) NOT NULL,
        PaymentMethod NVARCHAR(30) NOT NULL,
        PaymentStatus NVARCHAR(20) NOT NULL,
        InvoiceStatus NVARCHAR(20) NOT NULL,
        CreatedAt DATETIME NOT NULL,
        TotalAmount DECIMAL(18,2) NOT NULL,
        DiscountAmount DECIMAL(18,2) NOT NULL,
        FinalAmount DECIMAL(18,2) NOT NULL,
        TipAmount DECIMAL(18,2) NOT NULL,
        DemandType NVARCHAR(20) NOT NULL
    );

    ;WITH RankedCandidates AS
    (
        SELECT
            candidate.*,
            ROW_NUMBER() OVER
            (
                PARTITION BY candidate.BusinessDate
                ORDER BY candidate.CandidateScore, candidate.EmployeeId, candidate.SlotRank
            ) AS DailyRank
        FROM #CandidateOrders AS candidate
    ), SelectedCandidates AS
    (
        SELECT ranked.*
        FROM RankedCandidates AS ranked
        WHERE ranked.DailyRank <= ranked.TargetOrders
    ), NumberedOrders AS
    (
        SELECT
            ROW_NUMBER() OVER
            (
                ORDER BY selected.BusinessDate, selected.StartMinute, selected.EmployeeId
            ) AS SeedOrderNo,
            selected.*
        FROM SelectedCandidates AS selected
    ), ClassifiedOrders AS
    (
        SELECT
            numbered.*,
            ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, numbered.BusinessDate, numbered.EmployeeId, numbered.SlotRank, N'STATUS'))) % 100 AS StatusBucket,
            ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, numbered.BusinessDate, numbered.EmployeeId, numbered.SlotRank, N'PAYMENT'))) % 100 AS PaymentBucket,
            ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, numbered.BusinessDate, numbered.EmployeeId, numbered.SlotRank, N'DISCOUNT'))) % 100 AS DiscountBucket,
            ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, numbered.BusinessDate, numbered.EmployeeId, numbered.SlotRank, N'CUSTOMER'))) % @CustomerCount + 1 AS CustomerRank
        FROM NumberedOrders AS numbered
    ), StatusOrders AS
    (
        SELECT
            classified.*,
            CASE
                WHEN classified.BusinessDate >= DATEADD(DAY, -6, @EndDate) THEN
                    CASE
                        WHEN classified.StatusBucket < 62 THEN N'COMPLETED'
                        WHEN classified.StatusBucket < 74 THEN N'PENDING'
                        WHEN classified.StatusBucket < 84 THEN N'CONFIRMED'
                        WHEN classified.StatusBucket < 93 THEN N'CANCELLED'
                        WHEN classified.StatusBucket < 97 THEN N'NO_SHOW'
                        ELSE N'REFUND_PENDING'
                    END
                ELSE
                    CASE
                        WHEN classified.StatusBucket < 83 THEN N'COMPLETED'
                        WHEN classified.StatusBucket < 92 THEN N'CANCELLED'
                        WHEN classified.StatusBucket < 97 THEN N'NO_SHOW'
                        ELSE N'REFUND_PENDING'
                    END
            END AS AppointmentStatus
        FROM ClassifiedOrders AS classified
    ), FinancialOrders AS
    (
        SELECT
            statusOrder.*,
            CAST(statusOrder.PrimaryPrice + ISNULL(statusOrder.SecondaryPrice, 0) AS DECIMAL(18,2)) AS TotalAmount,
            CAST(CASE
                WHEN statusOrder.DiscountBucket < 10 THEN ROUND((statusOrder.PrimaryPrice + ISNULL(statusOrder.SecondaryPrice, 0)) * 0.10, -3)
                WHEN statusOrder.DiscountBucket < 15 THEN 50000
                ELSE 0
            END AS DECIMAL(18,2)) AS RawDiscount,
            CASE
                WHEN statusOrder.PaymentBucket < 42 THEN N'CASH'
                WHEN statusOrder.PaymentBucket < 75 THEN N'BANK_TRANSFER'
                ELSE N'CARD'
            END AS PaymentMethod
        FROM StatusOrders AS statusOrder
    )
    INSERT INTO #Orders
    (
        SeedOrderNo, BusinessDate, EmployeeId, BranchId, CustomerId, CustomerUserId,
        PrimaryServiceId, SecondaryServiceId, StartTime, EndTime, AppointmentStatus,
        PaymentMethod, PaymentStatus, InvoiceStatus, CreatedAt,
        TotalAmount, DiscountAmount, FinalAmount, TipAmount, DemandType
    )
    SELECT
        financial.SeedOrderNo,
        financial.BusinessDate,
        financial.EmployeeId,
        financial.BranchId,
        customer.CustomerId,
        customer.UserId,
        financial.PrimaryServiceId,
        financial.SecondaryServiceId,
        CONVERT(TIME, DATEADD(MINUTE, financial.StartMinute, 0)),
        CONVERT(TIME, DATEADD(MINUTE, financial.EndMinute, 0)),
        financial.AppointmentStatus,
        financial.PaymentMethod,
        CASE
            WHEN financial.AppointmentStatus = N'COMPLETED' THEN N'PAID'
            WHEN financial.AppointmentStatus = N'REFUND_PENDING' THEN N'REFUND_PENDING'
            WHEN financial.AppointmentStatus IN (N'PENDING', N'CONFIRMED') THEN N'PENDING'
            WHEN financial.AppointmentStatus = N'NO_SHOW' AND financial.PaymentBucket % 2 = 0 THEN N'PAID'
            ELSE N'FAILED'
        END,
        CASE
            WHEN financial.AppointmentStatus IN (N'COMPLETED', N'NO_SHOW')
                 AND NOT (financial.AppointmentStatus = N'NO_SHOW' AND financial.PaymentBucket % 2 = 1) THEN N'PAID'
            WHEN financial.AppointmentStatus = N'REFUND_PENDING' THEN N'REFUND_PENDING'
            WHEN financial.AppointmentStatus = N'CANCELLED' THEN N'CANCELLED'
            ELSE N'UNPAID'
        END,
        DATEADD
        (
            HOUR,
            9 + CONVERT(INT, ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, financial.SeedOrderNo, N'CREATED_HOUR'))) % 10),
            CAST
            (
                CASE
                    WHEN DATEADD(DAY, -(1 + financial.SeedOrderNo % 14), financial.BusinessDate) < @StartDate THEN @StartDate
                    ELSE DATEADD(DAY, -(1 + financial.SeedOrderNo % 14), financial.BusinessDate)
                END AS DATETIME
            )
        ),
        financial.TotalAmount,
        CASE WHEN financial.RawDiscount > financial.TotalAmount THEN 0 ELSE financial.RawDiscount END,
        financial.TotalAmount - CASE WHEN financial.RawDiscount > financial.TotalAmount THEN 0 ELSE financial.RawDiscount END,
        CAST(CASE
            WHEN financial.AppointmentStatus = N'COMPLETED' AND financial.SeedOrderNo % 14 = 0
                THEN CASE financial.SeedOrderNo % 3 WHEN 0 THEN 20000 WHEN 1 THEN 50000 ELSE 100000 END
            ELSE 0
        END AS DECIMAL(18,2)),
        CASE
            WHEN calendar.IsHoliday = 1 THEN N'HOLIDAY'
            WHEN calendar.IsWeekend = 1 THEN N'WEEKEND'
            WHEN calendar.IsPeakSeason = 1 THEN N'PEAK_SEASON'
            ELSE N'NORMAL'
        END
    FROM FinancialOrders AS financial
    JOIN #Customers AS customer ON customer.CustomerRank = financial.CustomerRank
    JOIN #Calendar AS calendar ON calendar.BusinessDate = financial.BusinessDate;

    CREATE TABLE #InsertedAppointments
    (
        SeedOrderNo INT NOT NULL PRIMARY KEY,
        AppointmentId INT NOT NULL UNIQUE
    );

    MERGE dbo.Appointments AS target
    USING #Orders AS source
      ON 1 = 0
    WHEN NOT MATCHED THEN
      INSERT
      (
          CustomerId, EmployeeId, BranchId, ResourceId, CustomerPackageId,
          AppointmentDate, StartTime, EndTime, Status, Notes, CancelReason,
          CheckedInAt, CheckedOutAt, CompletedAt, CreatedAt, UpdatedAt
      )
      VALUES
      (
          source.CustomerId,
          source.EmployeeId,
          source.BranchId,
          NULL,
          NULL,
          source.BusinessDate,
          source.StartTime,
          source.EndTime,
          source.AppointmentStatus,
          CONCAT(N'[#', @BatchCode, N'] ', source.DemandType, N' · ',
                 CASE source.SeedOrderNo % 3 WHEN 0 THEN N'Website' WHEN 1 THEN N'Điện thoại' ELSE N'Tại quầy' END),
          CASE source.AppointmentStatus
              WHEN N'CANCELLED' THEN CASE source.SeedOrderNo % 3
                  WHEN 0 THEN N'Khách thay đổi kế hoạch'
                  WHEN 1 THEN N'Không sắp xếp được thời gian'
                  ELSE N'Đặt nhầm lịch'
              END
              WHEN N'REFUND_PENDING' THEN N'Khách yêu cầu hoàn tiền sau khi thanh toán'
              ELSE NULL
          END,
          CASE WHEN source.AppointmentStatus IN (N'COMPLETED', N'NO_SHOW')
               THEN DATEADD(MINUTE, -5, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.StartTime), CAST(source.BusinessDate AS DATETIME)))
               ELSE NULL END,
          CASE WHEN source.AppointmentStatus = N'COMPLETED'
               THEN DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.EndTime), CAST(source.BusinessDate AS DATETIME))
               ELSE NULL END,
          CASE WHEN source.AppointmentStatus = N'COMPLETED'
               THEN DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.EndTime), CAST(source.BusinessDate AS DATETIME))
               ELSE NULL END,
          source.CreatedAt,
          CASE WHEN source.AppointmentStatus IN (N'PENDING', N'CONFIRMED') THEN NULL
               ELSE DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.EndTime), CAST(source.BusinessDate AS DATETIME)) END
      )
    OUTPUT source.SeedOrderNo, inserted.AppointmentId
      INTO #InsertedAppointments (SeedOrderNo, AppointmentId);

    INSERT INTO dbo.AppointmentServices (AppointmentId, ServiceId, Price)
    SELECT insertedAppointment.AppointmentId, orders.PrimaryServiceId, service.Price
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    JOIN dbo.Services AS service ON service.ServiceId = orders.PrimaryServiceId;

    INSERT INTO dbo.AppointmentServices (AppointmentId, ServiceId, Price)
    SELECT insertedAppointment.AppointmentId, orders.SecondaryServiceId, service.Price
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    JOIN dbo.Services AS service ON service.ServiceId = orders.SecondaryServiceId
    WHERE orders.SecondaryServiceId IS NOT NULL;

    /* Full lifecycle history keeps status analytics and audit views synchronized. */
    INSERT INTO dbo.AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    SELECT
        insertedAppointment.AppointmentId,
        NULL,
        N'PENDING',
        orders.CustomerUserId,
        N'Khách tạo lịch hẹn',
        orders.CreatedAt
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo;

    INSERT INTO dbo.AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    SELECT
        insertedAppointment.AppointmentId,
        N'PENDING',
        CASE
            WHEN orders.AppointmentStatus IN (N'COMPLETED', N'NO_SHOW', N'REFUND_PENDING') THEN N'CONFIRMED'
            ELSE orders.AppointmentStatus
        END,
        @SystemUserId,
        N'Xác nhận trạng thái lịch hẹn',
        DATEADD(MINUTE, 30, orders.CreatedAt)
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus <> N'PENDING';

    INSERT INTO dbo.AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    SELECT
        insertedAppointment.AppointmentId,
        N'CONFIRMED',
        N'CHECKED_IN',
        @SystemUserId,
        N'Khách đã đến salon',
        DATEADD(MINUTE, -5, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.StartTime), CAST(orders.BusinessDate AS DATETIME)))
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus = N'COMPLETED';

    INSERT INTO dbo.AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    SELECT
        insertedAppointment.AppointmentId,
        N'CHECKED_IN',
        N'IN_PROGRESS',
        @SystemUserId,
        N'Bắt đầu thực hiện dịch vụ',
        DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.StartTime), CAST(orders.BusinessDate AS DATETIME))
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus = N'COMPLETED';

    INSERT INTO dbo.AppointmentStatusHistory
        (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason, ChangedAt)
    SELECT
        insertedAppointment.AppointmentId,
        CASE orders.AppointmentStatus WHEN N'COMPLETED' THEN N'IN_PROGRESS' ELSE N'CONFIRMED' END,
        orders.AppointmentStatus,
        @SystemUserId,
        CASE orders.AppointmentStatus
            WHEN N'COMPLETED' THEN N'Hoàn tất dịch vụ'
            WHEN N'NO_SHOW' THEN N'Khách không đến theo lịch'
            WHEN N'REFUND_PENDING' THEN N'Đang xử lý yêu cầu hoàn tiền'
            ELSE N'Cập nhật trạng thái cuối'
        END,
        CASE
            WHEN orders.AppointmentStatus = N'COMPLETED'
                THEN DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.EndTime), CAST(orders.BusinessDate AS DATETIME))
            ELSE DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.StartTime), CAST(orders.BusinessDate AS DATETIME))
        END
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus IN (N'COMPLETED', N'NO_SHOW', N'REFUND_PENDING');

    CREATE TABLE #InsertedInvoices
    (
        SeedOrderNo INT NOT NULL PRIMARY KEY,
        InvoiceId INT NOT NULL UNIQUE
    );

    MERGE dbo.Invoices AS target
    USING
    (
        SELECT orders.*, insertedAppointment.AppointmentId
        FROM #Orders AS orders
        JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    ) AS source
      ON 1 = 0
    WHEN NOT MATCHED THEN
      INSERT
      (
          AppointmentId, VoucherId, TotalAmount, DiscountAmount, FinalAmount, Status,
          TechnicianCommissionRate, TechnicianCommissionAmount, TechnicianTipAmount,
          CreatedAt, UpdatedAt
      )
      VALUES
      (
          source.AppointmentId,
          NULL,
          source.TotalAmount,
          source.DiscountAmount,
          source.FinalAmount,
          source.InvoiceStatus,
          30.00,
          CASE WHEN source.InvoiceStatus IN (N'PAID', N'REFUND_PENDING') THEN source.FinalAmount * 0.30 ELSE 0 END,
          source.TipAmount,
          source.CreatedAt,
          CASE WHEN source.InvoiceStatus IN (N'PAID', N'REFUND_PENDING', N'CANCELLED')
               THEN DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.EndTime), CAST(source.BusinessDate AS DATETIME))
               ELSE NULL END
      )
    OUTPUT source.SeedOrderNo, inserted.InvoiceId
      INTO #InsertedInvoices (SeedOrderNo, InvoiceId);

    CREATE TABLE #InsertedPayments
    (
        SeedOrderNo INT NOT NULL PRIMARY KEY,
        PaymentId INT NOT NULL UNIQUE
    );

    MERGE dbo.Payments AS target
    USING
    (
        SELECT orders.*, insertedInvoice.InvoiceId
        FROM #Orders AS orders
        JOIN #InsertedInvoices AS insertedInvoice ON insertedInvoice.SeedOrderNo = orders.SeedOrderNo
    ) AS source
      ON 1 = 0
    WHEN NOT MATCHED THEN
      INSERT
      (
          InvoiceId, Amount, PaymentMethod, Status, TransactionCode,
          VnpTxnRef, VnpTransactionNo, VnpResponseCode, PaidAt, CreatedAt
      )
      VALUES
      (
          source.InvoiceId,
          source.FinalAmount,
          source.PaymentMethod,
          source.PaymentStatus,
          CONCAT(N'R1Y-', CONVERT(CHAR(8), source.BusinessDate, 112), N'-', RIGHT(N'000000' + CONVERT(NVARCHAR(6), source.SeedOrderNo), 6)),
          NULL,
          NULL,
          CASE WHEN source.PaymentStatus IN (N'PAID', N'REFUND_PENDING') THEN N'00'
               WHEN source.PaymentStatus = N'FAILED' THEN N'24' ELSE NULL END,
          CASE WHEN source.PaymentStatus IN (N'PAID', N'REFUND_PENDING')
               THEN DATEADD(MINUTE, -15, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, source.StartTime), CAST(source.BusinessDate AS DATETIME)))
               ELSE NULL END,
          source.CreatedAt
      )
    OUTPUT source.SeedOrderNo, inserted.PaymentId
      INTO #InsertedPayments (SeedOrderNo, PaymentId);

    INSERT INTO dbo.Refunds
        (PaymentId, RefundAmount, Reason, Status, RefundedAt, CreatedAt)
    SELECT
        insertedPayment.PaymentId,
        orders.FinalAmount,
        N'Khách yêu cầu hoàn tiền cho lịch đã thanh toán',
        CASE WHEN orders.SeedOrderNo % 3 = 0 THEN N'APPROVED' ELSE N'PENDING' END,
        NULL,
        DATEADD(HOUR, 2, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.StartTime), CAST(orders.BusinessDate AS DATETIME)))
    FROM #Orders AS orders
    JOIN #InsertedPayments AS insertedPayment ON insertedPayment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus = N'REFUND_PENDING';

    /* Reviews: weighted toward 4-5 stars, with moderation states and responses. */
    INSERT INTO dbo.Reviews
    (
        CustomerId, AppointmentId, ServiceId, EmployeeId, Rating, TechnicianRating,
        Comment, Status, AdminResponse, CreatedAt, UpdatedAt
    )
    SELECT
        orders.CustomerId,
        insertedAppointment.AppointmentId,
        orders.PrimaryServiceId,
        orders.EmployeeId,
        rating.Rating,
        CASE
            WHEN rating.Rating = 1 THEN 2
            WHEN rating.Rating = 5 THEN 5
            ELSE rating.Rating + CASE WHEN orders.SeedOrderNo % 4 = 0 THEN 1 ELSE 0 END
        END,
        CASE rating.Rating
            WHEN 5 THEN CASE orders.SeedOrderNo % 4
                WHEN 0 THEN N'Dịch vụ rất tốt, kỹ thuật viên tận tâm và đúng giờ.'
                WHEN 1 THEN N'Không gian sạch đẹp, quy trình chuyên nghiệp, tôi rất hài lòng.'
                WHEN 2 THEN N'Kết quả vượt mong đợi, sẽ tiếp tục quay lại.'
                ELSE N'Tư vấn rõ ràng, thao tác nhẹ nhàng và chu đáo.'
            END
            WHEN 4 THEN N'Trải nghiệm tốt, nhân viên thân thiện và dịch vụ đúng mô tả.'
            WHEN 3 THEN N'Dịch vụ ổn, thời gian chờ có thể cải thiện thêm.'
            WHEN 2 THEN N'Kết quả chưa như mong đợi, cần được tư vấn kỹ hơn.'
            ELSE N'Trải nghiệm chưa tốt, mong salon liên hệ hỗ trợ.'
        END,
        CASE
            WHEN rating.Rating <= 2 AND orders.SeedOrderNo % 2 = 0 THEN N'HIDDEN'
            WHEN orders.SeedOrderNo % 20 = 0 THEN N'PENDING'
            ELSE N'APPROVED'
        END,
        CASE WHEN orders.SeedOrderNo % 3 = 0
             THEN N'Cảm ơn quý khách đã đánh giá. Salon đã ghi nhận phản hồi để cải thiện chất lượng phục vụ.'
             ELSE NULL END,
        DATEADD
        (
            DAY,
            1 + orders.SeedOrderNo % 3,
            DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.EndTime), CAST(orders.BusinessDate AS DATETIME))
        ),
        CASE WHEN orders.SeedOrderNo % 3 = 0
             THEN DATEADD(DAY, 2 + orders.SeedOrderNo % 3,
                    DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.EndTime), CAST(orders.BusinessDate AS DATETIME)))
             ELSE NULL END
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    CROSS APPLY
    (
        SELECT CASE
            WHEN ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, orders.SeedOrderNo, N'RATING'))) % 100 < 55 THEN 5
            WHEN ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, orders.SeedOrderNo, N'RATING'))) % 100 < 85 THEN 4
            WHEN ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, orders.SeedOrderNo, N'RATING'))) % 100 < 95 THEN 3
            WHEN ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, orders.SeedOrderNo, N'RATING'))) % 100 < 99 THEN 2
            ELSE 1
        END AS Rating
    ) AS rating
    WHERE orders.AppointmentStatus = N'COMPLETED'
      AND orders.BusinessDate <= DATEADD(DAY, -3, @EndDate)
      AND ABS(CONVERT(BIGINT, CHECKSUM(@BatchCode, orders.SeedOrderNo, N'REVIEW'))) % 100 < 62;

    INSERT INTO dbo.Feedbacks
        (CustomerId, Subject, Content, Status, AdminResponse, CreatedAt, UpdatedAt)
    SELECT
        orders.CustomerId,
        CASE orders.SeedOrderNo % 4
            WHEN 0 THEN N'Góp ý về thời gian phục vụ'
            WHEN 1 THEN N'Góp ý về trải nghiệm tại salon'
            WHEN 2 THEN N'Đề xuất dịch vụ mới'
            ELSE N'Cần hỗ trợ sau liệu trình'
        END,
        CONCAT(N'[#', @BatchCode, N'] ', CASE orders.SeedOrderNo % 4
            WHEN 0 THEN N'Mong salon tối ưu thời gian chờ vào giờ cao điểm.'
            WHEN 1 THEN N'Nhân viên tư vấn nhiệt tình, khu vực tiếp đón có thể bổ sung thêm chỗ ngồi.'
            WHEN 2 THEN N'Mong salon bổ sung thêm lựa chọn chăm sóc chuyên sâu.'
            ELSE N'Tôi cần được hướng dẫn thêm về chăm sóc tại nhà sau dịch vụ.'
        END),
        CASE orders.SeedOrderNo % 10
            WHEN 0 THEN N'PENDING'
            WHEN 1 THEN N'PROCESSING'
            ELSE N'RESOLVED'
        END,
        CASE WHEN orders.SeedOrderNo % 10 IN (0, 1) THEN NULL
             ELSE N'Salon đã tiếp nhận và xử lý phản hồi. Cảm ơn quý khách.' END,
        DATEADD(DAY, 1, CAST(orders.BusinessDate AS DATETIME)),
        CASE WHEN orders.SeedOrderNo % 10 IN (0, 1) THEN NULL
             ELSE DATEADD(DAY, 2, CAST(orders.BusinessDate AS DATETIME)) END
    FROM #Orders AS orders
    WHERE orders.AppointmentStatus = N'COMPLETED'
      AND orders.SeedOrderNo % 25 = 0;

    INSERT INTO dbo.TreatmentNotes
    (
        AppointmentId, EmployeeId, Title, Content, NoteType, ProductsUsed,
        SkinCondition, Technique, CustomerFeedback, Recommendation, FollowUpDate,
        ProgressStatus, PersonalNotes, SpecialNotice, CreatedAt, UpdatedAt
    )
    SELECT
        insertedAppointment.AppointmentId,
        orders.EmployeeId,
        N'Ghi nhận sau dịch vụ',
        N'Đã thực hiện đầy đủ quy trình dịch vụ và kiểm tra phản ứng của khách hàng.',
        N'TREATMENT',
        CASE orders.SeedOrderNo % 3
            WHEN 0 THEN N'Sản phẩm làm sạch, serum phục hồi'
            WHEN 1 THEN N'Dầu dưỡng, kem bảo vệ'
            ELSE N'Sản phẩm chuyên dụng theo dịch vụ'
        END,
        CASE orders.SeedOrderNo % 3 WHEN 0 THEN N'Ổn định' WHEN 1 THEN N'Nhạy cảm nhẹ' ELSE N'Cần cấp ẩm' END,
        N'Thực hiện đúng quy trình kỹ thuật của dịch vụ',
        N'Khách phản hồi dễ chịu sau khi hoàn tất',
        N'Duy trì chăm sóc tại nhà và tái khám theo lịch tư vấn',
        DATEADD(DAY, 30, orders.BusinessDate),
        CASE WHEN orders.SeedOrderNo % 5 = 0 THEN N'FOLLOW_UP_REQUIRED' ELSE N'COMPLETED' END,
        CONCAT(N'Batch ', @BatchCode),
        CASE WHEN orders.SeedOrderNo % 17 = 0 THEN N'Lưu ý theo dõi phản ứng trong 24 giờ đầu' ELSE NULL END,
        DATEADD(MINUTE, 10, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.EndTime), CAST(orders.BusinessDate AS DATETIME))),
        NULL
    FROM #Orders AS orders
    JOIN #InsertedAppointments AS insertedAppointment ON insertedAppointment.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus = N'COMPLETED'
      AND orders.SeedOrderNo % 3 = 0;

    INSERT INTO dbo.TechnicianPayoutLedger
        (EmployeeId, ReferenceType, ReferenceId, Amount, EntryType, Description, CreatedAt)
    SELECT
        orders.EmployeeId,
        N'INVOICE',
        insertedInvoice.InvoiceId,
        CAST(orders.FinalAmount * 0.30 AS DECIMAL(18,2)),
        N'EARNING',
        CONCAT(N'Hoa hồng 30% · ', @BatchCode),
        DATEADD(MINUTE, 15, DATEADD(MINUTE, DATEDIFF(MINUTE, 0, orders.EndTime), CAST(orders.BusinessDate AS DATETIME)))
    FROM #Orders AS orders
    JOIN #InsertedInvoices AS insertedInvoice ON insertedInvoice.SeedOrderNo = orders.SeedOrderNo
    WHERE orders.AppointmentStatus = N'COMPLETED'
      AND orders.PaymentStatus = N'PAID';

    /* Recalculate monthly KPI from normalized source-of-truth tables. */
    IF EXISTS
    (
        SELECT EmployeeId, [Year], [Month]
        FROM dbo.EmployeePerformance
        GROUP BY EmployeeId, [Year], [Month]
        HAVING COUNT(*) > 1
    )
    BEGIN
        THROW 51008, N'EmployeePerformance contains duplicate employee/month rows. Repair duplicates before seeding.', 1;
    END;

    IF NOT EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.EmployeePerformance')
          AND name = N'UX_EmployeePerformance_Employee_Year_Month'
    )
    BEGIN
        CREATE UNIQUE INDEX UX_EmployeePerformance_Employee_Year_Month
            ON dbo.EmployeePerformance(EmployeeId, [Year], [Month]);
    END;

    ;WITH AppointmentFacts AS
    (
        SELECT
            appointment.EmployeeId,
            YEAR(appointment.AppointmentDate) AS PerformanceYear,
            MONTH(appointment.AppointmentDate) AS PerformanceMonth,
            COUNT(*) AS TotalAppointments,
            SUM(CASE WHEN appointment.Status = N'COMPLETED' THEN 1 ELSE 0 END) AS CompletedAppointments,
            SUM(CASE WHEN appointment.Status IN (N'CANCELLED', N'NO_SHOW') THEN 1 ELSE 0 END) AS CancelledAppointments,
            SUM(CASE WHEN invoice.Status = N'PAID' THEN invoice.FinalAmount ELSE 0 END) AS Revenue
        FROM dbo.Appointments AS appointment
        JOIN #Technicians AS technician ON technician.EmployeeId = appointment.EmployeeId
        LEFT JOIN dbo.Invoices AS invoice ON invoice.AppointmentId = appointment.AppointmentId
        WHERE appointment.AppointmentDate BETWEEN @StartDate AND @EndDate
        GROUP BY appointment.EmployeeId, YEAR(appointment.AppointmentDate), MONTH(appointment.AppointmentDate)
    ), ReviewFacts AS
    (
        SELECT
            appointment.EmployeeId,
            YEAR(appointment.AppointmentDate) AS PerformanceYear,
            MONTH(appointment.AppointmentDate) AS PerformanceMonth,
            CAST(AVG(CAST(review.TechnicianRating AS DECIMAL(10,2))) AS DECIMAL(3,2)) AS AverageRating
        FROM dbo.Reviews AS review
        JOIN dbo.Appointments AS appointment ON appointment.AppointmentId = review.AppointmentId
        JOIN #Technicians AS technician ON technician.EmployeeId = appointment.EmployeeId
        WHERE appointment.AppointmentDate BETWEEN @StartDate AND @EndDate
          AND review.Status = N'APPROVED'
        GROUP BY appointment.EmployeeId, YEAR(appointment.AppointmentDate), MONTH(appointment.AppointmentDate)
    ), MonthlyPerformance AS
    (
        SELECT
            appointmentFacts.EmployeeId,
            appointmentFacts.PerformanceMonth,
            appointmentFacts.PerformanceYear,
            appointmentFacts.TotalAppointments,
            appointmentFacts.CompletedAppointments,
            appointmentFacts.CancelledAppointments,
            reviewFacts.AverageRating,
            appointmentFacts.Revenue
        FROM AppointmentFacts AS appointmentFacts
        LEFT JOIN ReviewFacts AS reviewFacts
          ON reviewFacts.EmployeeId = appointmentFacts.EmployeeId
         AND reviewFacts.PerformanceYear = appointmentFacts.PerformanceYear
         AND reviewFacts.PerformanceMonth = appointmentFacts.PerformanceMonth
    )
    MERGE dbo.EmployeePerformance WITH (HOLDLOCK) AS target
    USING MonthlyPerformance AS source
      ON target.EmployeeId = source.EmployeeId
     AND target.[Year] = source.PerformanceYear
     AND target.[Month] = source.PerformanceMonth
    WHEN MATCHED THEN
      UPDATE SET
          TotalAppointments = source.TotalAppointments,
          CompletedAppointments = source.CompletedAppointments,
          CancelledAppointments = source.CancelledAppointments,
          AverageRating = source.AverageRating,
          Revenue = source.Revenue
    WHEN NOT MATCHED THEN
      INSERT
      (
          EmployeeId, TotalAppointments, CompletedAppointments, CancelledAppointments,
          AverageRating, Revenue, [Month], [Year]
      )
      VALUES
      (
          source.EmployeeId, source.TotalAppointments, source.CompletedAppointments,
          source.CancelledAppointments, source.AverageRating, source.Revenue,
          source.PerformanceMonth, source.PerformanceYear
      );

    INSERT INTO dbo.SystemLogs
    (
        UserId, RoleName, ActionName, ActionType, Description,
        IpAddress, OldValue, NewValue, CreatedAt
    )
    VALUES
    (
        @SystemUserId,
        N'ADMIN',
        N'REALISTIC_ONE_YEAR_SEED',
        N'DATA_SEED',
        N'Tạo bộ dữ liệu vận hành 12 tháng đã chuẩn hóa cho báo cáo nội bộ.',
        N'127.0.0.1',
        NULL,
        CONCAT
        (
            N'{"batchCode":"', @BatchCode,
            N'","startDate":"', CONVERT(CHAR(10), @StartDate, 23),
            N'","endDate":"', CONVERT(CHAR(10), @EndDate, 23),
            N'","orders":', (SELECT COUNT(*) FROM #Orders),
            N'}'
        ),
        GETDATE()
    );

    /* Validation: every inserted appointment must have services, invoice and payment. */
    IF EXISTS
    (
        SELECT 1
        FROM #InsertedAppointments AS insertedAppointment
        LEFT JOIN dbo.AppointmentServices AS appointmentService
          ON appointmentService.AppointmentId = insertedAppointment.AppointmentId
        LEFT JOIN dbo.Invoices AS invoice
          ON invoice.AppointmentId = insertedAppointment.AppointmentId
        LEFT JOIN dbo.Payments AS payment
          ON payment.InvoiceId = invoice.InvoiceId
        GROUP BY insertedAppointment.AppointmentId
        HAVING COUNT(DISTINCT appointmentService.AppointmentServiceId) = 0
            OR COUNT(DISTINCT invoice.InvoiceId) <> 1
            OR COUNT(DISTINCT payment.PaymentId) <> 1
    )
    BEGIN
        THROW 51009, N'Generated order graph is incomplete.', 1;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM #Orders
        WHERE FinalAmount < 0 OR DiscountAmount < 0 OR DiscountAmount > TotalAmount
    )
    BEGIN
        THROW 51010, N'Generated financial totals are invalid.', 1;
    END;

    /* Result set 1: execution summary. */
    SELECT
        CASE WHEN @DryRun = 1 THEN N'DRY_RUN_WILL_ROLL_BACK' ELSE N'COMMIT_READY' END AS ExecutionStatus,
        @BatchCode AS BatchCode,
        @StartDate AS StartDate,
        @EndDate AS EndDate,
        DATEDIFF(DAY, @StartDate, @EndDate) + 1 AS CalendarDays,
        COUNT(*) AS Orders,
        SUM(CASE WHEN SecondaryServiceId IS NOT NULL THEN 1 ELSE 0 END) AS MultiServiceOrders,
        SUM(CASE WHEN AppointmentStatus = N'COMPLETED' THEN 1 ELSE 0 END) AS CompletedOrders,
        SUM(CASE WHEN AppointmentStatus IN (N'PENDING', N'CONFIRMED') THEN 1 ELSE 0 END) AS PendingOrders,
        SUM(CASE WHEN AppointmentStatus = N'CANCELLED' THEN 1 ELSE 0 END) AS CancelledOrders,
        CAST(SUM(CASE WHEN PaymentStatus = N'PAID' THEN FinalAmount ELSE 0 END) AS DECIMAL(18,2)) AS PaidRevenue
    FROM #Orders;

    /* Result set 2: verifies required natural daily distribution. */
    SELECT
        CASE WHEN calendar.IsHighDemand = 1 THEN N'HIGH_DEMAND' ELSE N'NORMAL_WEEKDAY' END AS DemandGroup,
        COUNT(*) AS Days,
        MIN(calendar.TargetOrders) AS MinimumOrdersPerDay,
        MAX(calendar.TargetOrders) AS MaximumOrdersPerDay,
        SUM(calendar.TargetOrders) AS TotalOrders
    FROM #Calendar AS calendar
    GROUP BY calendar.IsHighDemand
    ORDER BY calendar.IsHighDemand;

    /* Result set 3: status distribution. */
    SELECT AppointmentStatus, COUNT(*) AS Orders
    FROM #Orders
    GROUP BY AppointmentStatus
    ORDER BY Orders DESC, AppointmentStatus;

    /* Result set 4: payment distribution. */
    SELECT PaymentMethod, PaymentStatus, COUNT(*) AS Payments, SUM(FinalAmount) AS Amount
    FROM #Orders
    GROUP BY PaymentMethod, PaymentStatus
    ORDER BY PaymentMethod, PaymentStatus;

    /* Result set 5: synchronized related records. */
    SELECT
        (SELECT COUNT(*) FROM #InsertedAppointments) AS Appointments,
        (SELECT COUNT(*)
         FROM dbo.AppointmentServices AS service
         JOIN #InsertedAppointments AS appointment ON appointment.AppointmentId = service.AppointmentId) AS AppointmentServices,
        (SELECT COUNT(*) FROM #InsertedInvoices) AS Invoices,
        (SELECT COUNT(*) FROM #InsertedPayments) AS Payments,
        (SELECT COUNT(*)
         FROM dbo.Refunds AS refund
         JOIN #InsertedPayments AS payment ON payment.PaymentId = refund.PaymentId) AS Refunds,
        (SELECT COUNT(*)
         FROM dbo.Reviews AS review
         JOIN #InsertedAppointments AS appointment ON appointment.AppointmentId = review.AppointmentId) AS Reviews,
        (SELECT COUNT(*) FROM dbo.Feedbacks WHERE Content LIKE N'%[#' + @BatchCode + N']%') AS Feedbacks,
        (SELECT COUNT(*)
         FROM dbo.TreatmentNotes AS note
         JOIN #InsertedAppointments AS appointment ON appointment.AppointmentId = note.AppointmentId) AS TreatmentNotes,
        (SELECT COUNT(*)
         FROM dbo.TechnicianPayoutLedger AS ledger
         JOIN #InsertedInvoices AS invoice ON invoice.InvoiceId = ledger.ReferenceId
         WHERE ledger.ReferenceType = N'INVOICE') AS PayoutLedgerEntries;

    IF @DryRun = 1
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT N'DRY_RUN_ROLLED_BACK' AS FinalStatus;
    END
    ELSE
    BEGIN
        COMMIT TRANSACTION;
        SELECT N'COMMITTED' AS FinalStatus, @BatchCode AS BatchCode;
    END;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
