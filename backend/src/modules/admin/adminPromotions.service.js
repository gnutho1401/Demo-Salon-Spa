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

function normalizeStatus(value, fallback = "ACTIVE") {
  return String(value || fallback)
    .trim()
    .toUpperCase();
}

function normalizePercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Phần trăm giảm giá không hợp lệ");
  if (n <= 0 || n > 100)
    throw new Error("Phần trăm giảm giá phải từ 1 đến 100");
  return n;
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Ngày không hợp lệ");
  return d.toISOString().slice(0, 10);
}

function validateDateRange(startDate, endDate) {
  if (!startDate) throw new Error("Vui lòng chọn ngày bắt đầu");
  if (!endDate) throw new Error("Vui lòng chọn ngày kết thúc");
  if (new Date(startDate) > new Date(endDate)) {
    throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
  }
}

async function getServices() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      s.ImageUrl,
      s.Price,
      s.DurationMinutes,
      s.Status,
      c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY s.ServiceName ASC
  `);

  return result.recordset;
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const status = filters.status ? normalizeStatus(filters.status) : null;
  const fromDate = normalizeDate(filters.fromDate);
  const toDate = normalizeDate(filters.toDate);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Status", sql.NVarChar, status)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
      SELECT
        p.PromotionId,
        p.Title,
        p.Description,
        p.DiscountPercent,
        p.ImageUrl,
        p.StartDate,
        p.EndDate,
        p.Status,
        CASE
          WHEN p.Status <> 'ACTIVE' THEN 'INACTIVE'
          WHEN CAST(GETDATE() AS DATE) < p.StartDate THEN 'UPCOMING'
          WHEN CAST(GETDATE() AS DATE) > p.EndDate THEN 'EXPIRED'
          ELSE 'RUNNING'
        END AS RuntimeStatus,
        ISNULL(sp.ServiceCount, 0) AS ServiceCount,
        ISNULL(svc.ServiceNames, N'') AS ServiceNames
      FROM Promotions p
      OUTER APPLY (
        SELECT COUNT(*) AS ServiceCount
        FROM ServicePromotions sp
        WHERE sp.PromotionId = p.PromotionId
      ) sp
      OUTER APPLY (
        SELECT STRING_AGG(s.ServiceName, N', ') AS ServiceNames
        FROM ServicePromotions sp2
        JOIN Services s ON sp2.ServiceId = s.ServiceId
        WHERE sp2.PromotionId = p.PromotionId
      ) svc
      WHERE
        (@Keyword IS NULL OR p.Title LIKE @Keyword OR ISNULL(p.Description, N'') LIKE @Keyword)
        AND (@Status IS NULL OR p.Status = @Status)
        AND (@FromDate IS NULL OR p.StartDate >= @FromDate)
        AND (@ToDate IS NULL OR p.EndDate <= @ToDate)
      ORDER BY p.PromotionId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("PromotionId", sql.Int, Number(id))
    .query(`
      SELECT
        p.PromotionId,
        p.Title,
        p.Description,
        p.DiscountPercent,
        p.ImageUrl,
        p.StartDate,
        p.EndDate,
        p.Status,
        CASE
          WHEN p.Status <> 'ACTIVE' THEN 'INACTIVE'
          WHEN CAST(GETDATE() AS DATE) < p.StartDate THEN 'UPCOMING'
          WHEN CAST(GETDATE() AS DATE) > p.EndDate THEN 'EXPIRED'
          ELSE 'RUNNING'
        END AS RuntimeStatus,
        ISNULL(sp.ServiceCount, 0) AS ServiceCount,
        ISNULL(svc.ServiceNames, N'') AS ServiceNames
      FROM Promotions p
      OUTER APPLY (
        SELECT COUNT(*) AS ServiceCount
        FROM ServicePromotions sp
        WHERE sp.PromotionId = p.PromotionId
      ) sp
      OUTER APPLY (
        SELECT STRING_AGG(s.ServiceName, N', ') AS ServiceNames
        FROM ServicePromotions sp2
        JOIN Services s ON sp2.ServiceId = s.ServiceId
        WHERE sp2.PromotionId = p.PromotionId
      ) svc
      WHERE p.PromotionId = @PromotionId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy khuyến mãi");
  return row;
}

async function getAssignedServices(id) {
  const pool = await connectDB();

  const result = await pool.request().input("PromotionId", sql.Int, Number(id))
    .query(`
      SELECT
        s.ServiceId,
        s.ServiceName,
        s.ImageUrl,
        s.Price,
        s.DurationMinutes,
        s.Status,
        c.CategoryName,
        CASE WHEN sp.ServiceId IS NULL THEN 0 ELSE 1 END AS IsAssigned
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      LEFT JOIN ServicePromotions sp
        ON sp.ServiceId = s.ServiceId
       AND sp.PromotionId = @PromotionId
      WHERE s.Status = 'AVAILABLE'
      ORDER BY IsAssigned DESC, s.ServiceName ASC
    `);

  return result.recordset.map((row) => ({
    ...row,
    IsAssigned: Number(row.IsAssigned) === 1,
  }));
}

