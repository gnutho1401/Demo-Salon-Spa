const { sql, connectDB } = require("../../config/db");

function text(v) {
  return String(v || "").trim();
}

function nullable(v) {
  const x = text(v);
  return x || null;
}

function toInt(v, fallback = null) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function status(v, fallback = "PENDING") {
  return String(v || fallback)
    .trim()
    .toUpperCase();
}

function dateOnly(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const rating = toInt(filters.rating);
  const reviewStatus = filters.status ? status(filters.status) : null;
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Rating", sql.Int, rating)
    .input("Status", sql.NVarChar, reviewStatus)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
      SELECT
        r.ReviewId,
        r.AppointmentId,
        r.CustomerId,
        r.ServiceId,
        r.EmployeeId,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.AdminResponse,
        r.CreatedAt,
        r.UpdatedAt,
        cu.FullName AS CustomerName,
        cu.Email AS CustomerEmail,
        cu.AvatarUrl AS CustomerAvatar,
        s.ServiceName,
        s.ImageUrl AS ServiceImage,
        eu.FullName AS EmployeeName,
        eu.AvatarUrl AS EmployeeAvatar,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status AS AppointmentStatus,
        (
          SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
          FROM ReviewImages ri
          WHERE ri.ReviewId = r.ReviewId
          ORDER BY ri.ReviewImageId ASC
          FOR JSON PATH
        ) AS ImagesJson
      FROM Reviews r
      LEFT JOIN Customers c ON r.CustomerId = c.CustomerId
      LEFT JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      WHERE
        (@Keyword IS NULL
          OR cu.FullName LIKE @Keyword
          OR cu.Email LIKE @Keyword
          OR s.ServiceName LIKE @Keyword
          OR eu.FullName LIKE @Keyword
          OR ISNULL(r.Comment, N'') LIKE @Keyword)
        AND (@Rating IS NULL OR r.Rating = @Rating)
        AND (@Status IS NULL OR r.Status = @Status)
        AND (@FromDate IS NULL OR CAST(r.CreatedAt AS DATE) >= @FromDate)
        AND (@ToDate IS NULL OR CAST(r.CreatedAt AS DATE) <= @ToDate)
      ORDER BY r.CreatedAt DESC, r.ReviewId DESC
    `);

  return result.recordset.map((row) => {
    try {
      row.ReviewImages = row.ImagesJson ? JSON.parse(row.ImagesJson) : [];
    } catch {
      row.ReviewImages = [];
    }
    delete row.ImagesJson;
    return row;
  });
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("ReviewId", sql.Int, Number(id))
    .query(`
      SELECT
        r.ReviewId,
        r.AppointmentId,
        r.CustomerId,
        r.ServiceId,
        r.EmployeeId,
        r.Rating,
        r.TechnicianRating,
        r.Comment,
        r.Status,
        r.AdminResponse,
        r.CreatedAt,
        r.UpdatedAt,
        cu.FullName AS CustomerName,
        cu.Email AS CustomerEmail,
        cu.Phone AS CustomerPhone,
        cu.AvatarUrl AS CustomerAvatar,
        s.ServiceName,
        s.ImageUrl AS ServiceImage,
        eu.FullName AS EmployeeName,
        eu.Email AS EmployeeEmail,
        eu.AvatarUrl AS EmployeeAvatar,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status AS AppointmentStatus,
        (
          SELECT ri.ReviewImageId, ri.ImageUrl, ri.CreatedAt
          FROM ReviewImages ri
          WHERE ri.ReviewId = r.ReviewId
          ORDER BY ri.ReviewImageId ASC
          FOR JSON PATH
        ) AS ImagesJson
      FROM Reviews r
      LEFT JOIN Customers c ON r.CustomerId = c.CustomerId
      LEFT JOIN Users cu ON c.UserId = cu.UserId
      LEFT JOIN Services s ON r.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON r.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Appointments a ON r.AppointmentId = a.AppointmentId
      WHERE r.ReviewId = @ReviewId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy review");
  try {
    row.ReviewImages = row.ImagesJson ? JSON.parse(row.ImagesJson) : [];
  } catch {
    row.ReviewImages = [];
  }
  delete row.ImagesJson;
  return row;
}

async function changeStatus(id, data = {}) {
  const nextStatus = status(data.Status ?? data.status);

  if (!["PENDING", "APPROVED", "REJECTED", "HIDDEN"].includes(nextStatus)) {
    throw new Error("Trạng thái review không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("ReviewId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Reviews
      SET Status = @Status,
          UpdatedAt = GETDATE()
      WHERE ReviewId = @ReviewId
    `);

  return getById(id);
}

async function respond(id, data = {}) {
  const adminResponse = nullable(data.AdminResponse ?? data.adminResponse);

  if (!adminResponse) throw new Error("Nội dung phản hồi không được để trống");

  const pool = await connectDB();

  await pool
    .request()
    .input("ReviewId", sql.Int, Number(id))
    .input("AdminResponse", sql.NVarChar, adminResponse).query(`
      UPDATE Reviews
      SET AdminResponse = @AdminResponse,
          UpdatedAt = GETDATE()
      WHERE ReviewId = @ReviewId
    `);

  return getById(id);
}

async function removeResponse(id) {
  const pool = await connectDB();

  await pool.request().input("ReviewId", sql.Int, Number(id)).query(`
      UPDATE Reviews
      SET AdminResponse = NULL,
          UpdatedAt = GETDATE()
      WHERE ReviewId = @ReviewId
    `);

  return getById(id);
}

module.exports = {
  list,
  getById,
  changeStatus,
  respond,
  removeResponse,
};
