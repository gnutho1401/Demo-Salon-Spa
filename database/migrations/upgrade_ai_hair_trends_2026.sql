SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.AIHairStyles', N'U') IS NULL
    THROW 50001, 'AIHairStyles must exist before applying the trend catalog migration.', 1;

IF COL_LENGTH('dbo.AIHairStyles', 'Audience') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD Audience NVARCHAR(10) NOT NULL
        CONSTRAINT DF_AIHairStyles_Audience DEFAULT N'UNISEX' WITH VALUES;

IF COL_LENGTH('dbo.AIHairStyles', 'IsTrending') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD IsTrending BIT NOT NULL
        CONSTRAINT DF_AIHairStyles_IsTrending DEFAULT 0 WITH VALUES;

IF COL_LENGTH('dbo.AIHairStyles', 'TrendScore') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD TrendScore DECIMAL(5,2) NULL;

IF COL_LENGTH('dbo.AIHairStyles', 'TrendYear') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD TrendYear SMALLINT NULL;

IF COL_LENGTH('dbo.AIHairStyles', 'TrendSourceUrl') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD TrendSourceUrl NVARCHAR(1000) NULL;

IF COL_LENGTH('dbo.AIHairStyles', 'TrendLastVerifiedAt') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD TrendLastVerifiedAt DATETIME2(0) NULL;

IF COL_LENGTH('dbo.AIHairStyles', 'LoraTrigger') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD LoraTrigger NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.AIHairStyles', 'PromptVersion') IS NULL
    ALTER TABLE dbo.AIHairStyles ADD PromptVersion NVARCHAR(20) NOT NULL
        CONSTRAINT DF_AIHairStyles_PromptVersion DEFAULT N'v1' WITH VALUES;

