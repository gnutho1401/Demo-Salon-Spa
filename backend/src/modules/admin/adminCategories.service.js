const { sql, connectDB } = require("../../config/db");

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeStatus(value, fallback = "ACTIVE") {
  return String(value || fallback).trim().toUpperCase();
}

async function ensureUniqueName(pool, name, excludeId = null) {
  if (!name) return;
  const result = await pool.request()
    .input("CategoryName", sql.NVarChar, name)
    .input("ExcludeId", sql.Int, excludeId)
    .query(`
      SELECT TOP 1 CategoryId
      FROM ServiceCategories
      WHERE UPPER(TRIM(CategoryName)) = UPPER(TRIM(@CategoryName))
        AND (CAST(@ExcludeId AS INT) IS NULL OR CategoryId <> CAST(@ExcludeId AS INT))
    `);
  if (result.recordset[0]) {
    throw new Error("Tên category đã tồn tại");
  }
}

async function list(filters = {}) {
  const pool = await connectDB();
  const keyword = normalizeText(filters.keyword);
  const status = filters.status ? normalizeStatus(filters.status) : null;

  const result = await pool.request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Status", sql.NVarChar, status)
    .query(`
      SELECT
        c.CategoryId,
        c.CategoryName,
        c.Description,
        c.ImageUrl,
        c.Status,
        ISNULL(svc.ServiceCount, 0) AS ServiceCount,
        CASE WHEN ISNULL(svc.ServiceCount, 0) > 0 THEN 1 ELSE 0 END AS HasServices
      FROM ServiceCategories c
      OUTER APPLY (
        SELECT COUNT(*) AS ServiceCount
        FROM Services s
        WHERE s.CategoryId = c.CategoryId
      ) svc
      WHERE (@Keyword IS NULL OR c.CategoryName LIKE @Keyword OR c.Description LIKE @Keyword)
        AND (@Status IS NULL OR c.Status = @Status)
      ORDER BY c.CategoryId DESC
    `);

  return result.recordset.map((row) => ({
    ...row,
    IsActive: String(row.Status || "").toUpperCase() === "ACTIVE",
  }));
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input("CategoryId", sql.Int, id).query(`
    SELECT
      c.CategoryId,
      c.CategoryName,
      c.Description,
      c.ImageUrl,
      c.Status,
      ISNULL(svc.ServiceCount, 0) AS ServiceCount,
      CASE WHEN ISNULL(svc.ServiceCount, 0) > 0 THEN 1 ELSE 0 END AS HasServices
    FROM ServiceCategories c
    OUTER APPLY (
      SELECT COUNT(*) AS ServiceCount
      FROM Services s
      WHERE s.CategoryId = c.CategoryId
    ) svc
    WHERE c.CategoryId = @CategoryId
  `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy category");
  return { ...row, IsActive: String(row.Status || "").toUpperCase() === "ACTIVE" };
}

async function create(data) {
  const pool = await connectDB();
  const categoryName = normalizeText(data.CategoryName || data.categoryName);
  const description = normalizeNullableText(data.Description || data.description);
  const imageUrl = normalizeNullableText(data.ImageUrl || data.imageUrl);
  const status = normalizeStatus(data.Status || data.status || "ACTIVE");

  if (!categoryName) throw new Error("CategoryName không được để trống");
  
  await ensureUniqueName(pool, categoryName);

  const result = await pool.request()
    .input("CategoryName", sql.NVarChar, categoryName)
    .input("Description", sql.NVarChar, description)
    .input("ImageUrl", sql.NVarChar, imageUrl)
    .input("Status", sql.NVarChar, status)
    .query(`
      INSERT INTO ServiceCategories (CategoryName, Description, ImageUrl, Status)
      OUTPUT INSERTED.CategoryId
      VALUES (@CategoryName, @Description, @ImageUrl, @Status)
    `);

  return await getById(result.recordset[0].CategoryId);
}

async function update(id, data) {
  const pool = await connectDB();
  const current = await getById(id);
  const categoryName = data.CategoryName !== undefined ? normalizeText(data.CategoryName || data.categoryName) : current.CategoryName;
  const description = data.Description !== undefined ? normalizeNullableText(data.Description || data.description) : current.Description;
  const imageUrl = data.ImageUrl !== undefined ? normalizeNullableText(data.ImageUrl || data.imageUrl) : current.ImageUrl;
  const status = normalizeStatus(data.Status || data.status || current.Status);

  if (!categoryName) throw new Error("CategoryName không được để trống");
  
  await ensureUniqueName(pool, categoryName, id);

  await pool.request()
    .input("CategoryId", sql.Int, id)
    .input("CategoryName", sql.NVarChar, categoryName)
    .input("Description", sql.NVarChar, description)
    .input("ImageUrl", sql.NVarChar, imageUrl)
    .input("Status", sql.NVarChar, status)
    .query(`
      UPDATE ServiceCategories
      SET CategoryName = @CategoryName,
          Description = @Description,
          ImageUrl = @ImageUrl,
          Status = @Status
      WHERE CategoryId = @CategoryId
    `);

  return await getById(id);
}

async function remove(id) {
  const pool = await connectDB();
  const current = await getById(id);

  if (current.ServiceCount > 0) {
    throw new Error("Không thể xóa category đang được sử dụng bởi dịch vụ");
  }

  await pool.request().input("CategoryId", sql.Int, id).query(`
    DELETE FROM ServiceCategories
    WHERE CategoryId = @CategoryId
  `);

  return { CategoryId: Number(id) };
}

async function toggleActive(id) {
  const pool = await connectDB();
  const current = await getById(id);
  const next = current.IsActive ? "INACTIVE" : "ACTIVE";

  await pool.request()
    .input("CategoryId", sql.Int, id)
    .input("Status", sql.NVarChar, next)
    .query(`
      UPDATE ServiceCategories
      SET Status = @Status
      WHERE CategoryId = @CategoryId
    `);

  return await getById(id);
}

module.exports = { list, getById, create, update, remove, toggleActive };

