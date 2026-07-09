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
    SELECT VoucherId, Code, DiscountType, DiscountValue, MinOrderAmount, MaxDiscountAmount, StartDate, EndDate, Quantity, Status
    FROM Vouchers
    WHERE Status = 'ACTIVE'
      AND (StartDate IS NULL OR StartDate <= CAST(GETDATE() AS DATE))
      AND (EndDate IS NULL OR EndDate >= CAST(GETDATE() AS DATE))
    ORDER BY VoucherId DESC
  `);
  return res.recordset;
}

async function getMine(userId, customerId = null) {
  const pool = await connectDB();
  let customer;
  if (customerId) {
    customer = { CustomerId: customerId };
  } else {
    customer = await getCustomer(pool, userId);
  }
  if (!customer) return [];

  const vouchersRes = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
    SELECT 
      cv.CustomerId, 
      cv.VoucherId, 
      cv.UsedStatus, 
      v.Code, 
      v.DiscountType, 
      v.DiscountValue, 
      v.MinOrderAmount, 
      v.MaxDiscountAmount, 
      v.StartDate, 
      v.EndDate, 
      v.Status,
      v.Quantity,
      (
        SELECT COUNT(*)
        FROM Invoices i
        JOIN Appointments a ON i.AppointmentId = a.AppointmentId
        WHERE a.CustomerId = cv.CustomerId
          AND i.VoucherId = cv.VoucherId
          AND a.Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
      ) AS UseCount
    FROM CustomerVouchers cv
    JOIN Vouchers v ON cv.VoucherId = v.VoucherId
    WHERE cv.CustomerId = @CustomerId
    ORDER BY cv.UsedStatus ASC, v.EndDate ASC
  `);

  const vouchers = vouchersRes.recordset;

  const apptsRes = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
    SELECT 
      i.VoucherId,
      a.AppointmentId,
      a.Status AS AppointmentStatus,
      COALESCE(
        (SELECT TOP 1 Status FROM Payments WHERE InvoiceId = i.InvoiceId ORDER BY PaymentId DESC), 
        'UNPAID'
      ) AS PaymentStatus,
      (
        SELECT STRING_AGG(s.ServiceName, ', ')
        FROM AppointmentServices abs
        JOIN Services s ON abs.ServiceId = s.ServiceId
        WHERE abs.AppointmentId = a.AppointmentId
      ) AS ServiceNames
    FROM Appointments a
    JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    WHERE a.CustomerId = @CustomerId
      AND i.VoucherId IS NOT NULL
      AND a.Status <> 'CANCELLED'
  `);

  const appts = apptsRes.recordset;

  return vouchers.map(v => {
    const usages = appts.filter(a => a.VoucherId === v.VoucherId);
    return {
      ...v,
      Usages: usages
    };
  });
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
    await tran.commit();
    return result.recordset[0];
  } catch (err) {
    try {
      await tran.rollback();
    } catch (_) {}
    throw err;
  }
}

async function validateVoucher(userId, data, customerId = null) {
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
        MinOrderAmount,
        MaxDiscountAmount,
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

  const minOrder = Number(voucher.MinOrderAmount || 0);
  if (minOrder > 0 && totalAmount < minOrder) {
    throw new Error(`Đơn hàng tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để sử dụng voucher này`);
  }

  let customer;
  if (customerId) {
    customer = { CustomerId: customerId };
  } else {
    customer = await getCustomer(pool, userId);
  }
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  // Validate free service vouchers limit to specific services
  const codeUpper = String(voucher.Code || "").toUpperCase();
  const isFreeGift = codeUpper.startsWith("FREEGD") || codeUpper.startsWith("FREEMS");

  if (isFreeGift) {
    if (!data.serviceId) {
      throw new Error("Vui lòng chọn dịch vụ phù hợp để áp dụng voucher này");
    }
    const serviceRes = await pool.request()
      .input("ServiceId", sql.Int, data.serviceId)
      .query("SELECT ServiceName FROM Services WHERE ServiceId = @ServiceId");
    if (serviceRes.recordset.length === 0) {
      throw new Error("Dịch vụ không tồn tại");
    }
    const serviceName = String(serviceRes.recordset[0].ServiceName || "");
    if (codeUpper.startsWith("FREEGD") && !serviceName.includes("Gội đầu")) {
      throw new Error("Voucher này chỉ áp dụng cho dịch vụ Gội đầu thảo dược dưỡng sinh");
    }
    if (codeUpper.startsWith("FREEMS") && !serviceName.includes("Massage")) {
      throw new Error("Voucher này chỉ áp dụng cho dịch vụ Massage cổ vai gáy");
    }
  }

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

  const countRes = await pool.request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("VoucherId", sql.Int, voucher.VoucherId)
    .query(`
      SELECT COUNT(*) AS UseCount
      FROM Invoices i
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
        AND i.VoucherId = @VoucherId
        AND a.Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
    `);

  const useCount = countRes.recordset[0].UseCount;
  if (useCount >= 3) {
    throw new Error("Bạn đã sử dụng voucher này tối đa 3 lần");
  }

  let discountAmount = 0;

  if (String(voucher.DiscountType).toUpperCase() === "PERCENT") {
    discountAmount = (totalAmount * Number(voucher.DiscountValue || 0)) / 100;
    const maxDiscount = Number(voucher.MaxDiscountAmount || 0);
    if (maxDiscount > 0) {
      discountAmount = Math.min(discountAmount, maxDiscount);
    }
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