-- SQL Server compiles a batch before executing ALTER TABLE statements. Start a new
-- batch so the new columns are visible to the constraints, UPDATE and MERGE below.
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AIHairStyles_Audience')
    ALTER TABLE dbo.AIHairStyles ADD CONSTRAINT CK_AIHairStyles_Audience
        CHECK (Audience IN (N'MALE', N'FEMALE', N'UNISEX'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AIHairStyles_TrendScore')
    ALTER TABLE dbo.AIHairStyles ADD CONSTRAINT CK_AIHairStyles_TrendScore
        CHECK (TrendScore IS NULL OR (TrendScore >= 0 AND TrendScore <= 100));

UPDATE dbo.AIHairStyles
SET Audience = CASE
        WHEN StyleCode = N'MODERN_UNDERCUT' THEN N'MALE'
        WHEN StyleType = N'COLOR' THEN N'UNISEX'
        ELSE N'FEMALE'
    END,
    IsTrending = CASE WHEN StyleCode IN (N'FRENCH_BOB', N'KOREAN_VOLUME', N'TEXTURED_PIXIE') THEN 1 ELSE IsTrending END,
    TrendYear = CASE WHEN StyleCode IN (N'FRENCH_BOB', N'KOREAN_VOLUME', N'TEXTURED_PIXIE') THEN 2026 ELSE TrendYear END,
    PromptVersion = N'v2-natural'
WHERE StyleCode IN (
    N'LAYER_FACE_FRAME', N'FRENCH_BOB', N'TEXTURED_PIXIE', N'LONG_SOFT_WAVES',
    N'KOREAN_VOLUME', N'MODERN_UNDERCUT', N'CHESTNUT_BROWN', N'ASH_BROWN',
    N'COPPER_GLOW', N'PLATINUM_BEIGE'
);

;WITH TrendSeed AS (
    SELECT * FROM (VALUES
        (N'BUTTERFLY_LAYERS_2026', N'Butterfly layers 2026', N'CUT', N'LONG', N'WAVY', N'MEDIUM', N'FEMALE',
         N'Layer cánh bướm nhiều tầng, giữ độ dài nhưng tạo chuyển động và độ phồng mềm quanh khuôn mặt.',
         N'female butterfly haircut with long cascading face-framing layers, airy crown volume, feathered ends, natural movement, realistic density and fine flyaway strands',
         N'/images/services/hair-cut.png', N'#7a5035', N'Cắt & tạo kiểu tóc', 11, CAST(98.00 AS DECIMAL(5,2)),
         N'https://www.vogue.co.uk/article/butterfly-cut-summer', N'hairtrend_butterfly_2026'),
        (N'GRADUATED_BOB_2026', N'Graduated bob 2026', N'CUT', N'SHORT', N'STRAIGHT', N'MEDIUM', N'FEMALE',
         N'Bob ôm gáy có độ nâng tinh tế phía sau, đường viền gọn và chuyển động mềm thay vì cứng.',
         N'female graduated bob haircut, softly stacked nape, chin-skimming front, polished but natural movement, realistic hairline, subtle asymmetric strand variation',
         N'/images/services/hair-cut.png', N'#4f3328', N'Cắt & tạo kiểu tóc', 12, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.vogue.com/article/11-hair-trends-2026', N'hairtrend_graduated_bob_2026'),
        (N'BIXIE_2026', N'Bixie mềm hiện đại', N'CUT', N'SHORT', N'WAVY', N'MEDIUM', N'FEMALE',
         N'Kiểu lai giữa bob và pixie, ngắn gọn nhưng vẫn có độ mềm, chuyển động và nhiều cách tạo kiểu.',
         N'female modern bixie haircut, between pixie and bob length, soft side-swept texture, tucked detail around ears, airy natural volume, realistic wispy ends',
         N'/images/services/hair-cut.png', N'#5b4034', N'Cắt & tạo kiểu tóc', 13, CAST(94.00 AS DECIMAL(5,2)),
         N'https://www.marieclaire.com/beauty/hair/bixie-cut-ideas/', N'hairtrend_bixie_2026'),
        (N'SOFT_SHAG_2026', N'Soft shag nhiều chuyển động', N'CUT', N'MEDIUM', N'WAVY', N'MEDIUM', N'FEMALE',
         N'Shag mềm với layer nhẹ, mái thoáng và kết cấu tự nhiên dễ ứng dụng hằng ngày.',
         N'female commercial soft shag haircut, medium feathered layers, light curtain fringe, effortless air-dried texture, soft natural volume, realistic individual strands',
         N'/images/services/hair-curl.png', N'#684636', N'Cắt & tạo kiểu tóc', 14, CAST(91.00 AS DECIMAL(5,2)),
         N'https://www.vogue.com/article/11-hair-trends-2026', N'hairtrend_soft_shag_2026'),

        (N'SOFT_MODERN_MULLET_2026', N'Soft modern mullet', N'CUT', N'MEDIUM', N'WAVY', N'MEDIUM', N'MALE',
         N'Mullet hiện đại được làm mềm, phần sau dài vừa phải, phom rối tự nhiên và dễ ứng dụng.',
         N'male soft modern mullet haircut, relaxed tousled air-dried texture, moderate length at the back, soft temple transition, natural masculine hairline and realistic density',
         N'/images/services/hair-cut.png', N'#352923', N'Cắt & tạo kiểu tóc', 21, CAST(99.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_soft_mullet_2026'),
        (N'TEXTURED_CROP_TAPER_2026', N'Textured crop taper', N'CUT', N'SHORT', N'WAVY', N'LOW', N'MALE',
         N'Crop ngắn có kết cấu, hai bên taper mềm và phần mái tự nhiên giúp khuôn mặt gọn hơn.',
         N'male textured crop haircut with soft low taper, choppy natural top texture, subtle forward fringe, believable temple hairline, realistic short hair strands',
         N'/images/services/hair-cut.png', N'#2c2522', N'Cắt & tạo kiểu tóc', 22, CAST(97.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-short-haircuts-for-men-2026', N'hairtrend_crop_taper_2026'),
        (N'CURTAIN_FLOW_2026', N'Curtain flow 2026', N'TEXTURE', N'MEDIUM', N'WAVY', N'MEDIUM', N'MALE',
         N'Tóc rẽ curtain có độ rủ và chuyển động tự nhiên, lấy cảm hứng từ phom 90s và K-style.',
         N'male medium curtain flow hairstyle, relaxed center part, layered swept-back sides, natural bend and movement, clean realistic hairline, soft healthy texture',
         N'/images/services/hair-curl.png', N'#45362f', N'Uốn tóc setting', 23, CAST(95.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-short-haircuts-for-men-2026', N'hairtrend_curtain_flow_2026'),
        (N'BURST_FADE_MULLET_2026', N'Burst fade mullet', N'CUT', N'MEDIUM', N'CURLY', N'HIGH', N'MALE',
         N'Burst fade bo tròn quanh tai kết hợp phần đỉnh và sau có độ dài, phù hợp tóc xoăn hoặc có kết cấu.',
         N'male burst fade mullet haircut, clean circular fade around ears, textured top, controlled length at back, natural scalp transition, realistic curly strand detail',
         N'/images/services/hair-cut.png', N'#24201f', N'Cắt & tạo kiểu tóc', 24, CAST(93.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-short-haircuts-for-men-2026', N'hairtrend_burst_fade_2026'),
        (N'MODERN_BUZZ_2026', N'Modern buzz có layer', N'CUT', N'SHORT', N'STRAIGHT', N'LOW', N'MALE',
         N'Buzz cut hiện đại có độ chuyển rất nhẹ, giữ cảm giác gọn nhưng không phẳng cứng.',
         N'male modern buzz cut with subtle layered top, softly tapered sides, natural scalp coverage, precise but non-artificial hairline, realistic micro hair texture',
         N'/images/services/hair-cut.png', N'#262321', N'Cắt & tạo kiểu tóc', 25, CAST(89.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-short-haircuts-for-men-2026', N'hairtrend_modern_buzz_2026'),
        (N'NATURAL_CURL_TAPER_2026', N'Natural curl taper', N'TEXTURE', N'SHORT', N'CURLY', N'MEDIUM', N'MALE',
         N'Giữ lọn xoăn tự nhiên ở đỉnh, hai bên taper sạch nhưng chuyển vùng mềm và chân thực.',
         N'male natural curl taper hairstyle, defined but soft curls on top, low tapered sides, realistic curl clusters, subtle frizz and flyaways, natural temple transition',
         N'/images/services/hair-curl.png', N'#312820', N'Uốn tóc setting', 26, CAST(92.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_curl_taper_2026'),

        (N'COPPER_ROSE_2026', N'Copper rose ánh nắng', N'COLOR', NULL, NULL, N'MEDIUM', N'UNISEX',
         N'Nền brunette pha đồng hồng ấm, bắt sáng nhẹ và vẫn giữ chiều sâu tự nhiên.',
         N'keep the exact haircut and recolor only the hair to sun-warmed copper rose brunette, dimensional lowlights, subtle natural roots, realistic specular highlights and strand variation',
         N'/images/services/hair-color.png', N'#a45f50', N'Nhuộm tóc thời trang', 31, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.allure.com/story/summer-hair-color-trends-2026', N'hairtrend_copper_rose_2026')
    ) seed(StyleCode, StyleName, StyleType, HairLength, HairTexture, MaintenanceLevel, Audience,
           Description, PromptTemplate, ThumbnailUrl, AccentColor, ServiceName, SortOrder,
           TrendScore, TrendSourceUrl, LoraTrigger)
)
MERGE dbo.AIHairStyles AS target
USING (
    SELECT seed.*, service.ServiceId
    FROM TrendSeed seed
    OUTER APPLY (
        SELECT TOP 1 ServiceId
        FROM dbo.Services
        WHERE ServiceName = seed.ServiceName
           OR (seed.StyleType = N'CUT' AND ServiceName LIKE N'%Cắt%')
           OR (seed.StyleType = N'TEXTURE' AND ServiceName LIKE N'%Uốn%')
           OR (seed.StyleType = N'COLOR' AND ServiceName LIKE N'%Nhuộm%')
        ORDER BY CASE WHEN ServiceName = seed.ServiceName THEN 0 ELSE 1 END, ServiceId
    ) service
) AS source
ON target.StyleCode = source.StyleCode
WHEN MATCHED THEN UPDATE SET
    StyleName = source.StyleName,
    StyleType = source.StyleType,
    HairLength = source.HairLength,
    HairTexture = source.HairTexture,
    MaintenanceLevel = source.MaintenanceLevel,
    Audience = source.Audience,
    Description = source.Description,
    PromptTemplate = source.PromptTemplate,
    ThumbnailUrl = source.ThumbnailUrl,
    AccentColor = source.AccentColor,
    ServiceId = source.ServiceId,
    SortOrder = source.SortOrder,
    IsTrending = 1,
    TrendScore = source.TrendScore,
    TrendYear = 2026,
    TrendSourceUrl = source.TrendSourceUrl,
    TrendLastVerifiedAt = SYSUTCDATETIME(),
    LoraTrigger = source.LoraTrigger,
    PromptVersion = N'v2-natural',
    IsActive = 1,
    UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
    StyleCode, StyleName, StyleType, HairLength, HairTexture, MaintenanceLevel, Audience,
    Description, PromptTemplate, ThumbnailUrl, AccentColor, ServiceId, SortOrder, IsActive,
    IsTrending, TrendScore, TrendYear, TrendSourceUrl, TrendLastVerifiedAt, LoraTrigger, PromptVersion
) VALUES (
    source.StyleCode, source.StyleName, source.StyleType, source.HairLength, source.HairTexture,
    source.MaintenanceLevel, source.Audience, source.Description, source.PromptTemplate,
    source.ThumbnailUrl, source.AccentColor, source.ServiceId, source.SortOrder, 1,
    1, source.TrendScore, 2026, source.TrendSourceUrl, SYSUTCDATETIME(), source.LoraTrigger, N'v2-natural'
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.AIHairStyles') AND name = N'IX_AIHairStyles_Audience_Trend')
    CREATE INDEX IX_AIHairStyles_Audience_Trend
        ON dbo.AIHairStyles(Audience, IsTrending, TrendScore DESC)
        INCLUDE (StyleCode, StyleName, StyleType, HairLength, IsActive, SortOrder);

GO
