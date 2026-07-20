USE [BeautySalonSystem1];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/*
    Consolidate account administration into two business modules:
      - Employees: ADMIN, MANAGER, RECEPTIONIST, TECHNICIAN
      - Customers: CUSTOMER

    The migration is idempotent. It preserves account IDs and all related
    business history; only missing profiles and an objectively mismatched role
    (customer profile without employee profile) are repaired.
*/
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
        THROW 52001, 'Missing prerequisite table dbo.Users.', 1;
    IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
        THROW 52002, 'Missing prerequisite table dbo.Roles.', 1;
    IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
        THROW 52003, 'Missing prerequisite table dbo.Employees.', 1;
    IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
        THROW 52004, 'Missing prerequisite table dbo.Customers.', 1;
    IF OBJECT_ID(N'dbo.MembershipLevels', N'U') IS NULL
        THROW 52006, 'Missing prerequisite table dbo.MembershipLevels.', 1;

    DECLARE @CustomerRoleId INT =
        (SELECT TOP (1) RoleId FROM dbo.Roles WHERE RoleName = N'CUSTOMER');

    IF @CustomerRoleId IS NULL
        THROW 52005, 'Missing CUSTOMER role.', 1;

    /*
       A Customer profile is stronger evidence than the stale role value when
       the same user has never had an Employee profile. This repairs the
       existing Nguyễn Thị Thanh Mai data without deleting customer history.
    */
    UPDATE appUser
       SET appUser.RoleId = @CustomerRoleId,
           appUser.UpdatedAt = GETDATE()
    FROM dbo.Users AS appUser
    INNER JOIN dbo.Customers AS customer
            ON customer.UserId = appUser.UserId
    INNER JOIN dbo.Roles AS currentRole
            ON currentRole.RoleId = appUser.RoleId
    WHERE currentRole.RoleName <> N'CUSTOMER'
      AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.Employees AS employee
              WHERE employee.UserId = appUser.UserId
          );

    /* Ensure every CUSTOMER account is visible and manageable in Customers. */
    INSERT INTO dbo.Customers
        (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
    SELECT
        appUser.UserId,
        NULL,
        NULL,
        NULL,
        0,
        (
            SELECT TOP (1) MembershipLevelId
            FROM dbo.MembershipLevels
            ORDER BY MinPoints, MembershipLevelId
        )
    FROM dbo.Users AS appUser
    INNER JOIN dbo.Roles AS roleInfo
            ON roleInfo.RoleId = appUser.RoleId
    WHERE roleInfo.RoleName = N'CUSTOMER'
      AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.Customers AS customer
              WHERE customer.UserId = appUser.UserId
          );

    /* Ensure every internal account is visible and manageable in Employees. */
    INSERT INTO dbo.Employees
        (
            UserId,
            BranchId,
            Position,
            Specialization,
            Salary,
            HireDate,
            YearsOfExperience,
            Bio,
            ImageUrl,
            Status
        )
    SELECT
        appUser.UserId,
        CASE
            WHEN appUser.Email IN (N'receptionist@salon.com', N'receptionist1@salon.com') THEN 1
            WHEN appUser.Email = N'receptionist2@salon.com' THEN 2
            WHEN appUser.Email = N'receptionist3@salon.com' THEN 3
            ELSE NULL
        END,
        CASE roleInfo.RoleName
            WHEN N'ADMIN' THEN N'Quản trị hệ thống'
            WHEN N'MANAGER' THEN N'Quản lý Salon'
            WHEN N'RECEPTIONIST' THEN N'Lễ tân'
            ELSE N'Kỹ thuật viên'
        END,
        CASE roleInfo.RoleName
            WHEN N'ADMIN' THEN N'Quản trị & phân quyền'
            WHEN N'MANAGER' THEN N'Điều hành Salon'
            WHEN N'RECEPTIONIST' THEN N'Chăm sóc khách hàng'
            ELSE NULL
        END,
        NULL,
        CAST(appUser.CreatedAt AS DATE),
        0,
        CASE roleInfo.RoleName
            WHEN N'ADMIN' THEN N'Tài khoản quản trị hệ thống.'
            WHEN N'MANAGER' THEN N'Tài khoản quản lý vận hành Salon.'
            WHEN N'RECEPTIONIST' THEN N'Nhân sự lễ tân và chăm sóc khách hàng.'
            ELSE N'Nhân sự kỹ thuật viên Salon.'
        END,
        appUser.AvatarUrl,
        appUser.Status
    FROM dbo.Users AS appUser
    INNER JOIN dbo.Roles AS roleInfo
            ON roleInfo.RoleId = appUser.RoleId
    WHERE roleInfo.RoleName IN (N'ADMIN', N'MANAGER', N'RECEPTIONIST', N'TECHNICIAN')
      AND NOT EXISTS
          (
              SELECT 1
              FROM dbo.Employees AS employee
              WHERE employee.UserId = appUser.UserId
          );

    /* Repair and standardize the seeded internal profiles with Unicode text. */
    UPDATE employee
       SET employee.Position = CASE roleInfo.RoleName
               WHEN N'ADMIN' THEN N'Quản trị hệ thống'
               WHEN N'MANAGER' THEN N'Quản lý Salon'
               WHEN N'RECEPTIONIST' THEN N'Lễ tân'
               ELSE employee.Position
           END,
           employee.Specialization = CASE roleInfo.RoleName
               WHEN N'ADMIN' THEN N'Quản trị & phân quyền'
               WHEN N'MANAGER' THEN N'Điều hành Salon'
               WHEN N'RECEPTIONIST' THEN N'Chăm sóc khách hàng'
               ELSE employee.Specialization
           END,
           employee.Bio = CASE roleInfo.RoleName
               WHEN N'ADMIN' THEN N'Tài khoản quản trị hệ thống.'
               WHEN N'MANAGER' THEN N'Tài khoản quản lý vận hành Salon.'
               WHEN N'RECEPTIONIST' THEN N'Nhân sự lễ tân và chăm sóc khách hàng.'
               ELSE employee.Bio
           END
    FROM dbo.Employees AS employee
    INNER JOIN dbo.Users AS appUser
            ON appUser.UserId = employee.UserId
    INNER JOIN dbo.Roles AS roleInfo
            ON roleInfo.RoleId = appUser.RoleId
    WHERE appUser.Email IN
          (
              N'admin@salon.com',
              N'manager@salon.com',
              N'receptionist@salon.com',
              N'receptionist1@salon.com',
              N'receptionist2@salon.com',
              N'receptionist3@salon.com'
          );

    /* Keep the account avatar and employee card portrait synchronized. */
    UPDATE employee
       SET employee.ImageUrl = appUser.AvatarUrl
    FROM dbo.Employees AS employee
    INNER JOIN dbo.Users AS appUser
            ON appUser.UserId = employee.UserId
    WHERE NULLIF(LTRIM(RTRIM(appUser.AvatarUrl)), N'') IS NOT NULL
      AND ISNULL(employee.ImageUrl, N'') <> appUser.AvatarUrl;

    COMMIT TRANSACTION;

    SELECT
        SUM(CASE WHEN roleInfo.RoleName IN (N'ADMIN', N'MANAGER', N'RECEPTIONIST', N'TECHNICIAN') THEN 1 ELSE 0 END)
            AS InternalAccounts,
        SUM(CASE WHEN roleInfo.RoleName = N'CUSTOMER' THEN 1 ELSE 0 END)
            AS CustomerAccounts
    FROM dbo.Users AS appUser
    INNER JOIN dbo.Roles AS roleInfo
            ON roleInfo.RoleId = appUser.RoleId;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
