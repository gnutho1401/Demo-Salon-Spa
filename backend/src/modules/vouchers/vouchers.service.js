const { sql, connectDB } = require("../../config/db");

async function getCustomer(pool, userId) {
  const res = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .query("SELECT CustomerId FROM Customers WHERE UserId = @UserId");
  return res.recordset[0];
}

async function getAllActive() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT VoucherId, Code, DiscountType, DiscountValue, StartDate, EndDate, Quantity, Status
    FROM Vouchers
    WHERE Status = 'ACTIVE'
      AND (StartDate IS NULL OR StartDate <= CAST(GETDATE() AS DATE))
      AND (EndDate IS NULL OR EndDate >= CAST(GETDATE() AS DATE))
    ORDER BY VoucherId DESC
  `);
  return res.recordset;
}

async function getMine(userId) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  if (!customer) return [];
  const res = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
    SELECT cv.CustomerId, cv.VoucherId, cv.UsedStatus, v.Code, v.DiscountType, v.DiscountValue, v.StartDate, v.EndDate, v.Status
    FROM CustomerVouchers cv
    JOIN Vouchers v ON cv.VoucherId = v.VoucherId
    WHERE cv.CustomerId = @CustomerId
    ORDER BY cv.UsedStatus ASC, v.EndDate ASC
  `);
  return res.recordset;
}

async function saveVoucher(userId, voucherId) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const valid = await pool.request().input("VoucherId", sql.Int, voucherId)
    .query(`
    SELECT TOP 1 * FROM Vouchers
    WHERE VoucherId = @VoucherId AND Status = 'ACTIVE' AND Quantity > 0
      AND (StartDate IS NULL OR StartDate <= CAST(GETDATE() AS DATE))
      AND (EndDate IS NULL OR EndDate >= CAST(GETDATE() AS DATE))
  `);
  if (!valid.recordset[0])
    throw new Error("Voucher không tồn tại hoặc đã hết hạn");

  const existed = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("VoucherId", sql.Int, voucherId)
    .query(
      "SELECT 1 AS Found FROM CustomerVouchers WHERE CustomerId = @CustomerId AND VoucherId = @VoucherId",
    );
  if (existed.recordset[0]) throw new Error("Bạn đã lưu voucher này rồi");

  const tran = new sql.Transaction(pool);
  try {
    await tran.begin();
    const result = await new sql.Request(tran)
      .input("CustomerId", sql.Int, customer.CustomerId)
      .input("VoucherId", sql.Int, voucherId).query(`
        INSERT INTO CustomerVouchers (CustomerId, VoucherId, UsedStatus)
        OUTPUT INSERTED.*
        VALUES (@CustomerId, @VoucherId, 0)
      `);
    await new sql.Request(tran)
      .input("VoucherId", sql.Int, voucherId)
      .query(
        "UPDATE Vouchers SET Quantity = Quantity - 1 WHERE VoucherId = @VoucherId AND Quantity > 0",
      );
    await tran.commit();
    return result.recordset[0];
  } catch (err) {
    try {
      await tran.rollback();
    } catch (_) {}
    throw err;
  }
}

async function validateVoucher(userId, data) {
  const code = String(data.code || "")
    .trim()
    .toUpperCase();
  const totalAmount = Number(data.totalAmount || 0);

  if (!code) throw new Error("Vui lòng nhập mã voucher");
  if (totalAmount <= 0) throw new Error("Tổng tiền không hợp lệ");

  const pool = await connectDB();

  const result = await pool.request().input("Code", sql.NVarChar, code).query(`
      SELECT TOP 1
        VoucherId,
        Code,
        DiscountType,
        DiscountValue,
        StartDate,
        EndDate,
        Status
      FROM Vouchers
      WHERE UPPER(Code) = @Code
        AND Status = 'ACTIVE'
        AND (StartDate IS NULL OR StartDate <= CAST(GETDATE() AS DATE))
        AND (EndDate IS NULL OR EndDate >= CAST(GETDATE() AS DATE))
    `);

  const voucher = result.recordset[0];

  if (!voucher) {
    throw new Error("Voucher không hợp lệ hoặc đã hết hạn");
  }

  const customer = await getCustomer(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const useCheck = await pool.request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("VoucherId", sql.Int, voucher.VoucherId)
    .query(`
      SELECT UsedStatus 
      FROM CustomerVouchers 
      WHERE CustomerId = @CustomerId AND VoucherId = @VoucherId
    `);

  if (!useCheck.recordset[0]) {
    throw new Error("Vui lòng lưu voucher này trước khi sử dụng");
  }

  if (useCheck.recordset[0].UsedStatus) {
    throw new Error("Bạn đã sử dụng voucher này rồi");
  }

  let discountAmount = 0;

  if (String(voucher.DiscountType).toUpperCase() === "PERCENT") {
    discountAmount = (totalAmount * Number(voucher.DiscountValue || 0)) / 100;
  } else {
    discountAmount = Number(voucher.DiscountValue || 0);
  }

  discountAmount = Math.min(discountAmount, totalAmount);

  return {
    ...voucher,
    discountAmount,
    finalAmount: Math.max(totalAmount - discountAmount, 0),
  };
}

module.exports = { getAllActive, getMine, saveVoucher, validateVoucher };
