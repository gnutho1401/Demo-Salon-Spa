const { sql, connectDB } = require("../../config/db");

function text(value) {
  return String(value || "").trim();
}

function nullable(value) {
  const v = text(value);
  return v || null;
}

function toInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toPercent(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readPayload(data = {}) {
  const levelName = text(data.LevelName ?? data.levelName);
  const minPoints = toInt(data.MinPoints ?? data.minPoints, 0);
  const discountPercent = toPercent(
    data.DiscountPercent ?? data.discountPercent,
    0,
  );
  const description = nullable(data.Description ?? data.description);

  if (!levelName) throw new Error("Tên hạng membership không được để trống");
  if (minPoints < 0) throw new Error("Điểm tối thiểu không hợp lệ");
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error("Phần trăm giảm giá phải từ 0 đến 100");
  }

  return { levelName, minPoints, discountPercent, description };
}

async function ensureUniqueName(pool, levelName, excludeId = null) {
  const result = await pool
    .request()
    .input("LevelName", sql.NVarChar, levelName)
    .input("ExcludeId", sql.Int, excludeId).query(`
      SELECT TOP 1 MembershipLevelId
      FROM MembershipLevels
      WHERE LOWER(LevelName) = LOWER(@LevelName)
        AND (CAST(@ExcludeId AS INT) IS NULL OR MembershipLevelId <> CAST(@ExcludeId AS INT))
    `);

  if (result.recordset[0]) throw new Error("Tên hạng membership đã tồn tại");
}

async function list(filters = {}) {
  const pool = await connectDB();
  const keyword = text(filters.keyword);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null).query(`
      SELECT
        ml.MembershipLevelId,
        ml.LevelName,
        ml.MinPoints,
        ml.DiscountPercent,
        ml.Description,
        COUNT(c.CustomerId) AS CustomerCount,
        ISNULL(SUM(c.LoyaltyPoints), 0) AS TotalCustomerPoints,
        ISNULL(AVG(CAST(c.LoyaltyPoints AS DECIMAL(18,2))), 0) AS AvgCustomerPoints
      FROM MembershipLevels ml
      LEFT JOIN Customers c ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE
        @Keyword IS NULL
        OR ml.LevelName LIKE @Keyword
        OR ISNULL(ml.Description, N'') LIKE @Keyword
      GROUP BY
        ml.MembershipLevelId,
        ml.LevelName,
        ml.MinPoints,
        ml.DiscountPercent,
        ml.Description
      ORDER BY ml.MinPoints ASC, ml.MembershipLevelId ASC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("MembershipLevelId", sql.Int, Number(id)).query(`
      SELECT
        ml.MembershipLevelId,
        ml.LevelName,
        ml.MinPoints,
        ml.DiscountPercent,
        ml.Description,
        COUNT(c.CustomerId) AS CustomerCount,
        ISNULL(SUM(c.LoyaltyPoints), 0) AS TotalCustomerPoints,
        ISNULL(AVG(CAST(c.LoyaltyPoints AS DECIMAL(18,2))), 0) AS AvgCustomerPoints
      FROM MembershipLevels ml
      LEFT JOIN Customers c ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE ml.MembershipLevelId = @MembershipLevelId
      GROUP BY
        ml.MembershipLevelId,
        ml.LevelName,
        ml.MinPoints,
        ml.DiscountPercent,
        ml.Description
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy hạng membership");
  return row;
}

async function getCustomersByLevel(id) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input("MembershipLevelId", sql.Int, Number(id)).query(`
      SELECT TOP 20
        c.CustomerId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        c.LoyaltyPoints,
        c.CreatedAt
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE c.MembershipLevelId = @MembershipLevelId
      ORDER BY c.LoyaltyPoints DESC, c.CustomerId DESC
    `);

  return result.recordset;
}

async function create(data) {
  const payload = readPayload(data);
  const pool = await connectDB();

  await ensureUniqueName(pool, payload.levelName);

  const result = await pool
    .request()
    .input("LevelName", sql.NVarChar, payload.levelName)
    .input("MinPoints", sql.Int, payload.minPoints)
    .input("DiscountPercent", sql.Decimal(5, 2), payload.discountPercent)
    .input("Description", sql.NVarChar, payload.description).query(`
      INSERT INTO MembershipLevels
        (LevelName, MinPoints, DiscountPercent, Description)
      OUTPUT INSERTED.MembershipLevelId
      VALUES
        (@LevelName, @MinPoints, @DiscountPercent, @Description)
    `);

  return getById(result.recordset[0].MembershipLevelId);
}

async function update(id, data) {
  const current = await getById(id);

  const payload = readPayload({
    LevelName: data.LevelName ?? data.levelName ?? current.LevelName,
    MinPoints: data.MinPoints ?? data.minPoints ?? current.MinPoints,
    DiscountPercent:
      data.DiscountPercent ?? data.discountPercent ?? current.DiscountPercent,
    Description: data.Description ?? data.description ?? current.Description,
  });

  const pool = await connectDB();

  await ensureUniqueName(pool, payload.levelName, Number(id));

  await pool
    .request()
    .input("MembershipLevelId", sql.Int, Number(id))
    .input("LevelName", sql.NVarChar, payload.levelName)
    .input("MinPoints", sql.Int, payload.minPoints)
    .input("DiscountPercent", sql.Decimal(5, 2), payload.discountPercent)
    .input("Description", sql.NVarChar, payload.description).query(`
      UPDATE MembershipLevels
      SET LevelName = @LevelName,
          MinPoints = @MinPoints,
          DiscountPercent = @DiscountPercent,
          Description = @Description
      WHERE MembershipLevelId = @MembershipLevelId
    `);

  return getById(id);
}

async function remove(id) {
  const current = await getById(id);

  if (Number(current.CustomerCount || 0) > 0) {
    throw new Error("Không thể xóa hạng membership đang có customer sử dụng");
  }

  const pool = await connectDB();

  await pool.request().input("MembershipLevelId", sql.Int, Number(id)).query(`
      DELETE FROM MembershipLevels
      WHERE MembershipLevelId = @MembershipLevelId
    `);

  return { MembershipLevelId: Number(id) };
}

module.exports = {
  list,
  getById,
  getCustomersByLevel,
  create,
  update,
  remove,
};
