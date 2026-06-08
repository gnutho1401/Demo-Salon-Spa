const { sql, connectDB } = require('../../config/db');

async function getAll() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT MembershipLevelId, LevelName, MinPoints, DiscountPercent, Description
    FROM MembershipLevels
    ORDER BY MinPoints ASC
  `);
  return result.recordset;
}

async function getMine(userId) {
  const pool = await connectDB();
  const profile = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT TOP 1
      c.CustomerId, c.LoyaltyPoints,
      COALESCE(ml.MembershipLevelId, currentLevel.MembershipLevelId) AS MembershipLevelId,
      COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS LevelName,
      COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent,
      nextLevel.LevelName AS NextLevelName,
      nextLevel.MinPoints AS NextLevelMinPoints
    FROM Customers c
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels y
      WHERE y.MinPoints > c.LoyaltyPoints
      ORDER BY y.MinPoints ASC
    ) nextLevel
    WHERE c.UserId = @UserId
  `);
  if (!profile.recordset[0]) throw new Error('Không tìm thấy thông tin thành viên');
  return profile.recordset[0];
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input('MembershipLevelId', sql.Int, id).query(`
    SELECT * FROM MembershipLevels WHERE MembershipLevelId = @MembershipLevelId
  `);
  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();
  const result = await pool.request()
    .input('LevelName', sql.NVarChar, data.levelName || data.LevelName)
    .input('MinPoints', sql.Int, data.minPoints || data.MinPoints || 0)
    .input('DiscountPercent', sql.Decimal(5, 2), data.discountPercent || data.DiscountPercent || 0)
    .input('Description', sql.NVarChar, data.description || data.Description || null)
    .query(`
      INSERT INTO MembershipLevels (LevelName, MinPoints, DiscountPercent, Description)
      OUTPUT INSERTED.*
      VALUES (@LevelName, @MinPoints, @DiscountPercent, @Description)
    `);
  return result.recordset[0];
}

async function update(id, data) {
  const pool = await connectDB();
  await pool.request()
    .input('MembershipLevelId', sql.Int, id)
    .input('LevelName', sql.NVarChar, data.levelName || data.LevelName || null)
    .input('MinPoints', sql.Int, data.minPoints || data.MinPoints || null)
    .input('DiscountPercent', sql.Decimal(5, 2), data.discountPercent || data.DiscountPercent || null)
    .input('Description', sql.NVarChar, data.description || data.Description || null)
    .query(`
      UPDATE MembershipLevels SET
        LevelName = COALESCE(@LevelName, LevelName),
        MinPoints = COALESCE(@MinPoints, MinPoints),
        DiscountPercent = COALESCE(@DiscountPercent, DiscountPercent),
        Description = COALESCE(@Description, Description)
      WHERE MembershipLevelId = @MembershipLevelId
    `);
  return getById(id);
}

async function remove(id) {
  const pool = await connectDB();
  await pool.request().input('MembershipLevelId', sql.Int, id).query('DELETE FROM MembershipLevels WHERE MembershipLevelId = @MembershipLevelId');
  return { MembershipLevelId: Number(id) };
}

module.exports = { getAll, getMine, getById, create, update, remove };
