const { sql, connectDB } = require("../../config/db");
const adminServicesService = require("../admin/adminServices.service");

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

  const service = result.recordset[0];
  if (!service) return null;

  const reviewsResult = await pool.request().input("ServiceId", sql.Int, id).query(`
      SELECT 
        r.ReviewId,
        r.Rating,
        r.Comment,
        r.CreatedAt,
        u.FullName AS CustomerName,
        u.AvatarUrl AS CustomerAvatar
      FROM Reviews r
      JOIN Customers c ON r.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE r.ServiceId = @ServiceId AND r.Status = 'APPROVED'
      ORDER BY r.CreatedAt DESC
    `);

  return {
    ...service,
    Reviews: reviewsResult.recordset,
  };
}

async function create(data) {
  return adminServicesService.create(data);
}

async function update(id, data) {
  return adminServicesService.update(id, data);
}

async function remove(id) {
  return adminServicesService.remove(id);
}

module.exports = { getAll, getById, create, update, remove };

