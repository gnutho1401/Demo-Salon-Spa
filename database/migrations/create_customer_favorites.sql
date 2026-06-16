USE BeautySalonSystem1;
GO

IF OBJECT_ID('dbo.CustomerFavoriteServices', 'U') IS NULL
BEGIN
    CREATE TABLE CustomerFavoriteServices (
        UserId INT NOT NULL,
        ServiceId INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_CustomerFavoriteServices PRIMARY KEY (UserId, ServiceId),
        CONSTRAINT FK_CustomerFavoriteServices_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_CustomerFavoriteServices_Services FOREIGN KEY (ServiceId) REFERENCES Services(ServiceId) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID('dbo.CustomerFavoriteEmployees', 'U') IS NULL
BEGIN
    CREATE TABLE CustomerFavoriteEmployees (
        UserId INT NOT NULL,
        EmployeeId INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_CustomerFavoriteEmployees PRIMARY KEY (UserId, EmployeeId),
        CONSTRAINT FK_CustomerFavoriteEmployees_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_CustomerFavoriteEmployees_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId) ON DELETE CASCADE
    );
END
GO
