/* Chạy file này trên database BeautySalonSystem trước khi chạy chức năng review theo từng dịch vụ */

IF COL_LENGTH('Reviews', 'ServiceId') IS NULL
BEGIN
    ALTER TABLE Reviews ADD ServiceId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Reviews_Services'
)
BEGIN
    ALTER TABLE Reviews
    ADD CONSTRAINT FK_Reviews_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId);
END
GO

;WITH x AS (
    SELECT r.ReviewId, MIN(aps.ServiceId) AS ServiceId
    FROM Reviews r
    JOIN AppointmentServices aps ON r.AppointmentId = aps.AppointmentId
    WHERE r.ServiceId IS NULL
    GROUP BY r.ReviewId
)
UPDATE r
SET r.ServiceId = x.ServiceId
FROM Reviews r
JOIN x ON r.ReviewId = x.ReviewId;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'UX_Reviews_Customer_Appointment_Service'
)
BEGIN
    CREATE UNIQUE INDEX UX_Reviews_Customer_Appointment_Service
    ON Reviews(CustomerId, AppointmentId, ServiceId)
    WHERE ServiceId IS NOT NULL;
END
GO