async function saveMappings(transaction, promotionId, serviceIds = []) {
  await new sql.Request(transaction)
    .input("PromotionId", sql.Int, promotionId)
    .query(`DELETE FROM ServicePromotions WHERE PromotionId = @PromotionId`);

  const ids = Array.from(
    new Set((serviceIds || []).map(Number).filter(Boolean)),
  );

  for (const serviceId of ids) {
    await new sql.Request(transaction)
      .input("PromotionId", sql.Int, promotionId)
      .input("ServiceId", sql.Int, serviceId).query(`
        INSERT INTO ServicePromotions (ServiceId, PromotionId)
        VALUES (@ServiceId, @PromotionId)
      `);
  }
}

async function create(data) {
  const pool = await connectDB();

  const title = text(data.title || data.Title);
  const description = nullable(data.description || data.Description);
  const discountPercent = normalizePercent(
    data.discountPercent ?? data.DiscountPercent,
  );
  const imageUrl = nullable(data.imageUrl || data.ImageUrl);
  const startDate = normalizeDate(data.startDate || data.StartDate);
  const endDate = normalizeDate(data.endDate || data.EndDate);
  const status = normalizeStatus(data.status || data.Status, "ACTIVE");
  const serviceIds = data.serviceIds || data.ServiceIds || [];

  if (!title) throw new Error("Tên khuyến mãi không được để trống");
  if (discountPercent === null)
    throw new Error("Vui lòng nhập phần trăm giảm giá");
  validateDateRange(startDate, endDate);

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input("Title", sql.NVarChar, title)
      .input("Description", sql.NVarChar, description)
      .input("DiscountPercent", sql.Decimal(5, 2), discountPercent)
      .input("ImageUrl", sql.NVarChar, imageUrl)
      .input("StartDate", sql.Date, startDate)
      .input("EndDate", sql.Date, endDate)
      .input("Status", sql.NVarChar, status).query(`
        INSERT INTO Promotions
          (Title, Description, DiscountPercent, ImageUrl, StartDate, EndDate, Status)
        OUTPUT INSERTED.PromotionId
        VALUES
          (@Title, @Description, @DiscountPercent, @ImageUrl, @StartDate, @EndDate, @Status)
      `);

    const promotionId = result.recordset[0].PromotionId;
    await saveMappings(transaction, promotionId, serviceIds);

    await transaction.commit();
    return getById(promotionId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function update(id, data) {
  const current = await getById(id);
  const pool = await connectDB();

  const title =
    data.title !== undefined || data.Title !== undefined
      ? text(data.title || data.Title)
      : current.Title;

  const description =
    data.description !== undefined || data.Description !== undefined
      ? nullable(data.description || data.Description)
      : current.Description;

  const discountPercent =
    data.discountPercent !== undefined || data.DiscountPercent !== undefined
      ? normalizePercent(data.discountPercent ?? data.DiscountPercent)
      : Number(current.DiscountPercent);

  const imageUrl =
    data.imageUrl !== undefined || data.ImageUrl !== undefined
      ? nullable(data.imageUrl || data.ImageUrl)
      : current.ImageUrl;

  const startDate =
    data.startDate !== undefined || data.StartDate !== undefined
      ? normalizeDate(data.startDate || data.StartDate)
      : normalizeDate(current.StartDate);

  const endDate =
    data.endDate !== undefined || data.EndDate !== undefined
      ? normalizeDate(data.endDate || data.EndDate)
      : normalizeDate(current.EndDate);

  const status = normalizeStatus(
    data.status || data.Status || current.Status,
    current.Status,
  );
  const serviceIds = data.serviceIds || data.ServiceIds || [];

  if (!title) throw new Error("Tên khuyến mãi không được để trống");
  if (discountPercent === null)
    throw new Error("Vui lòng nhập phần trăm giảm giá");
  validateDateRange(startDate, endDate);

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("PromotionId", sql.Int, Number(id))
      .input("Title", sql.NVarChar, title)
      .input("Description", sql.NVarChar, description)
      .input("DiscountPercent", sql.Decimal(5, 2), discountPercent)
      .input("ImageUrl", sql.NVarChar, imageUrl)
      .input("StartDate", sql.Date, startDate)
      .input("EndDate", sql.Date, endDate)
      .input("Status", sql.NVarChar, status).query(`
        UPDATE Promotions
        SET Title = @Title,
            Description = @Description,
            DiscountPercent = @DiscountPercent,
            ImageUrl = @ImageUrl,
            StartDate = @StartDate,
            EndDate = @EndDate,
            Status = @Status
        WHERE PromotionId = @PromotionId
      `);

    await saveMappings(transaction, Number(id), serviceIds);

    await transaction.commit();
    return getById(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function changeStatus(id, data = {}) {
  const current = await getById(id);
  const nextStatus = normalizeStatus(
    data.status ||
      data.Status ||
      (current.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
  );

  if (!["ACTIVE", "INACTIVE"].includes(nextStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("PromotionId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Promotions
      SET Status = @Status
      WHERE PromotionId = @PromotionId
    `);

  return getById(id);
}

async function updateAssignedServices(id, serviceIds = []) {
  await getById(id);

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    await saveMappings(transaction, Number(id), serviceIds);
    await transaction.commit();

    return getAssignedServices(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function remove(id) {
  await getById(id);

  const pool = await connectDB();

  await pool.request().input("PromotionId", sql.Int, Number(id)).query(`
      UPDATE Promotions
      SET Status = 'INACTIVE',
          UpdatedAt = GETDATE()
      WHERE PromotionId = @PromotionId
    `);

  return getById(id);
}

module.exports = {
  getServices,
  list,
  getById,
  getAssignedServices,
  create,
  update,
  changeStatus,
  updateAssignedServices,
  remove,
};
