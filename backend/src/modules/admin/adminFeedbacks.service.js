const { sql, connectDB } = require("../../config/db");

function text(v) {
  return String(v || "").trim();
}

function nullable(v) {
  const x = text(v);
  return x || null;
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
  const feedbackStatus = filters.status ? status(filters.status) : null;
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Status", sql.NVarChar, feedbackStatus)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
      SELECT
        f.FeedbackId,
        f.CustomerId,
        f.Subject,
        f.Content,
        f.Status,
        f.AdminResponse,
        f.CreatedAt,
        f.UpdatedAt,
        u.FullName AS CustomerName,
        u.Email AS CustomerEmail,
        u.Phone AS CustomerPhone,
        u.AvatarUrl AS CustomerAvatar,
        c.LoyaltyPoints,
        ml.LevelName AS MembershipLevelName
      FROM Feedbacks f
      LEFT JOIN Customers c ON f.CustomerId = c.CustomerId
      LEFT JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE
        (@Keyword IS NULL
          OR f.Subject LIKE @Keyword
          OR f.Content LIKE @Keyword
          OR ISNULL(f.AdminResponse, N'') LIKE @Keyword
          OR u.FullName LIKE @Keyword
          OR u.Email LIKE @Keyword)
        AND (@Status IS NULL OR f.Status = @Status)
        AND (@FromDate IS NULL OR CAST(f.CreatedAt AS DATE) >= @FromDate)
        AND (@ToDate IS NULL OR CAST(f.CreatedAt AS DATE) <= @ToDate)
      ORDER BY f.CreatedAt DESC, f.FeedbackId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("FeedbackId", sql.Int, Number(id))
    .query(`
      SELECT
        f.FeedbackId,
        f.CustomerId,
        f.Subject,
        f.Content,
        f.Status,
        f.AdminResponse,
        f.CreatedAt,
        f.UpdatedAt,
        u.FullName AS CustomerName,
        u.Email AS CustomerEmail,
        u.Phone AS CustomerPhone,
        u.AvatarUrl AS CustomerAvatar,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        ml.LevelName AS MembershipLevelName
      FROM Feedbacks f
      LEFT JOIN Customers c ON f.CustomerId = c.CustomerId
      LEFT JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      WHERE f.FeedbackId = @FeedbackId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy feedback");
  return row;
}

async function changeStatus(id, data = {}) {
  const nextStatus = status(data.Status ?? data.status);

  if (
    !["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"].includes(
      nextStatus,
    )
  ) {
    throw new Error("Trạng thái feedback không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("FeedbackId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Feedbacks
      SET Status = @Status,
          UpdatedAt = GETDATE()
      WHERE FeedbackId = @FeedbackId
    `);

  return getById(id);
}

async function respond(id, data = {}) {
  const adminResponse = nullable(data.AdminResponse ?? data.adminResponse);
  const nextStatus = status(data.Status ?? data.status ?? "RESOLVED");

  if (!adminResponse) throw new Error("Nội dung phản hồi không được để trống");

  if (
    !["PENDING", "IN_PROGRESS", "RESOLVED", "REJECTED", "CLOSED"].includes(
      nextStatus,
    )
  ) {
    throw new Error("Trạng thái feedback không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("FeedbackId", sql.Int, Number(id))
    .input("AdminResponse", sql.NVarChar, adminResponse)
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Feedbacks
      SET AdminResponse = @AdminResponse,
          Status = @Status,
          UpdatedAt = GETDATE()
      WHERE FeedbackId = @FeedbackId
    `);

  return getById(id);
}

async function removeResponse(id) {
  const pool = await connectDB();

  await pool.request().input("FeedbackId", sql.Int, Number(id)).query(`
      UPDATE Feedbacks
      SET AdminResponse = NULL,
          UpdatedAt = GETDATE()
      WHERE FeedbackId = @FeedbackId
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
