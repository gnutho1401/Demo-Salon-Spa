const { sql, connectDB } = require("../../config/db");

function text(v) {
  return String(v || "").trim();
}

function nullable(v) {
  const x = text(v);
  return x || null;
}

function toMoney(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBit(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function status(v, fallback = "ACTIVE") {
  return String(v || fallback)
    .trim()
    .toUpperCase();
}

function normalizeServices(data = {}) {
  if (Array.isArray(data.services)) {
    return data.services
      .map((x) => ({
        serviceId: toInt(x.serviceId || x.ServiceId),
        sessionCount: Math.max(1, toInt(x.sessionCount || x.SessionCount, 1)),
      }))
      .filter((x) => x.serviceId);
  }

  const ids = data.serviceIds || data.ServiceIds || [];

  return Array.from(new Set(ids.map(Number).filter(Boolean))).map((id) => ({
    serviceId: id,
    sessionCount: 1,
  }));
}

function readPayload(data = {}) {
  const packageCategoryId = toInt(
    data.PackageCategoryId ?? data.packageCategoryId,
    null,
  );
  const packageName = text(data.PackageName ?? data.packageName);
  const description = nullable(data.Description ?? data.description);
  const originalPrice = toMoney(data.OriginalPrice ?? data.originalPrice, null);
  const salePrice = toMoney(data.SalePrice ?? data.salePrice, null);
  const totalSessions = toInt(data.TotalSessions ?? data.totalSessions, 1);
  const validityDays = toInt(data.ValidityDays ?? data.validityDays, 30);
  const imageUrl = nullable(data.ImageUrl ?? data.imageUrl);
  const isHot = toBit(data.IsHot ?? data.isHot);
  const packageStatus = status(data.Status ?? data.status);
  const services = normalizeServices(data);

  if (!packageName) throw new Error("Tên package không được để trống");
  if (originalPrice === null || originalPrice < 0)
    throw new Error("OriginalPrice không hợp lệ");
  if (salePrice === null || salePrice < 0)
    throw new Error("SalePrice không hợp lệ");
  if (salePrice > originalPrice)
    throw new Error("SalePrice không được lớn hơn OriginalPrice");
  if (totalSessions <= 0) throw new Error("TotalSessions phải lớn hơn 0");
  if (validityDays <= 0) throw new Error("ValidityDays phải lớn hơn 0");

  if (!["ACTIVE", "INACTIVE", "HIDDEN"].includes(packageStatus)) {
    throw new Error("Trạng thái package không hợp lệ");
  }

  return {
    packageCategoryId,
    packageName,
    description,
    originalPrice,
    salePrice,
    totalSessions,
    validityDays,
    imageUrl,
    isHot,
    status: packageStatus,
    services,
  };
}

async function ensureUniqueName(pool, packageName, excludeId = null) {
  const result = await pool
    .request()
    .input("PackageName", sql.NVarChar, packageName)
    .input("ExcludeId", sql.Int, excludeId).query(`
      SELECT TOP 1 PackageId
      FROM Packages
      WHERE LOWER(PackageName) = LOWER(@PackageName)
        AND (CAST(@ExcludeId AS INT) IS NULL OR PackageId <> CAST(@ExcludeId AS INT))
    `);

  if (result.recordset[0]) throw new Error("Tên package đã tồn tại");
}

async function getCategories() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT PackageCategoryId, CategoryName, Description, Status
    FROM PackageCategories
    WHERE Status = 'ACTIVE'
    ORDER BY CategoryName ASC
  `);

  return result.recordset;
}

async function getServices() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      s.ServiceId,
      s.ServiceName,
      s.Price,
      s.DurationMinutes,
      s.ImageUrl,
      s.Status,
      c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    ORDER BY c.CategoryName, s.ServiceName
  `);

  return result.recordset;
}

