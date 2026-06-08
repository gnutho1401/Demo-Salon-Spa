const { sql, connectDB } = require("../../config/db");

async function getAll() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT 
      s.ServiceId,
      s.ServiceName,
      s.Description,
      s.DurationMinutes,
      s.Price,
      s.Status,
      s.ImageUrl,
      c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY s.ServiceId DESC
  `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("ServiceId", sql.Int, id).query(`
      SELECT 
        s.ServiceId,
        s.ServiceName,
        s.Description,
        s.DurationMinutes,
        s.Price,
        s.Status,
        s.ImageUrl,
        c.CategoryName
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      WHERE s.ServiceId = @ServiceId
    `);

  return result.recordset[0];
}

module.exports = { getAll, getById };
