IF OBJECT_ID('dbo.WaitingList', 'U') IS NULL
BEGIN
    CREATE TABLE WaitingList (
        WaitingListId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId INT NOT NULL,
        ServiceId INT NOT NULL,
        PreferredDate DATE NOT NULL,
        PreferredStartTime TIME(0) NOT NULL,
        PreferredEndTime TIME(0) NOT NULL,
        TechnicianId INT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'WAITING',
        Note NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_WaitingList_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
        CONSTRAINT FK_WaitingList_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId),
        CONSTRAINT FK_WaitingList_Employees FOREIGN KEY (TechnicianId) REFERENCES Employees(EmployeeId)
    );
END
GO
