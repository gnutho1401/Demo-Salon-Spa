SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.AIHairStyles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AIHairStyles (
        StyleId INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIHairStyles PRIMARY KEY,
        StyleCode NVARCHAR(60) NOT NULL,
        StyleName NVARCHAR(140) NOT NULL,
        StyleType NVARCHAR(20) NOT NULL,
        HairLength NVARCHAR(20) NULL,
        HairTexture NVARCHAR(30) NULL,
        MaintenanceLevel NVARCHAR(20) NOT NULL CONSTRAINT DF_AIHairStyles_Maintenance DEFAULT N'MEDIUM',
        Description NVARCHAR(500) NOT NULL,
        PromptTemplate NVARCHAR(1000) NOT NULL,
        ThumbnailUrl NVARCHAR(500) NULL,
        AccentColor NVARCHAR(20) NULL,
        ServiceId INT NULL,
        SortOrder INT NOT NULL CONSTRAINT DF_AIHairStyles_SortOrder DEFAULT 0,
        IsActive BIT NOT NULL CONSTRAINT DF_AIHairStyles_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AIHairStyles_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(0) NULL,
        CONSTRAINT UQ_AIHairStyles_StyleCode UNIQUE (StyleCode),
        CONSTRAINT CK_AIHairStyles_StyleType CHECK (StyleType IN (N'CUT', N'COLOR', N'TEXTURE')),
        CONSTRAINT CK_AIHairStyles_HairLength CHECK (HairLength IS NULL OR HairLength IN (N'SHORT', N'MEDIUM', N'LONG')),
        CONSTRAINT CK_AIHairStyles_Maintenance CHECK (MaintenanceLevel IN (N'LOW', N'MEDIUM', N'HIGH')),
        CONSTRAINT FK_AIHairStyles_Services FOREIGN KEY (ServiceId) REFERENCES dbo.Services(ServiceId) ON DELETE SET NULL
    );
END;

IF OBJECT_ID(N'dbo.AIHairTryOns', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AIHairTryOns (
        TryOnId BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AIHairTryOns PRIMARY KEY,
        UserId INT NOT NULL,
        CustomerId INT NOT NULL,
        StyleId INT NULL,
        CustomPrompt NVARCHAR(1000) NOT NULL,
        SourceImagePath NVARCHAR(1000) NULL,
        ResultImagePath NVARCHAR(1000) NULL,
        ResultMimeType NVARCHAR(100) NULL,
        Provider NVARCHAR(50) NULL,
        ModelName NVARCHAR(150) NULL,
        ProviderRequestId NVARCHAR(200) NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_AIHairTryOns_Status DEFAULT N'PROCESSING',
        LatencyMs INT NULL,
        InputToken INT NULL,
        OutputToken INT NULL,
        IsFavorite BIT NOT NULL CONSTRAINT DF_AIHairTryOns_IsFavorite DEFAULT 0,
        ErrorMessage NVARCHAR(1000) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_AIHairTryOns_CreatedAt DEFAULT SYSUTCDATETIME(),
        CompletedAt DATETIME2(0) NULL,
        ExpiresAt DATETIME2(0) NULL,
        CONSTRAINT FK_AIHairTryOns_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId),
        CONSTRAINT FK_AIHairTryOns_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
        CONSTRAINT FK_AIHairTryOns_Styles FOREIGN KEY (StyleId) REFERENCES dbo.AIHairStyles(StyleId) ON DELETE SET NULL,
        CONSTRAINT CK_AIHairTryOns_Status CHECK (Status IN (N'PROCESSING', N'SUCCEEDED', N'FAILED'))
    );

    CREATE INDEX IX_AIHairTryOns_User_CreatedAt
        ON dbo.AIHairTryOns(UserId, CreatedAt DESC)
        INCLUDE (StyleId, Status, IsFavorite, Provider, ModelName);

    CREATE INDEX IX_AIHairTryOns_Expiry
        ON dbo.AIHairTryOns(ExpiresAt)
        WHERE ExpiresAt IS NOT NULL;