async function savePackageServices(transaction, packageId, services = []) {
  await new sql.Request(transaction)
    .input("PackageId", sql.Int, packageId)
    .query(`DELETE FROM PackageServices WHERE PackageId = @PackageId`);

  for (const item of services) {
    await new sql.Request(transaction)
      .input("PackageId", sql.Int, packageId)
      .input("ServiceId", sql.Int, item.serviceId)
      .input("SessionCount", sql.Int, item.sessionCount || 1).query(`
        INSERT INTO PackageServices (PackageId, ServiceId, SessionCount)
        VALUES (@PackageId, @ServiceId, @SessionCount)
      `);
  }
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const packageStatus = filters.status ? status(filters.status) : null;
  const packageCategoryId = toInt(filters.packageCategoryId, null);
  const isHot =
    filters.isHot === undefined || filters.isHot === ""
      ? null
      : toBit(filters.isHot);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Status", sql.NVarChar, packageStatus)
    .input("PackageCategoryId", sql.Int, packageCategoryId)
    .input("IsHot", sql.Bit, isHot).query(`
      SELECT
        p.PackageId,
        p.PackageCategoryId,
        pc.CategoryName AS PackageCategoryName,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.TotalSessions,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        p.CreatedAt,
        p.UpdatedAt,
        ISNULL(ps.ServiceCount, 0) AS ServiceCount,
        ISNULL(ps.TotalServicePrice, 0) AS TotalServicePrice,
        ISNULL(ps.TotalDurationMinutes, 0) AS TotalDurationMinutes,
        ISNULL(ps.TotalPackageSessions, 0) AS TotalPackageSessions,
        ISNULL(ps.ServiceNames, N'') AS ServiceNames,
        ISNULL(cp.CustomerCount, 0) AS CustomerCount,
        ISNULL(cp.ActiveCustomerCount, 0) AS ActiveCustomerCount
      FROM Packages p
      LEFT JOIN PackageCategories pc ON p.PackageCategoryId = pc.PackageCategoryId
      OUTER APPLY (
        SELECT
          COUNT(*) AS ServiceCount,
          SUM(ISNULL(s.Price, 0) * ISNULL(x.SessionCount, 1)) AS TotalServicePrice,
          SUM(ISNULL(s.DurationMinutes, 0) * ISNULL(x.SessionCount, 1)) AS TotalDurationMinutes,
          SUM(ISNULL(x.SessionCount, 1)) AS TotalPackageSessions,
          STRING_AGG(CONCAT(s.ServiceName, N' x', x.SessionCount), N', ') AS ServiceNames
        FROM PackageServices x
        JOIN Services s ON x.ServiceId = s.ServiceId
        WHERE x.PackageId = p.PackageId
      ) ps
      OUTER APPLY (
        SELECT
          COUNT(*) AS CustomerCount,
          SUM(CASE WHEN Status = 'ACTIVE' THEN 1 ELSE 0 END) AS ActiveCustomerCount
        FROM CustomerPackages cp
        WHERE cp.PackageId = p.PackageId
      ) cp
      WHERE
        (@Keyword IS NULL OR p.PackageName LIKE @Keyword OR ISNULL(p.Description, N'') LIKE @Keyword)
        AND (@Status IS NULL OR p.Status = @Status)
        AND (@PackageCategoryId IS NULL OR p.PackageCategoryId = @PackageCategoryId)
        AND (@IsHot IS NULL OR p.IsHot = @IsHot)
      ORDER BY p.IsHot DESC, p.PackageId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("PackageId", sql.Int, Number(id))
    .query(`
      SELECT
        p.PackageId,
        p.PackageCategoryId,
        pc.CategoryName AS PackageCategoryName,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.TotalSessions,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        p.CreatedAt,
        p.UpdatedAt,
        ISNULL(ps.ServiceCount, 0) AS ServiceCount,
        ISNULL(ps.TotalServicePrice, 0) AS TotalServicePrice,
        ISNULL(ps.TotalDurationMinutes, 0) AS TotalDurationMinutes,
        ISNULL(ps.TotalPackageSessions, 0) AS TotalPackageSessions,
        ISNULL(ps.ServiceNames, N'') AS ServiceNames,
        ISNULL(cp.CustomerCount, 0) AS CustomerCount,
        ISNULL(cp.ActiveCustomerCount, 0) AS ActiveCustomerCount
      FROM Packages p
      LEFT JOIN PackageCategories pc ON p.PackageCategoryId = pc.PackageCategoryId
      OUTER APPLY (
        SELECT
          COUNT(*) AS ServiceCount,
          SUM(ISNULL(s.Price, 0) * ISNULL(x.SessionCount, 1)) AS TotalServicePrice,
          SUM(ISNULL(s.DurationMinutes, 0) * ISNULL(x.SessionCount, 1)) AS TotalDurationMinutes,
          SUM(ISNULL(x.SessionCount, 1)) AS TotalPackageSessions,
          STRING_AGG(CONCAT(s.ServiceName, N' x', x.SessionCount), N', ') AS ServiceNames
        FROM PackageServices x
        JOIN Services s ON x.ServiceId = s.ServiceId
        WHERE x.PackageId = p.PackageId
      ) ps
      OUTER APPLY (
        SELECT
          COUNT(*) AS CustomerCount,
          SUM(CASE WHEN Status = 'ACTIVE' THEN 1 ELSE 0 END) AS ActiveCustomerCount
        FROM CustomerPackages cp
        WHERE cp.PackageId = p.PackageId
      ) cp
      WHERE p.PackageId = @PackageId
    `);

  if (!result.recordset[0]) throw new Error("Không tìm thấy package");
  return result.recordset[0];
}

async function getAssignedServices(id) {
  const pool = await connectDB();

  const result = await pool.request().input("PackageId", sql.Int, Number(id))
    .query(`
      SELECT
        s.ServiceId,
        s.ServiceName,
        s.Price,
        s.DurationMinutes,
        s.ImageUrl,
        s.Status,
        c.CategoryName,
        ISNULL(ps.SessionCount, 1) AS SessionCount,
        CASE WHEN ps.ServiceId IS NULL THEN 0 ELSE 1 END AS IsAssigned
      FROM Services s
      LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
      LEFT JOIN PackageServices ps
        ON ps.ServiceId = s.ServiceId
       AND ps.PackageId = @PackageId
      WHERE s.Status = 'AVAILABLE'
      ORDER BY IsAssigned DESC, c.CategoryName, s.ServiceName
    `);

  return result.recordset.map((x) => ({
    ...x,
    IsAssigned: Number(x.IsAssigned) === 1,
  }));
}

async function create(data) {
  const payload = readPayload(data);
  const pool = await connectDB();

  await ensureUniqueName(pool, payload.packageName);

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const result = await new sql.Request(transaction)
      .input("PackageCategoryId", sql.Int, payload.packageCategoryId)
      .input("PackageName", sql.NVarChar, payload.packageName)
      .input("Description", sql.NVarChar, payload.description)
      .input("OriginalPrice", sql.Decimal(18, 2), payload.originalPrice)
      .input("SalePrice", sql.Decimal(18, 2), payload.salePrice)
      .input("TotalSessions", sql.Int, payload.totalSessions)
      .input("ValidityDays", sql.Int, payload.validityDays)
      .input("ImageUrl", sql.NVarChar, payload.imageUrl)
      .input("IsHot", sql.Bit, payload.isHot)
      .input("Status", sql.NVarChar, payload.status).query(`
        INSERT INTO Packages
          (PackageCategoryId, PackageName, Description, OriginalPrice, SalePrice, TotalSessions, ValidityDays, ImageUrl, IsHot, Status)
        OUTPUT INSERTED.PackageId
        VALUES
          (@PackageCategoryId, @PackageName, @Description, @OriginalPrice, @SalePrice, @TotalSessions, @ValidityDays, @ImageUrl, @IsHot, @Status)
      `);

    const packageId = result.recordset[0].PackageId;

    await savePackageServices(transaction, packageId, payload.services);

    await transaction.commit();
    return getById(packageId);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function update(id, data) {
  const current = await getById(id);

  const payload = readPayload({
    PackageCategoryId:
      data.PackageCategoryId ??
      data.packageCategoryId ??
      current.PackageCategoryId,
    PackageName: data.PackageName ?? data.packageName ?? current.PackageName,
    Description: data.Description ?? data.description ?? current.Description,
    OriginalPrice:
      data.OriginalPrice ?? data.originalPrice ?? current.OriginalPrice,
    SalePrice: data.SalePrice ?? data.salePrice ?? current.SalePrice,
    TotalSessions:
      data.TotalSessions ?? data.totalSessions ?? current.TotalSessions,
    ValidityDays:
      data.ValidityDays ?? data.validityDays ?? current.ValidityDays,
    ImageUrl: data.ImageUrl ?? data.imageUrl ?? current.ImageUrl,
    IsHot: data.IsHot ?? data.isHot ?? current.IsHot,
    Status: data.Status ?? data.status ?? current.Status,
    services: data.services,
    serviceIds: data.serviceIds,
  });

  const pool = await connectDB();

  await ensureUniqueName(pool, payload.packageName, Number(id));

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input("PackageId", sql.Int, Number(id))
      .input("PackageCategoryId", sql.Int, payload.packageCategoryId)
      .input("PackageName", sql.NVarChar, payload.packageName)
      .input("Description", sql.NVarChar, payload.description)
      .input("OriginalPrice", sql.Decimal(18, 2), payload.originalPrice)
      .input("SalePrice", sql.Decimal(18, 2), payload.salePrice)
      .input("TotalSessions", sql.Int, payload.totalSessions)
      .input("ValidityDays", sql.Int, payload.validityDays)
      .input("ImageUrl", sql.NVarChar, payload.imageUrl)
      .input("IsHot", sql.Bit, payload.isHot)
      .input("Status", sql.NVarChar, payload.status).query(`
        UPDATE Packages
        SET PackageCategoryId = @PackageCategoryId,
            PackageName = @PackageName,
            Description = @Description,
            OriginalPrice = @OriginalPrice,
            SalePrice = @SalePrice,
            TotalSessions = @TotalSessions,
            ValidityDays = @ValidityDays,
            ImageUrl = @ImageUrl,
            IsHot = @IsHot,
            Status = @Status,
            UpdatedAt = GETDATE()
        WHERE PackageId = @PackageId
      `);

    const shouldUpdateServices =
      Array.isArray(data.services) ||
      Array.isArray(data.Services) ||
      Array.isArray(data.serviceIds) ||
      Array.isArray(data.ServiceIds);

    if (shouldUpdateServices) {
      await savePackageServices(transaction, Number(id), payload.services);
    }

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
  const nextStatus = status(
    data.status ||
      data.Status ||
      (current.Status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
  );

  if (!["ACTIVE", "INACTIVE", "HIDDEN"].includes(nextStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  const pool = await connectDB();

  await pool
    .request()
    .input("PackageId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Packages
      SET Status = @Status,
          UpdatedAt = GETDATE()
      WHERE PackageId = @PackageId
    `);

  return getById(id);
}

async function remove(id) {
  await getById(id);

  const pool = await connectDB();

  await pool.request().input("PackageId", sql.Int, Number(id)).query(`
      UPDATE Packages
      SET Status = 'INACTIVE',
          UpdatedAt = GETDATE()
      WHERE PackageId = @PackageId
    `);

  return getById(id);
}

async function updatePackageServices(id, data = {}) {
  await getById(id);

  const services = normalizeServices(data);

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await savePackageServices(transaction, Number(id), services);

    await transaction.commit();

    return getAssignedServices(id);
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

module.exports = {
  getCategories,
  getServices,
  list,
  getById,
  getAssignedServices,
  create,
  update,
  changeStatus,
  remove,
  updatePackageServices,
};
