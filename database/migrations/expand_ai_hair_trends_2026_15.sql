SET XACT_ABORT ON;
GO

IF OBJECT_ID(N'dbo.AIHairStyles', N'U') IS NULL
    THROW 50021, 'AIHairStyles must exist before applying the expanded 2026 trend catalog.', 1;

IF COL_LENGTH('dbo.AIHairStyles', 'Audience') IS NULL
   OR COL_LENGTH('dbo.AIHairStyles', 'TrendSourceUrl') IS NULL
   OR COL_LENGTH('dbo.AIHairStyles', 'LoraTrigger') IS NULL
    THROW 50022, 'Apply upgrade_ai_hair_trends_2026.sql before this migration.', 1;
GO

BEGIN TRANSACTION;

;WITH TrendSeed AS (
    SELECT * FROM (VALUES
        (N'BOX_BOB_2026', N'Box bob sắc nét', N'CUT', N'SHORT', N'STRAIGHT', N'MEDIUM', N'FEMALE',
         N'Bob ngang cằm có đường viền gọn, thân tóc đầy và chuyển động nhẹ để khuôn mặt trông sáng, hiện đại.',
         N'female 2026 box bob haircut, chin-length clean geometric outline, full healthy ends, subtle natural movement, realistic hairline and fine strand variation',
         N'/images/services/hair-cut.png', N'#43332d', N'Cắt & tạo kiểu tóc', 15, CAST(97.00 AS DECIMAL(5,2)),
         N'https://www.elle.com/beauty/hair/g69919251/bob-hair-trends-2026/', N'hairtrend_box_bob_2026'),
        (N'BUTTERFLY_BOB_2026', N'Butterfly bob mềm', N'CUT', N'SHORT', N'WAVY', N'MEDIUM', N'FEMALE',
         N'Bob mềm kết hợp layer cánh bướm quanh má, tạo độ nảy và ôm khuôn mặt nhưng không nặng nề.',
         N'female butterfly bob haircut, cheek-framing feathered layers, soft rounded volume, airy flipped ends, natural salon texture and believable strands',
         N'/images/services/hair-cut.png', N'#725342', N'Cắt & tạo kiểu tóc', 16, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.elle.com/beauty/hair/a71411938/bob-hairstyles-summer-2026-trends/', N'hairtrend_butterfly_bob_2026'),
        (N'CURVED_BOB_2026', N'Curved bob ôm mặt', N'CUT', N'SHORT', N'STRAIGHT', N'MEDIUM', N'FEMALE',
         N'Bob có đường cong mềm hướng vào xương hàm, thân tóc bóng khỏe và chuyển động tự nhiên.',
         N'female curved bob haircut, jaw-skimming softly rounded silhouette, subtle inward bend, healthy dimensional shine, natural roots and realistic ends',
         N'/images/services/hair-cut.png', N'#584038', N'Cắt & tạo kiểu tóc', 17, CAST(94.00 AS DECIMAL(5,2)),
         N'https://www.elle.com/beauty/hair/a71411938/bob-hairstyles-summer-2026-trends/', N'hairtrend_curved_bob_2026'),
        (N'FRAGMENTED_BOB_2026', N'Fragmented bob phóng khoáng', N'CUT', N'SHORT', N'WAVY', N'LOW', N'FEMALE',
         N'Bob tỉa rời có kết cấu thoáng, phần ngọn không đều có chủ đích và dễ tạo kiểu theo chất tóc tự nhiên.',
         N'female fragmented bob haircut, softly disconnected choppy ends, airy piecey texture, relaxed movement, low-maintenance natural finish and realistic flyaways',
         N'/images/services/hair-cut.png', N'#6b4d40', N'Cắt & tạo kiểu tóc', 18, CAST(95.00 AS DECIMAL(5,2)),
         N'https://www.elle.com/beauty/hair/a71411938/bob-hairstyles-summer-2026-trends/', N'hairtrend_fragmented_bob_2026'),
        (N'MODERN_RACHEL_2026', N'Modern Rachel layers', N'CUT', N'MEDIUM', N'WAVY', N'MEDIUM', N'FEMALE',
         N'Layer trái tim hiện đại tạo độ nảy quanh gò má và giữ mật độ khỏe ở phần đuôi.',
         N'female modern Rachel haircut, heart-shaped face-framing layers, bouncy cheekbone volume, healthy dense lengths, soft polished movement and natural strands',
         N'/images/services/hair-cut.png', N'#7a5a43', N'Cắt & tạo kiểu tóc', 19, CAST(98.00 AS DECIMAL(5,2)),
         N'https://www.marieclaire.com/beauty/hair/best-haircut-trends-2026/', N'hairtrend_modern_rachel_2026'),
        (N'COLLARBONE_LOB_2026', N'Collarbone lob', N'CUT', N'MEDIUM', N'STRAIGHT', N'LOW', N'FEMALE',
         N'Lob chạm xương quai xanh, đường viền khỏe và layer tối giản giúp tóc trông dày, linh hoạt.',
         N'female collarbone lob haircut, strong shoulder-skimming outline, minimal invisible layers, healthy full ends, effortless natural movement and realistic density',
         N'/images/services/hair-cut.png', N'#513c33', N'Cắt & tạo kiểu tóc', 20, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.marieclaire.com/beauty/hair/best-haircut-trends-2026/', N'hairtrend_collarbone_lob_2026'),
        (N'COWBOY_BOB_2026', N'Cowboy bob nhiều texture', N'CUT', N'SHORT', N'WAVY', N'LOW', N'FEMALE',
         N'Bob phóng khoáng kết hợp nét shag, layer có chuyển động và mái dài nhẹ cho vẻ tự nhiên.',
         N'female cowboy bob haircut, relaxed jaw-length shaggy layers, soft long fringe, lived-in western texture, natural bends and wispy realistic ends',
         N'/images/services/hair-cut.png', N'#8a6247', N'Cắt & tạo kiểu tóc', 21, CAST(93.00 AS DECIMAL(5,2)),
         N'https://www.voguescandinavia.com/articles/hair-trends-2026', N'hairtrend_cowboy_bob_2026'),

        (N'HEARTTHROB_FLOW_2026', N'90s heartthrob flow', N'TEXTURE', N'MEDIUM', N'WAVY', N'MEDIUM', N'MALE',
         N'Phom tóc nam 90s có mái rủ tách nhẹ, hai bên chuyển động tự nhiên và giữ độ dài vừa phải.',
         N'male 2026 heartthrob flow haircut, medium 1990s layered shape, softly parted falling fringe, natural side movement, realistic masculine hairline and density',
         N'/images/services/hair-curl.png', N'#342a26', N'Uốn tóc setting', 27, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_heartthrob_flow_2026'),
        (N'HIGH_TOP_FADE_2026', N'High-top fade hiện đại', N'CUT', N'SHORT', N'CURLY', N'MEDIUM', N'MALE',
         N'High-top fade được làm mềm với kết cấu tự nhiên trên đỉnh và chuyển fade sạch nhưng không giả.',
         N'male modern high-top fade, structured natural textured top, clean graduated sides, realistic coily density, soft scalp transition and authentic hairline',
         N'/images/services/hair-cut.png', N'#211e1c', N'Cắt & tạo kiểu tóc', 28, CAST(91.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_high_top_fade_2026'),
        (N'CREW_CUT_TAPER_2026', N'Crew cut taper', N'CUT', N'SHORT', N'STRAIGHT', N'LOW', N'MALE',
         N'Crew cut ngắn dễ chăm sóc, phần đỉnh còn đủ kết cấu và hai bên taper chuyển vùng mềm.',
         N'male modern crew cut with low taper, short textured top, softly graduated sides, natural scalp visibility, believable temple transition and hairline',
         N'/images/services/hair-cut.png', N'#292523', N'Cắt & tạo kiểu tóc', 29, CAST(95.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-short-haircuts-for-men-2026', N'hairtrend_crew_taper_2026'),
        (N'TEXTURED_BOWL_2026', N'Textured bowl hiện đại', N'CUT', N'SHORT', N'STRAIGHT', N'MEDIUM', N'MALE',
         N'Bowl cut thế hệ mới có viền mềm, layer phá khối và kết cấu tự nhiên thay cho đường cắt cứng.',
         N'male modern textured bowl cut, softened rounded fringe, broken-up layered perimeter, subtle taper, natural piecey strands and realistic non-uniform edges',
         N'/images/services/hair-cut.png', N'#3b302b', N'Cắt & tạo kiểu tóc', 30, CAST(89.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_textured_bowl_2026'),
        (N'BRO_FLOW_2026', N'Bro flow tự nhiên', N'TEXTURE', N'MEDIUM', N'WAVY', N'LOW', N'MALE',
         N'Tóc nam dài vừa vuốt lùi tự nhiên, để lộ khuôn mặt và giữ chuyển động mềm theo chất tóc.',
         N'male natural bro flow haircut, medium swept-back layers, relaxed air-dried waves, open forehead, believable hairline, soft movement and realistic flyaways',
         N'/images/services/hair-curl.png', N'#49372f', N'Uốn tóc setting', 31, CAST(94.00 AS DECIMAL(5,2)),
         N'https://www.gq.com/story/best-hair-trends-for-men-2026', N'hairtrend_bro_flow_2026'),

        (N'CHAMPAGNE_BRUNETTE_2026', N'Champagne brunette', N'COLOR', NULL, NULL, N'LOW', N'UNISEX',
         N'Nâu champagne có chân tóc tự nhiên và dải sáng be nhẹ ở thân, tạo chiều sâu dễ duy trì.',
         N'keep the exact haircut and recolor only the hair to 2026 champagne brunette, natural brunette roots melting into muted beige highlights, dimensional healthy shine and realistic strands',
         N'/images/services/hair-highlight.png', N'#9a7b63', N'Nhuộm tóc thời trang', 32, CAST(98.00 AS DECIMAL(5,2)),
         N'https://www.vogue.com/article/hair-color-trends-2026', N'hairtrend_champagne_brunette_2026'),
        (N'CHERRY_MOCHA_2026', N'Cherry mocha', N'COLOR', NULL, NULL, N'MEDIUM', N'UNISEX',
         N'Nền brunette sâu pha ánh cherry và copper kín đáo, nổi rõ dưới ánh sáng nhưng vẫn tự nhiên.',
         N'keep the exact haircut and recolor only the hair to deep cherry mocha brunette, subtle red-copper undertone, dark natural roots, dimensional lowlights and realistic shine',
         N'/images/services/hair-color.png', N'#5f292b', N'Nhuộm tóc thời trang', 33, CAST(97.00 AS DECIMAL(5,2)),
         N'https://www.vogue.com/article/hair-color-trends-2026', N'hairtrend_cherry_mocha_2026'),
        (N'TOASTED_COPPER_2026', N'Toasted copper balayage', N'COLOR', NULL, NULL, N'MEDIUM', N'UNISEX',
         N'Copper nướng ấm kết hợp balayage mềm và root melt, tạo sắc đỏ vàng có chiều sâu.',
         N'keep the exact haircut and recolor only the hair to toasted copper with soft balayage highlights, subtle brunette root melt, warm dimensional depth and photorealistic strand variation',
         N'/images/services/hair-highlight.png', N'#a65f3f', N'Nhuộm tóc thời trang', 34, CAST(96.00 AS DECIMAL(5,2)),
         N'https://www.ellecanada.com/beauty/hair/spring-hair-colour-trends-2026', N'hairtrend_toasted_copper_2026')
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
    IsActive = 1,
    IsTrending = 1,
    TrendScore = source.TrendScore,
    TrendYear = 2026,
    TrendSourceUrl = source.TrendSourceUrl,
    TrendLastVerifiedAt = CONVERT(DATETIME2(0), '2026-07-24T00:00:00'),
    LoraTrigger = source.LoraTrigger,
    PromptVersion = N'v3-trends-2026',
    UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
    StyleCode, StyleName, StyleType, HairLength, HairTexture, MaintenanceLevel, Audience,
    Description, PromptTemplate, ThumbnailUrl, AccentColor, ServiceId, SortOrder, IsActive,
    IsTrending, TrendScore, TrendYear, TrendSourceUrl, TrendLastVerifiedAt, LoraTrigger, PromptVersion
) VALUES (
    source.StyleCode, source.StyleName, source.StyleType, source.HairLength, source.HairTexture,
    source.MaintenanceLevel, source.Audience, source.Description, source.PromptTemplate,
    source.ThumbnailUrl, source.AccentColor, source.ServiceId, source.SortOrder, 1,
    1, source.TrendScore, 2026, source.TrendSourceUrl,
    CONVERT(DATETIME2(0), '2026-07-24T00:00:00'), source.LoraTrigger, N'v3-trends-2026'
);

COMMIT TRANSACTION;
GO
