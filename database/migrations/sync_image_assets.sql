USE [BeautySalonSystem1];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/*
    Synchronize image references used by Admin, Receptionist, Technician and
    Customer screens. The physical files are served by backend/public/images.
    This migration is idempotent and never deletes user-uploaded images.
*/
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.ServiceCategories', N'U') IS NULL
        THROW 51001, 'Missing prerequisite table dbo.ServiceCategories.', 1;
    IF OBJECT_ID(N'dbo.Services', N'U') IS NULL
        THROW 51002, 'Missing prerequisite table dbo.Services.', 1;
    IF OBJECT_ID(N'dbo.Promotions', N'U') IS NULL
        THROW 51003, 'Missing prerequisite table dbo.Promotions.', 1;
    IF OBJECT_ID(N'dbo.Packages', N'U') IS NULL
        THROW 51004, 'Missing prerequisite table dbo.Packages.', 1;
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
        THROW 51005, 'Missing prerequisite table dbo.Users.', 1;
    IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
        THROW 51006, 'Missing prerequisite table dbo.Employees.', 1;

    DECLARE @CategoryImages TABLE
    (
        CategoryName NVARCHAR(100) NOT NULL PRIMARY KEY,
        ImageUrl NVARCHAR(255) NOT NULL
    );

    INSERT INTO @CategoryImages (CategoryName, ImageUrl)
    VALUES
        (N'Massage',  N'/images/categories/massage.png'),
        (N'Nail',     N'/images/categories/nail.png'),
        (N'Hair',     N'/images/categories/hair.png'),
        (N'Skincare', N'/images/categories/skincare.png'),
        (N'Detox',    N'/images/categories/detox.png'),
        (N'Spa Combo',N'/images/categories/combo.png');

    UPDATE category
       SET category.ImageUrl = asset.ImageUrl
    FROM dbo.ServiceCategories AS category
    INNER JOIN @CategoryImages AS asset
            ON asset.CategoryName = category.CategoryName
    WHERE ISNULL(category.ImageUrl, N'') <> asset.ImageUrl;

    /* Keep all service cards renderable even when newly imported data has no image. */
    UPDATE dbo.Services
       SET ImageUrl = N'/images/services/default-service.png'
    WHERE NULLIF(LTRIM(RTRIM(ImageUrl)), N'') IS NULL;

    DECLARE @PromotionImages TABLE
    (
        PromotionId INT NOT NULL PRIMARY KEY,
        ImageUrl NVARCHAR(255) NOT NULL
    );

    INSERT INTO @PromotionImages (PromotionId, ImageUrl)
    VALUES
        (1, N'/images/promotions/promo-1.png'),
        (2, N'/images/promotions/promo-2.png'),
        (3, N'/images/promotions/promo-3.png'),
        (4, N'/images/promotions/promo-4.png');

    UPDATE promotion
       SET promotion.ImageUrl = asset.ImageUrl
    FROM dbo.Promotions AS promotion
    INNER JOIN @PromotionImages AS asset
            ON asset.PromotionId = promotion.PromotionId
    WHERE ISNULL(promotion.ImageUrl, N'') <> asset.ImageUrl;

    UPDATE dbo.Promotions
       SET ImageUrl = N'/images/promotions/promo-1.png'
    WHERE NULLIF(LTRIM(RTRIM(ImageUrl)), N'') IS NULL;

    /* The seventh package exists in the expanded data set but not in older seeds. */
    UPDATE dbo.Packages
       SET ImageUrl = N'/images/packages/nail-package-vip.png',
           UpdatedAt = GETDATE()
    WHERE (PackageId = 7 OR PackageName LIKE N'%Nail Art VIP%')
      AND NULLIF(LTRIM(RTRIM(ImageUrl)), N'') IS NULL;

    UPDATE dbo.Packages
       SET ImageUrl = N'/images/services/default-service.png',
           UpdatedAt = GETDATE()
    WHERE NULLIF(LTRIM(RTRIM(ImageUrl)), N'') IS NULL;

    DECLARE @AccountImages TABLE
    (
        Email NVARCHAR(100) NOT NULL PRIMARY KEY,
        AvatarUrl NVARCHAR(255) NOT NULL
    );

    INSERT INTO @AccountImages (Email, AvatarUrl)
    VALUES
        (N'admin@salon.com',        N'/images/avatars/admin.png'),
        (N'manager@salon.com',      N'/images/avatars/manager.png'),
        (N'receptionist@salon.com', N'/images/avatars/receptionist.png'),
        (N'customer@salon.com',     N'/images/avatars/customer.png');

    UPDATE appUser
       SET appUser.AvatarUrl = asset.AvatarUrl,
           appUser.UpdatedAt = GETDATE()
    FROM dbo.Users AS appUser
    INNER JOIN @AccountImages AS asset
            ON asset.Email = appUser.Email
    WHERE ISNULL(appUser.AvatarUrl, N'') <> asset.AvatarUrl;

    /* Role-aware defaults for imported accounts with an empty avatar. */
    UPDATE appUser
       SET AvatarUrl = CASE roleInfo.RoleName
            WHEN N'ADMIN'        THEN N'/images/avatars/admin.png'
            WHEN N'MANAGER'      THEN N'/images/avatars/manager.png'
            WHEN N'RECEPTIONIST' THEN N'/images/avatars/receptionist.png'
            WHEN N'TECHNICIAN'   THEN N'/images/technicians/default-avatar.png'
            ELSE N'/images/avatars/customer.png'
       END,
       UpdatedAt = GETDATE()
    FROM dbo.Users AS appUser
    INNER JOIN dbo.Roles AS roleInfo
            ON roleInfo.RoleId = appUser.RoleId
    WHERE NULLIF(LTRIM(RTRIM(appUser.AvatarUrl)), N'') IS NULL;

    /* One canonical portrait per employee across Users and Employees. */
    UPDATE employee
       SET employee.ImageUrl = appUser.AvatarUrl
    FROM dbo.Employees AS employee
    INNER JOIN dbo.Users AS appUser
            ON appUser.UserId = employee.UserId
    WHERE NULLIF(LTRIM(RTRIM(appUser.AvatarUrl)), N'') IS NOT NULL
      AND ISNULL(employee.ImageUrl, N'') <> appUser.AvatarUrl;

    COMMIT TRANSACTION;

    SELECT N'Image asset references synchronized successfully.' AS Result;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
