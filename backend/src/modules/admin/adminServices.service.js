const { sql, connectDB } = require("../../config/db");

function text(value) {
  return String(value || "").trim();
}

function nullable(value) {
  const v = text(value);
  return v || null;
}

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMoney(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(value, fallback = "AVAILABLE") {
  return String(value || fallback)
    .trim()
    .toUpperCase();
}

async function getCategories() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT CategoryId, CategoryName, Description, ImageUrl, Status
    FROM ServiceCategories
    WHERE Status = 'ACTIVE'
    ORDER BY CategoryName ASC
  `);

  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const categoryId = toInt(filters.categoryId);
  const status = filters.status ? normalizeStatus(filters.status) : null;

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("CategoryId", sql.Int, categoryId)
    .input("Status", sql.NVarChar, status).query(`
      SELECT
        s.ServiceId,
        s.CategoryId,
        s.ServiceName,
        s.Description,
        s.DurationMinutes,
        s.Price,
        s.ImageUrl,
        s.Status,
        c.CategoryName,
        c.Status AS CategoryStatus,
        ISNULL(app.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(app.CompletedCount, 0) AS CompletedCount,
        ISNULL(rv.ReviewCount, 0) AS ReviewCount,
        CAST(ISNULL(rv.AvgRating, 0) AS DECIMAL(10,2)) AS AvgRating,
        ISNULL(emp.TechnicianCount, 0) AS TechnicianCount
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT aps.AppointmentId) AS AppointmentCount,
          SUM(CASE WHEN a.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedCount
        FROM AppointmentServices aps
        LEFT JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
        WHERE aps.ServiceId = s.ServiceId
      ) app
      OUTER APPLY (
        SELECT
          COUNT(*) AS ReviewCount,
          AVG(CAST(r.Rating AS DECIMAL(10,2))) AS AvgRating
        FROM Reviews r
        WHERE r.ServiceId = s.ServiceId
          AND r.Status = 'APPROVED'
      ) rv
      OUTER APPLY (
        SELECT COUNT(*) AS TechnicianCount
        FROM EmployeeServices es
        JOIN Employees e ON es.EmployeeId = e.EmployeeId
        JOIN Users u ON e.UserId = u.UserId
        WHERE es.ServiceId = s.ServiceId
          AND e.Status = 'ACTIVE'
          AND u.Status = 'ACTIVE'
      ) emp
      WHERE
        (@Keyword IS NULL OR s.ServiceName LIKE @Keyword OR ISNULL(s.Description, N'') LIKE @Keyword OR c.CategoryName LIKE @Keyword)
        AND (@CategoryId IS NULL OR s.CategoryId = @CategoryId)
        AND (@Status IS NULL OR s.Status = @Status)
      ORDER BY s.ServiceId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("ServiceId", sql.Int, Number(id))
    .query(`
      SELECT
        s.ServiceId,
        s.CategoryId,
        s.ServiceName,
        s.Description,
        s.DurationMinutes,
        s.Price,
        s.ImageUrl,
        s.Status,
        c.CategoryName,
        c.Description AS CategoryDescription,
        c.Status AS CategoryStatus,
        ISNULL(app.AppointmentCount, 0) AS AppointmentCount,
        ISNULL(app.CompletedCount, 0) AS CompletedCount,
        ISNULL(rv.ReviewCount, 0) AS ReviewCount,
        CAST(ISNULL(rv.AvgRating, 0) AS DECIMAL(10,2)) AS AvgRating,
        ISNULL(emp.TechnicianCount, 0) AS TechnicianCount
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT aps.AppointmentId) AS AppointmentCount,
          SUM(CASE WHEN a.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedCount
        FROM AppointmentServices aps
        LEFT JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
        WHERE aps.ServiceId = s.ServiceId
      ) app
      OUTER APPLY (
        SELECT
          COUNT(*) AS ReviewCount,
          AVG(CAST(r.Rating AS DECIMAL(10,2))) AS AvgRating
        FROM Reviews r
        WHERE r.ServiceId = s.ServiceId
          AND r.Status = 'APPROVED'
      ) rv
      OUTER APPLY (
        SELECT COUNT(*) AS TechnicianCount
        FROM EmployeeServices es
        JOIN Employees e ON es.EmployeeId = e.EmployeeId
        JOIN Users u ON e.UserId = u.UserId
        WHERE es.ServiceId = s.ServiceId
          AND e.Status = 'ACTIVE'
          AND u.Status = 'ACTIVE'
      ) emp
      WHERE s.ServiceId = @ServiceId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy dịch vụ");
  return row;
}

async function create(data) {
  const categoryId = toInt(data.categoryId || data.CategoryId);
  const serviceName = text(data.serviceName || data.ServiceName);
  const description = nullable(data.description || data.Description);
  const durationMinutes = toInt(data.durationMinutes || data.DurationMinutes);
  const price = toMoney(data.price || data.Price);
  const imageUrl = nullable(data.imageUrl || data.ImageUrl);
  const status = normalizeStatus(data.status || data.Status, "AVAILABLE");

  if (!categoryId) throw new Error("Vui lòng chọn danh mục");
  if (!serviceName) throw new Error("Tên dịch vụ không được để trống");
  if (!durationMinutes || durationMinutes <= 0)
    throw new Error("Thời lượng không hợp lệ");
  if (price === null || price < 0) throw new Error("Giá dịch vụ không hợp lệ");

  const pool = await connectDB();

  const categoryCheck = await pool
    .request()
    .input("CategoryId", sql.Int, categoryId).query(`
      SELECT TOP 1 CategoryId
      FROM ServiceCategories
      WHERE CategoryId = @CategoryId
    `);

  if (!categoryCheck.recordset[0]) throw new Error("Danh mục không tồn tại");

  const existed = await pool
    .request()
    .input("ServiceName", sql.NVarChar, serviceName).query(`
      SELECT TOP 1 ServiceId
      FROM Services
      WHERE LOWER(ServiceName) = LOWER(@ServiceName)
    `);

  if (existed.recordset[0]) throw new Error("Tên dịch vụ đã tồn tại");

  const result = await pool
    .request()
    .input("CategoryId", sql.Int, categoryId)
    .input("ServiceName", sql.NVarChar, serviceName)
    .input("Description", sql.NVarChar, description)
    .input("DurationMinutes", sql.Int, durationMinutes)
    .input("Price", sql.Decimal(18, 2), price)
    .input("ImageUrl", sql.NVarChar, imageUrl)
    .input("Status", sql.NVarChar, status).query(`
      INSERT INTO Services
        (CategoryId, ServiceName, Description, DurationMinutes, Price, ImageUrl, Status)
      OUTPUT INSERTED.ServiceId
      VALUES
        (@CategoryId, @ServiceName, @Description, @DurationMinutes, @Price, @ImageUrl, @Status)
    `);

  return getById(result.recordset[0].ServiceId);
}

async function update(id, data) {
  const current = await getById(id);

  const categoryId =
    data.categoryId !== undefined || data.CategoryId !== undefined
      ? toInt(data.categoryId || data.CategoryId)
      : current.CategoryId;

  const serviceName =
    data.serviceName !== undefined || data.ServiceName !== undefined
      ? text(data.serviceName || data.ServiceName)
      : current.ServiceName;

  const description =
    data.description !== undefined || data.Description !== undefined
      ? nullable(data.description || data.Description)
      : current.Description;

  const durationMinutes =
    data.durationMinutes !== undefined || data.DurationMinutes !== undefined
      ? toInt(data.durationMinutes || data.DurationMinutes)
      : current.DurationMinutes;

  const price =
    data.price !== undefined || data.Price !== undefined
      ? toMoney(data.price || data.Price)
      : current.Price;

  const imageUrl =
    data.imageUrl !== undefined || data.ImageUrl !== undefined
      ? nullable(data.imageUrl || data.ImageUrl)
      : current.ImageUrl;

  const status = normalizeStatus(
    data.status || data.Status || current.Status,
    current.Status,
  );

  if (!categoryId) throw new Error("Vui lòng chọn danh mục");
  if (!serviceName) throw new Error("Tên dịch vụ không được để trống");
  if (!durationMinutes || durationMinutes <= 0)
    throw new Error("Thời lượng không hợp lệ");
  if (price === null || price < 0) throw new Error("Giá dịch vụ không hợp lệ");

  const pool = await connectDB();

  const categoryCheck = await pool
    .request()
    .input("CategoryId", sql.Int, categoryId).query(`
      SELECT TOP 1 CategoryId
      FROM ServiceCategories
      WHERE CategoryId = @CategoryId
    `);

  if (!categoryCheck.recordset[0]) throw new Error("Danh mục không tồn tại");

  const existed = await pool
    .request()
    .input("ServiceId", sql.Int, Number(id))
    .input("ServiceName", sql.NVarChar, serviceName).query(`
      SELECT TOP 1 ServiceId
      FROM Services
      WHERE LOWER(ServiceName) = LOWER(@ServiceName)
        AND ServiceId <> @ServiceId
    `);

  if (existed.recordset[0]) throw new Error("Tên dịch vụ đã tồn tại");

  await pool
    .request()
    .input("ServiceId", sql.Int, Number(id))
    .input("CategoryId", sql.Int, categoryId)
    .input("ServiceName", sql.NVarChar, serviceName)
    .input("Description", sql.NVarChar, description)
    .input("DurationMinutes", sql.Int, durationMinutes)
    .input("Price", sql.Decimal(18, 2), price)
    .input("ImageUrl", sql.NVarChar, imageUrl)
    .input("Status", sql.NVarChar, status).query(`
      UPDATE Services
      SET CategoryId = @CategoryId,
          ServiceName = @ServiceName,
          Description = @Description,
          DurationMinutes = @DurationMinutes,
          Price = @Price,
          ImageUrl = @ImageUrl,
          Status = @Status
      WHERE ServiceId = @ServiceId
    `);

  return getById(id);
}

async function changeStatus(id, data) {
  const current = await getById(id);

  const nextStatus = normalizeStatus(
    data.status ||
      data.Status ||
      (current.Status === "AVAILABLE" ? "INACTIVE" : "AVAILABLE"),
  );

  if (!["AVAILABLE", "INACTIVE", "HIDDEN"].includes(nextStatus)) {
    throw new Error("Trạng thái dịch vụ không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("ServiceId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Services
      SET Status = @Status
      WHERE ServiceId = @ServiceId
    `);

  return getById(id);
}

async function remove(id) {
  await getById(id);

  const pool = await connectDB();

  await pool.request().input("ServiceId", sql.Int, Number(id)).query(`
      UPDATE Services
      SET Status = 'UNAVAILABLE',
          UpdatedAt = GETDATE()
      WHERE ServiceId = @ServiceId
    `);

  return getById(id);
}

module.exports = {
  getCategories,
  list,
  getById,
  create,
  update,
  changeStatus,
  remove,
};