END;

;WITH StyleSeed AS (
    SELECT * FROM (VALUES
        (N'LAYER_FACE_FRAME', N'Layer ôm khuôn mặt', N'CUT', N'MEDIUM', N'STRAIGHT', N'MEDIUM', N'Tầng layer mềm, tạo độ phồng nhẹ và ôm gọn đường nét khuôn mặt.', N'Kiểu tóc layer nhiều tầng dài ngang vai, các lọn phía trước ôm tự nhiên quanh khuôn mặt, độ phồng nhẹ ở đỉnh đầu, phần đuôi tỉa mềm.', N'/images/services/hair-cut.png', N'#7a5035', N'Cắt & tạo kiểu tóc', 10),
        (N'FRENCH_BOB', N'French bob thanh lịch', N'CUT', N'SHORT', N'STRAIGHT', N'MEDIUM', N'Bob ngang cằm với phom gọn, hiện đại và dễ phối phong cách.', N'Kiểu French bob dài ngang cằm, đường cắt gọn thanh lịch, đuôi tóc cong nhẹ vào trong và độ phồng tự nhiên.', N'/images/services/hair-cut.png', N'#4a2f25', N'Cắt & tạo kiểu tóc', 20),
        (N'TEXTURED_PIXIE', N'Pixie có kết cấu', N'CUT', N'SHORT', N'WAVY', N'HIGH', N'Phom pixie nhẹ, có chuyển động và làm nổi bật đường nét gương mặt.', N'Kiểu pixie ngắn có kết cấu, phần mái tỉa nhẹ, tóc đỉnh đầu có độ phồng tự nhiên, hai bên gọn nhưng không cạo sát.', N'/images/services/hair-cut.png', N'#3d2a23', N'Cắt & tạo kiểu tóc', 30),
        (N'LONG_SOFT_WAVES', N'Sóng dài mềm mại', N'TEXTURE', N'LONG', N'WAVY', N'MEDIUM', N'Sóng lơi lớn, bóng khỏe, phù hợp phong cách tự nhiên cao cấp.', N'Mái tóc dài với sóng lơi lớn mềm mại từ ngang gò má xuống đuôi, sợi tóc bóng khỏe, chuyển động tự nhiên và không xoăn quá chặt.', N'/images/services/hair-curl.png', N'#6d452e', N'Uốn tóc setting', 40),
        (N'KOREAN_VOLUME', N'Layer Hàn tạo phồng', N'TEXTURE', N'MEDIUM', N'WAVY', N'MEDIUM', N'Layer bồng nhẹ, mái bay và độ cong tự nhiên quanh gương mặt.', N'Kiểu layer Hàn Quốc dài qua vai, mái bay chia nhẹ, phần chân tóc có độ phồng và đuôi uốn chữ C tự nhiên.', N'/images/services/hair-curl.png', N'#5a3a2e', N'Uốn tóc setting', 50),
        (N'MODERN_UNDERCUT', N'Undercut hiện đại', N'CUT', N'SHORT', N'STRAIGHT', N'HIGH', N'Hai bên gọn, phần trên có kết cấu và dễ thay đổi cách vuốt.', N'Kiểu undercut hiện đại, hai bên taper gọn tự nhiên, phần tóc trên có kết cấu và vuốt nhẹ sang bên, đường chuyển tóc mềm.', N'/images/services/hair-cut.png', N'#29211e', N'Cắt & tạo kiểu tóc', 60),
        (N'CHESTNUT_BROWN', N'Nâu hạt dẻ', N'COLOR', NULL, NULL, N'LOW', N'Tông nâu ấm tự nhiên, mềm và dễ duy trì.', N'Giữ nguyên kiểu tóc hiện tại nhưng nhuộm toàn bộ tóc thành màu nâu hạt dẻ ấm tự nhiên, chân tóc và vùng sáng tối hòa chuyển chân thực.', N'/images/services/hair-color.png', N'#70452f', N'Nhuộm tóc thời trang', 70),
        (N'ASH_BROWN', N'Nâu khói lạnh', N'COLOR', NULL, NULL, N'MEDIUM', N'Tông nâu lạnh có ánh khói tinh tế, hiện đại nhưng không quá sáng.', N'Giữ nguyên kiểu tóc hiện tại nhưng nhuộm tóc thành màu nâu khói lạnh tự nhiên, sắc xám nâu cân bằng, có chiều sâu và phản sáng chân thực.', N'/images/services/hair-highlight.png', N'#655b57', N'Nhuộm tóc thời trang', 80),
        (N'COPPER_GLOW', N'Đồng ánh quế', N'COLOR', NULL, NULL, N'MEDIUM', N'Sắc đồng quế ấm, nổi bật vừa phải dưới ánh sáng tự nhiên.', N'Giữ nguyên kiểu tóc hiện tại nhưng nhuộm tóc thành màu đồng ánh quế ấm, sắc đỏ nâu tinh tế, chân tóc tự nhiên và ánh phản quang chân thực.', N'/images/services/hair-color.png', N'#a65e3c', N'Nhuộm tóc thời trang', 90),
        (N'PLATINUM_BEIGE', N'Be bạch kim', N'COLOR', NULL, NULL, N'HIGH', N'Bạch kim pha be mềm, sáng sang trọng và giảm cảm giác bạc lạnh.', N'Giữ nguyên kiểu tóc hiện tại nhưng nhuộm tóc thành màu be bạch kim sang trọng, chân tóc chuyển tối nhẹ tự nhiên, sợi tóc có chiều sâu và bóng khỏe.', N'/images/services/hair-highlight.png', N'#d8cbb8', N'Nhuộm tóc thời trang', 100)
    ) seed(StyleCode, StyleName, StyleType, HairLength, HairTexture, MaintenanceLevel, Description, PromptTemplate, ThumbnailUrl, AccentColor, ServiceName, SortOrder)
)
MERGE dbo.AIHairStyles AS target
USING (
    SELECT s.StyleCode, s.StyleName, s.StyleType, s.HairLength, s.HairTexture,
           s.MaintenanceLevel, s.Description, s.PromptTemplate, s.ThumbnailUrl,
           s.AccentColor, service.ServiceId, s.SortOrder
    FROM StyleSeed s
    OUTER APPLY (
        SELECT TOP 1 ServiceId
        FROM dbo.Services
        WHERE ServiceName = s.ServiceName
        ORDER BY ServiceId
    ) service
) AS source
ON target.StyleCode = source.StyleCode
WHEN MATCHED THEN UPDATE SET
    StyleName = source.StyleName,
    StyleType = source.StyleType,
    HairLength = source.HairLength,
    HairTexture = source.HairTexture,
    MaintenanceLevel = source.MaintenanceLevel,
    Description = source.Description,
    PromptTemplate = source.PromptTemplate,
    ThumbnailUrl = source.ThumbnailUrl,
    AccentColor = source.AccentColor,
    ServiceId = source.ServiceId,
    SortOrder = source.SortOrder,
    IsActive = 1,
    UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
    StyleCode, StyleName, StyleType, HairLength, HairTexture, MaintenanceLevel,
    Description, PromptTemplate, ThumbnailUrl, AccentColor, ServiceId, SortOrder, IsActive
) VALUES (
    source.StyleCode, source.StyleName, source.StyleType, source.HairLength, source.HairTexture,
    source.MaintenanceLevel, source.Description, source.PromptTemplate, source.ThumbnailUrl,
    source.AccentColor, source.ServiceId, source.SortOrder, 1
);

COMMIT TRANSACTION;
GO
