const { sql, connectDB } = require("../../config/db");

function text(value) {
  return String(value || "").trim();
}

function toMoney(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function status(value, fallback = "ACTIVE") {
  return String(value || fallback)
    .trim()
    .toUpperCase();
}

function discountType(value) {
  return String(value || "PERCENT")
    .trim()
    .toUpperCase();
}

function validateDateRange(startDate, endDate) {
  if (!startDate) throw new Error("Vui lòng chọn ngày bắt đầu");
  if (!endDate) throw new Error("Vui lòng chọn ngày kết thúc");
  if (new Date(startDate) > new Date(endDate)) {
    throw new Error("Ngày bắt đầu không được lớn hơn ngày kết thúc");
  }
}

function validatePayload(data) {
  const code = text(data.Code || data.code).toUpperCase();
  const type = discountType(data.DiscountType || data.discountType);
  const discountValue = toMoney(data.DiscountValue ?? data.discountValue, null);
  const minOrderAmount = toMoney(data.MinOrderAmount ?? data.minOrderAmount, 0);
  const maxDiscountAmount =
    data.MaxDiscountAmount === "" || data.maxDiscountAmount === ""
      ? null
      : (data.MaxDiscountAmount ?? data.maxDiscountAmount ?? null);
  const startDate = dateOnly(data.StartDate || data.startDate);
  const endDate = dateOnly(data.EndDate || data.endDate);
  const quantity = toInt(data.Quantity ?? data.quantity, 0);
  const voucherStatus = status(data.Status || data.status, "ACTIVE");

  if (!code) throw new Error("Mã voucher không được để trống");
  if (!["PERCENT", "AMOUNT"].includes(type)) {
    throw new Error("Loại giảm giá không hợp lệ");
  }
  if (discountValue === null || discountValue <= 0) {
    throw new Error("Giá trị giảm giá phải lớn hơn 0");
  }
  if (type === "PERCENT" && discountValue > 100) {
    throw new Error("Voucher PERCENT phải từ 1 đến 100");
  }
  if (minOrderAmount < 0) throw new Error("Đơn tối thiểu không hợp lệ");
  if (maxDiscountAmount !== null && Number(maxDiscountAmount) < 0) {
    throw new Error("Giảm tối đa không hợp lệ");
  }
  if (quantity < 0) throw new Error("Số lượng voucher không hợp lệ");
  if (!["ACTIVE", "INACTIVE"].includes(voucherStatus)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  validateDateRange(startDate, endDate);

  return {
    code,
    discountType: type,
    discountValue,
    minOrderAmount,
    maxDiscountAmount:
      maxDiscountAmount === null || maxDiscountAmount === undefined
        ? null
        : Number(maxDiscountAmount),
    startDate,
    endDate,
    quantity,
    status: voucherStatus,
  };
}

async function ensureUniqueCode(pool, code, excludeId = null) {
  const result = await pool
    .request()
    .input("Code", sql.NVarChar, code)
    .input("ExcludeId", sql.Int, excludeId).query(`
      SELECT TOP 1 VoucherId
      FROM Vouchers
      WHERE UPPER(Code) = UPPER(@Code)
        AND (@ExcludeId IS NULL OR VoucherId <> @ExcludeId)
    `);

  if (result.recordset[0]) throw new Error("Mã voucher đã tồn tại");
}

async function list(filters = {}) {
  const pool = await connectDB();

  const keyword = text(filters.keyword);
  const voucherStatus = filters.status ? status(filters.status) : null;
  const type = filters.discountType ? discountType(filters.discountType) : null;
  const fromDate = dateOnly(filters.fromDate);
  const toDate = dateOnly(filters.toDate);

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword ? `%${keyword}%` : null)
    .input("Status", sql.NVarChar, voucherStatus)
    .input("DiscountType", sql.NVarChar, type)
    .input("FromDate", sql.Date, fromDate)
    .input("ToDate", sql.Date, toDate).query(`
      SELECT
        v.VoucherId,
        v.Code,
        v.DiscountType,
        v.DiscountValue,
        v.MinOrderAmount,
        v.MaxDiscountAmount,
        v.StartDate,
        v.EndDate,
        v.Quantity,
        v.Status,
        CASE
          WHEN v.Status <> 'ACTIVE' THEN 'INACTIVE'
          WHEN CAST(GETDATE() AS DATE) < v.StartDate THEN 'UPCOMING'
          WHEN CAST(GETDATE() AS DATE) > v.EndDate THEN 'EXPIRED'
          WHEN ISNULL(cv.UsedCount, 0) >= v.Quantity AND v.Quantity > 0 THEN 'SOLD_OUT'
          ELSE 'RUNNING'
        END AS RuntimeStatus,
        ISNULL(cv.CustomerCount, 0) AS CustomerCount,
        ISNULL(cv.UsedCount, 0) AS UsedCount,
        CASE 
          WHEN v.Quantity <= 0 THEN 0
          ELSE v.Quantity - ISNULL(cv.UsedCount, 0)
        END AS RemainingQuantity
      FROM Vouchers v
      OUTER APPLY (
        SELECT
          COUNT(*) AS CustomerCount,
          SUM(CASE WHEN UsedStatus = 1 THEN 1 ELSE 0 END) AS UsedCount
        FROM CustomerVouchers x
        WHERE x.VoucherId = v.VoucherId
      ) cv
      WHERE
        (@Keyword IS NULL OR v.Code LIKE @Keyword)
        AND (@Status IS NULL OR v.Status = @Status)
        AND (@DiscountType IS NULL OR v.DiscountType = @DiscountType)
        AND (@FromDate IS NULL OR v.StartDate >= @FromDate)
        AND (@ToDate IS NULL OR v.EndDate <= @ToDate)
      ORDER BY v.VoucherId DESC
    `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("VoucherId", sql.Int, Number(id))
    .query(`
      SELECT
        v.VoucherId,
        v.Code,
        v.DiscountType,
        v.DiscountValue,
        v.MinOrderAmount,
        v.MaxDiscountAmount,
        v.StartDate,
        v.EndDate,
        v.Quantity,
        v.Status,
        CASE
          WHEN v.Status <> 'ACTIVE' THEN 'INACTIVE'
          WHEN CAST(GETDATE() AS DATE) < v.StartDate THEN 'UPCOMING'
          WHEN CAST(GETDATE() AS DATE) > v.EndDate THEN 'EXPIRED'
          WHEN ISNULL(cv.UsedCount, 0) >= v.Quantity AND v.Quantity > 0 THEN 'SOLD_OUT'
          ELSE 'RUNNING'
        END AS RuntimeStatus,
        ISNULL(cv.CustomerCount, 0) AS CustomerCount,
        ISNULL(cv.UsedCount, 0) AS UsedCount,
        CASE 
          WHEN v.Quantity <= 0 THEN 0
          ELSE v.Quantity - ISNULL(cv.UsedCount, 0)
        END AS RemainingQuantity
      FROM Vouchers v
      OUTER APPLY (
        SELECT
          COUNT(*) AS CustomerCount,
          SUM(CASE WHEN UsedStatus = 1 THEN 1 ELSE 0 END) AS UsedCount
        FROM CustomerVouchers x
        WHERE x.VoucherId = v.VoucherId
      ) cv
      WHERE v.VoucherId = @VoucherId
    `);

  const row = result.recordset[0];
  if (!row) throw new Error("Không tìm thấy voucher");
  return row;
}

async function create(data) {
  const payload = validatePayload(data);
  const pool = await connectDB();

  await ensureUniqueCode(pool, payload.code);

  const result = await pool
    .request()
    .input("Code", sql.NVarChar, payload.code)
    .input("DiscountType", sql.NVarChar, payload.discountType)
    .input("DiscountValue", sql.Decimal(18, 2), payload.discountValue)
    .input("MinOrderAmount", sql.Decimal(18, 2), payload.minOrderAmount)
    .input("MaxDiscountAmount", sql.Decimal(18, 2), payload.maxDiscountAmount)
    .input("StartDate", sql.Date, payload.startDate)
    .input("EndDate", sql.Date, payload.endDate)
    .input("Quantity", sql.Int, payload.quantity)
    .input("Status", sql.NVarChar, payload.status).query(`
      INSERT INTO Vouchers
        (Code, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount, StartDate, EndDate, Quantity, Status)
      OUTPUT INSERTED.VoucherId
      VALUES
        (@Code, @DiscountType, @DiscountValue, @MinOrderAmount, @MaxDiscountAmount, @StartDate, @EndDate, @Quantity, @Status)
    `);

  return getById(result.recordset[0].VoucherId);
}

async function update(id, data) {
  const current = await getById(id);

  const merged = {
    Code: data.Code ?? data.code ?? current.Code,
    DiscountType:
      data.DiscountType ?? data.discountType ?? current.DiscountType,
    DiscountValue:
      data.DiscountValue ?? data.discountValue ?? current.DiscountValue,
    MinOrderAmount:
      data.MinOrderAmount ?? data.minOrderAmount ?? current.MinOrderAmount,
    MaxDiscountAmount:
      data.MaxDiscountAmount !== undefined ||
      data.maxDiscountAmount !== undefined
        ? (data.MaxDiscountAmount ?? data.maxDiscountAmount)
        : current.MaxDiscountAmount,
    StartDate: data.StartDate ?? data.startDate ?? current.StartDate,
    EndDate: data.EndDate ?? data.endDate ?? current.EndDate,
    Quantity: data.Quantity ?? data.quantity ?? current.Quantity,
    Status: data.Status ?? data.status ?? current.Status,
  };

  const payload = validatePayload(merged);
  const pool = await connectDB();

  await ensureUniqueCode(pool, payload.code, Number(id));

  await pool
    .request()
    .input("VoucherId", sql.Int, Number(id))
    .input("Code", sql.NVarChar, payload.code)
    .input("DiscountType", sql.NVarChar, payload.discountType)
    .input("DiscountValue", sql.Decimal(18, 2), payload.discountValue)
    .input("MinOrderAmount", sql.Decimal(18, 2), payload.minOrderAmount)
    .input("MaxDiscountAmount", sql.Decimal(18, 2), payload.maxDiscountAmount)
    .input("StartDate", sql.Date, payload.startDate)
    .input("EndDate", sql.Date, payload.endDate)
    .input("Quantity", sql.Int, payload.quantity)
    .input("Status", sql.NVarChar, payload.status).query(`
      UPDATE Vouchers
      SET Code = @Code,
          DiscountType = @DiscountType,
          DiscountValue = @DiscountValue,
          MinOrderAmount = @MinOrderAmount,
          MaxDiscountAmount = @MaxDiscountAmount,
          StartDate = @StartDate,
          EndDate = @EndDate,
          Quantity = @Quantity,
          Status = @Status
      WHERE VoucherId = @VoucherId
    `);

  return getById(id);
}

async function changeStatus(id, data = {}) {
  const current = await getById(id);
  const nextStatus = status(
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
    .input("VoucherId", sql.Int, Number(id))
    .input("Status", sql.NVarChar, nextStatus).query(`
      UPDATE Vouchers
      SET Status = @Status
      WHERE VoucherId = @VoucherId
    `);

  return getById(id);
}

async function disable(id) {
  return changeStatus(id, { status: "INACTIVE" });
}

async function remove(id) {
  await getById(id);

  const pool = await connectDB();

  await pool.request().input("VoucherId", sql.Int, Number(id)).query(`
      UPDATE Vouchers
      SET Status = 'INACTIVE',
          UpdatedAt = GETDATE()
      WHERE VoucherId = @VoucherId
    `);

  return getById(id);
}

module.exports = {
  list,
  getById,
  create,
  update,
  changeStatus,
  disable,
  remove,
};
