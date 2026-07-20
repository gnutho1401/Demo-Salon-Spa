USE [BeautySalonSystem1];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/*
    Part 1 - Repair invoice state from confirmed PAID payments.
    This script is idempotent: a second run updates zero invoices.
    It intentionally does not touch REFUNDED/REFUND_PENDING/CANCELLED invoices.
*/
DECLARE @UpdatedInvoices TABLE
(
    InvoiceId INT PRIMARY KEY,
    PreviousStatus NVARCHAR(20) NOT NULL,
    NewStatus NVARCHAR(20) NOT NULL,
    UpdatedAt DATETIME NOT NULL
);

BEGIN TRY
    BEGIN TRANSACTION;

    UPDATE invoice
       SET invoice.Status = N'PAID',
           invoice.UpdatedAt = GETDATE()
    OUTPUT
        inserted.InvoiceId,
        deleted.Status,
        inserted.Status,
        inserted.UpdatedAt
    INTO @UpdatedInvoices(InvoiceId, PreviousStatus, NewStatus, UpdatedAt)
    FROM dbo.Invoices AS invoice
    WHERE invoice.Status = N'UNPAID'
      AND EXISTS
      (
          SELECT 1
          FROM dbo.Payments AS payment
          WHERE payment.InvoiceId = invoice.InvoiceId
            AND payment.Status = N'PAID'
      );

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT
    N'UPDATED_INVOICE' AS ResultType,
    InvoiceId,
    PreviousStatus,
    NewStatus,
    UpdatedAt
FROM @UpdatedInvoices
ORDER BY InvoiceId;

SELECT
    N'UPDATED_INVOICE_COUNT' AS Metric,
    COUNT(*) AS Value
FROM @UpdatedInvoices;

SELECT
    N'REMAINING_PAID_PAYMENT_UNPAID_INVOICE' AS Metric,
    COUNT(DISTINCT invoice.InvoiceId) AS Value
FROM dbo.Invoices AS invoice
WHERE invoice.Status = N'UNPAID'
  AND EXISTS
  (
      SELECT 1
      FROM dbo.Payments AS payment
      WHERE payment.InvoiceId = invoice.InvoiceId
        AND payment.Status = N'PAID'
  );

/*
    Part 2 - List duplicate active appointment rows for manual resolution.
    Duplicate key follows the existing data-quality rule:
    Customer + Technician + Date + Start + End, excluding CANCELLED/NO_SHOW.
    DuplicateRank = 1 is the canonical row; this report returns only rank > 1.
*/
;WITH RankedAppointments AS
(
    SELECT
        appointment.AppointmentId,
        appointment.CustomerId,
        appointment.EmployeeId,
        appointment.BranchId,
        appointment.AppointmentDate,
        appointment.StartTime,
        appointment.EndTime,
        appointment.Status,
        appointment.CreatedAt,
        FIRST_VALUE(appointment.AppointmentId) OVER
        (
            PARTITION BY
                appointment.CustomerId,
                appointment.EmployeeId,
                appointment.AppointmentDate,
                appointment.StartTime,
                appointment.EndTime
            ORDER BY
                CASE appointment.Status
                    WHEN N'COMPLETED' THEN 1
                    WHEN N'IN_PROGRESS' THEN 2
                    WHEN N'CHECKED_IN' THEN 3
                    WHEN N'CONFIRMED' THEN 4
                    ELSE 5
                END,
                appointment.CreatedAt,
                appointment.AppointmentId
        ) AS CanonicalAppointmentId,
        ROW_NUMBER() OVER
        (
            PARTITION BY
                appointment.CustomerId,
                appointment.EmployeeId,
                appointment.AppointmentDate,
                appointment.StartTime,
                appointment.EndTime
            ORDER BY
                CASE appointment.Status
                    WHEN N'COMPLETED' THEN 1
                    WHEN N'IN_PROGRESS' THEN 2
                    WHEN N'CHECKED_IN' THEN 3
                    WHEN N'CONFIRMED' THEN 4
                    ELSE 5
                END,
                appointment.CreatedAt,
                appointment.AppointmentId
        ) AS DuplicateRank
    FROM dbo.Appointments AS appointment
    WHERE appointment.Status NOT IN (N'CANCELLED', N'NO_SHOW')
)
SELECT
    ranked.AppointmentId,
    ranked.CanonicalAppointmentId,
    ranked.DuplicateRank,
    ranked.CustomerId,
    customerUser.FullName AS CustomerName,
    ranked.EmployeeId,
    technicianUser.FullName AS TechnicianName,
    ranked.BranchId,
    ranked.AppointmentDate,
    ranked.StartTime,
    ranked.EndTime,
    ranked.Status,
    ranked.CreatedAt,
    (SELECT COUNT(*) FROM dbo.AppointmentStatusHistory history
      WHERE history.AppointmentId = ranked.AppointmentId) AS StatusHistoryCount,
    (SELECT COUNT(*) FROM dbo.AppointmentServices service
      WHERE service.AppointmentId = ranked.AppointmentId) AS ServiceCount,
    (SELECT COUNT(*) FROM dbo.Invoices invoice
      WHERE invoice.AppointmentId = ranked.AppointmentId) AS InvoiceCount,
    (SELECT COUNT(*) FROM dbo.PackageSessions session
      WHERE session.linked_appointment_id = ranked.AppointmentId) AS PackageSessionCount,
    (SELECT COUNT(*) FROM dbo.Reviews review
      WHERE review.AppointmentId = ranked.AppointmentId) AS ReviewCount,
    (SELECT COUNT(*) FROM dbo.TreatmentNotes note
      WHERE note.AppointmentId = ranked.AppointmentId) AS TreatmentNoteCount,
    (SELECT COUNT(*) FROM dbo.TreatmentNotesV2 noteV2
      WHERE noteV2.appointment_id = ranked.AppointmentId) AS TreatmentNoteV2Count
FROM RankedAppointments AS ranked
JOIN dbo.Customers AS customer
  ON customer.CustomerId = ranked.CustomerId
JOIN dbo.Users AS customerUser
  ON customerUser.UserId = customer.UserId
JOIN dbo.Employees AS employee
  ON employee.EmployeeId = ranked.EmployeeId
JOIN dbo.Users AS technicianUser
  ON technicianUser.UserId = employee.UserId
WHERE ranked.DuplicateRank > 1
ORDER BY
    ranked.AppointmentDate,
    ranked.StartTime,
    ranked.CustomerId,
    ranked.EmployeeId,
    ranked.DuplicateRank;
GO
