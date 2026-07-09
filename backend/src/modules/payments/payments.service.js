const crypto = require("crypto");
const qs = require("qs");
const { sql, connectDB } = require("../../config/db");

const {
  getCustomerDiscountPercent,
  calcMembershipDiscount,
  calcRewardPointUsage,
  addLoyaltyPoints,
  useLoyaltyPoints,
  updateCustomerMembershipLevel,
} = require("../../utils/membershipDiscount");

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();

  keys.forEach((key) => {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  });

  return sorted;
}

function formatVnpDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");

  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function toNumber(value) {
  return Number(value || 0);
}

async function getPayableAppointment(
  userId,
  appointmentId,
  voucherId = null,
  rewardPoints = 0,
  isStaff = false,
) {
  const pool = await connectDB();

  const info = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AppointmentId", sql.Int, appointmentId)
    .input("IsStaff", sql.Bit, isStaff ? 1 : 0).query(`
      SELECT
        a.AppointmentId,
        a.CustomerId,
        a.Status,
        ISNULL(c.LoyaltyPoints, 0) AS LoyaltyPoints,
        SUM(ISNULL(aps.Price, s.Price)) AS TotalAmount
      FROM Appointments a
      INNER JOIN Customers c ON c.CustomerId = a.CustomerId
      INNER JOIN AppointmentServices aps ON aps.AppointmentId = a.AppointmentId
      LEFT JOIN Services s ON s.ServiceId = aps.ServiceId
      WHERE a.AppointmentId = @AppointmentId
        AND (@IsStaff = 1 OR c.UserId = @UserId)
      GROUP BY
        a.AppointmentId,
        a.CustomerId,
        a.Status,
        c.LoyaltyPoints
    `);

  const item = info.recordset[0];

  if (!item) {
    throw new Error("Không tìm thấy lịch hẹn cần thanh toán");
  }

  const status = String(item.Status || "").toUpperCase();

  if (
    ["CANCELLED", "COMPLETED", "REFUND_PENDING", "REFUNDED"].includes(status)
  ) {
    throw new Error("Lịch hẹn này không còn được thanh toán");
  }

  const paid = await pool
    .request()
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT TOP 1 p.PaymentId
      FROM Payments p
      INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
      WHERE i.AppointmentId = @AppointmentId
        AND p.Status = 'PAID'
    `);

  if (paid.recordset[0]) {
    throw new Error("Lịch hẹn này đã được thanh toán");
  }

  const totalAmount = toNumber(item.TotalAmount);

  const membershipPercent = await getCustomerDiscountPercent(item.CustomerId);
  const membershipCalc = calcMembershipDiscount(totalAmount, membershipPercent);

  let beforeRewardAmount = membershipCalc.afterMembership;
  let voucherDiscountAmount = 0;
  let usedVoucherId = null;

  if (voucherId) {
    const voucherResult = await pool
      .request()
      .input("VoucherId", sql.Int, voucherId)
      .input("CustomerId", sql.Int, item.CustomerId)
      .input("TotalAmount", sql.Decimal(18, 2), beforeRewardAmount).query(`
        SELECT TOP 1
          v.VoucherId,
          v.Code,
          v.DiscountType,
          v.DiscountValue,
          v.MinOrderAmount,
          v.MaxDiscountAmount
        FROM Vouchers v
        INNER JOIN CustomerVouchers cv ON cv.VoucherId = v.VoucherId
        WHERE v.VoucherId = @VoucherId
          AND cv.CustomerId = @CustomerId
          AND v.Status = 'ACTIVE'
          AND cv.UsedStatus = 0
          AND ISNULL(v.MinOrderAmount, 0) <= @TotalAmount
          AND (v.StartDate IS NULL OR v.StartDate <= CAST(GETDATE() AS DATE))
          AND (v.EndDate IS NULL OR v.EndDate >= CAST(GETDATE() AS DATE))
      `);

    const voucher = voucherResult.recordset[0];

    if (!voucher) {
      throw new Error("Voucher không hợp lệ, đã dùng hoặc không đủ điều kiện");
    }

    const servicesResult = await pool.request()
      .input("AppointmentId", sql.Int, appointmentId)
      .query(`
        SELECT s.ServiceName, ISNULL(aps.Price, s.Price) AS Price
        FROM AppointmentServices aps
        LEFT JOIN Services s ON s.ServiceId = aps.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
      `);
    const appServices = servicesResult.recordset;

    const codeUpper = String(voucher.Code || "").toUpperCase();
    if (codeUpper.startsWith("FREEPH")) {
      const phucHoiService = appServices.find(s => String(s.ServiceName || "") === "Phục hồi tóc hư tổn");
      if (!phucHoiService) {
        throw new Error("Voucher này chỉ áp dụng cho dịch vụ Phục hồi tóc hư tổn");
      }
      voucherDiscountAmount = Math.min(toNumber(voucher.DiscountValue), toNumber(phucHoiService.Price));
    } else if (codeUpper.startsWith("FREEMS")) {
      const massageService = appServices.find(s => String(s.ServiceName || "") === "Massage cổ vai gáy");
      if (!massageService) {
        throw new Error("Voucher này chỉ áp dụng cho dịch vụ Massage cổ vai gáy");
      }
      voucherDiscountAmount = Math.min(toNumber(voucher.DiscountValue), toNumber(massageService.Price));
    } else {
      if (String(voucher.DiscountType || "").toUpperCase() === "PERCENT") {
        voucherDiscountAmount =
          (beforeRewardAmount * toNumber(voucher.DiscountValue)) / 100;

        if (
          voucher.MaxDiscountAmount !== null &&
          voucher.MaxDiscountAmount !== undefined
        ) {
          voucherDiscountAmount = Math.min(
            voucherDiscountAmount,
            toNumber(voucher.MaxDiscountAmount),
          );
        }
      } else {
        voucherDiscountAmount = toNumber(voucher.DiscountValue);
      }
    }

    voucherDiscountAmount = Math.min(
      Math.round(voucherDiscountAmount),
      beforeRewardAmount,
    );

    beforeRewardAmount = Math.max(
      beforeRewardAmount - voucherDiscountAmount,
      0,
    );
    usedVoucherId = voucher.VoucherId;
  }

  const rewardCalc = calcRewardPointUsage(
    beforeRewardAmount,
    item.LoyaltyPoints,
    rewardPoints,
  );

  const finalAmount = Math.max(
    beforeRewardAmount - rewardCalc.rewardDiscountAmount,
    0,
  );

  const discountAmount =
    membershipCalc.membershipDiscountAmount +
    voucherDiscountAmount +
    rewardCalc.rewardDiscountAmount;

  return {
    ...item,
    TotalAmount: totalAmount,
    membershipPercent,
    membershipDiscountAmount: membershipCalc.membershipDiscountAmount,
    voucherDiscountAmount,
    rewardPointsUsed: rewardCalc.rewardPointsUsed,
    rewardDiscountAmount: rewardCalc.rewardDiscountAmount,
    maxUsablePoints: rewardCalc.maxUsablePoints,
    discountAmount,
    finalAmount,
    voucherId: usedVoucherId,
  };
}

async function createOrUpdateInvoice(
  transaction,
  appointmentId,
  totalAmount,
  discountAmount,
  finalAmount,
  voucherId = null,
  rewardPointsUsed = 0,
  rewardDiscountAmount = 0,
) {
  const existed = await new sql.Request(transaction).input(
    "AppointmentId",
    sql.Int,
    appointmentId,
  ).query(`
      SELECT TOP 1 InvoiceId
      FROM Invoices
      WHERE AppointmentId = @AppointmentId
      ORDER BY InvoiceId DESC
    `);

  const row = existed.recordset[0];

  if (row) {
    const updated = await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, row.InvoiceId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
      .input("DiscountAmount", sql.Decimal(18, 2), discountAmount)
      .input("FinalAmount", sql.Decimal(18, 2), finalAmount)
      .input("VoucherId", sql.Int, voucherId)
      .input("RewardPointsUsed", sql.Int, rewardPointsUsed || 0)
      .input(
        "RewardDiscountAmount",
        sql.Decimal(18, 2),
        rewardDiscountAmount || 0,
      ).query(`
        UPDATE Invoices
        SET
          TotalAmount = @TotalAmount,
          DiscountAmount = @DiscountAmount,
          FinalAmount = @FinalAmount,
          VoucherId = @VoucherId,
          RewardPointsUsed = @RewardPointsUsed,
          RewardDiscountAmount = @RewardDiscountAmount,
          Status = 'UNPAID'
        OUTPUT INSERTED.InvoiceId
        WHERE InvoiceId = @InvoiceId
      `);

    return updated.recordset[0].InvoiceId;
  }

  const inserted = await new sql.Request(transaction)
    .input("AppointmentId", sql.Int, appointmentId)
    .input("TotalAmount", sql.Decimal(18, 2), totalAmount)
    .input("DiscountAmount", sql.Decimal(18, 2), discountAmount)
    .input("FinalAmount", sql.Decimal(18, 2), finalAmount)
    .input("VoucherId", sql.Int, voucherId)
    .input("RewardPointsUsed", sql.Int, rewardPointsUsed || 0)
    .input(
      "RewardDiscountAmount",
      sql.Decimal(18, 2),
      rewardDiscountAmount || 0,
    ).query(`
      INSERT INTO Invoices
        (
          AppointmentId,
          TotalAmount,
          DiscountAmount,
          FinalAmount,
          VoucherId,
          RewardPointsUsed,
          RewardDiscountAmount,
          Status,
          CreatedAt
        )
      OUTPUT INSERTED.InvoiceId
      VALUES
        (
          @AppointmentId,
          @TotalAmount,
          @DiscountAmount,
          @FinalAmount,
          @VoucherId,
          @RewardPointsUsed,
          @RewardDiscountAmount,
          'UNPAID',
          GETDATE()
        )
    `);

  return inserted.recordset[0].InvoiceId;
}

async function createPaymentRow(
  transaction,
  invoiceId,
  amount,
  method,
  status = "PENDING",
  transactionCode = null,
) {
  const result = await new sql.Request(transaction)
    .input("InvoiceId", sql.Int, invoiceId)
    .input("Amount", sql.Decimal(18, 2), amount)
    .input("PaymentMethod", sql.NVarChar, method)
    .input("Status", sql.NVarChar, status)
    .input("TransactionCode", sql.NVarChar, transactionCode).query(`
      INSERT INTO Payments
        (
          InvoiceId,
          Amount,
          PaymentMethod,
          Status,
          TransactionCode,
          CreatedAt,
          PaidAt
        )
      OUTPUT INSERTED.*
      VALUES
        (
          @InvoiceId,
          @Amount,
          @PaymentMethod,
          @Status,
          @TransactionCode,
          GETDATE(),
          CASE WHEN CAST(@Status AS VARCHAR) = 'PAID' THEN GETDATE() ELSE NULL END
        )
    `);

  return result.recordset[0];
}

async function markVoucherUsed(transaction, customerId, voucherId) {
  if (!customerId || !voucherId) return;

  const req = new sql.Request(transaction);

  // 2. Đếm số lần sử dụng thành công (status = PAID) của khách hàng đối với voucher này
  const useCountResult = await req
    .input("CustomerId", sql.Int, customerId)
    .input("VoucherId", sql.Int, voucherId)
    .query(`
      SELECT COUNT(*) AS UseCount
      FROM Invoices i
      JOIN Payments p ON i.InvoiceId = p.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE a.CustomerId = @CustomerId
        AND i.VoucherId = @VoucherId
        AND p.Status = 'PAID'
    `);
  
  const useCount = useCountResult.recordset[0].UseCount;

  // 3. Nếu dùng từ 1 lần trở lên mới chuyển trạng thái UsedStatus = 1 trong CustomerVouchers
  if (useCount >= 1) {
    await req.query(`
      UPDATE CustomerVouchers
      SET
        UsedStatus = 1,
        UsedAt = GETDATE()
      WHERE CustomerId = @CustomerId
        AND VoucherId = @VoucherId
    `);
  }
}

async function markAppointmentPaid(transaction, appointmentId) {
  await new sql.Request(transaction).input(
    "AppointmentId",
    sql.Int,
    appointmentId,
  ).query(`
      UPDATE Appointments
      SET
        Status = CASE
          WHEN Status IN ('PENDING_PAYMENT', 'PENDING', 'PAID') THEN 'CONFIRMED'
          ELSE Status
        END,
        UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);
}

async function markInvoicePaid(transaction, invoiceId) {
  await new sql.Request(transaction).input("InvoiceId", sql.Int, invoiceId)
    .query(`
      UPDATE Invoices
      SET Status = 'PAID'
      WHERE InvoiceId = @InvoiceId
    `);
}

async function getMyPayments(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT
      p.PaymentId,
      p.InvoiceId,
      p.Amount,
      p.PaymentMethod AS PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.CreatedAt,
      p.PaidAt,

      i.AppointmentId,
      i.TotalAmount,
      i.DiscountAmount,
      i.FinalAmount,
      ISNULL(i.RewardPointsUsed, 0) AS RewardPointsUsed,
      ISNULL(i.RewardDiscountAmount, 0) AS RewardDiscountAmount,

      a.AppointmentDate,
      CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      CONVERT(VARCHAR(5), a.EndTime, 108) AS EndTime,
      a.Status AS AppointmentStatus,

      STRING_AGG(s.ServiceName, ', ') AS ServiceNames
    FROM Payments p
    INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
    INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
    INNER JOIN Customers c ON c.CustomerId = a.CustomerId
    LEFT JOIN AppointmentServices aps ON aps.AppointmentId = a.AppointmentId
    LEFT JOIN Services s ON s.ServiceId = aps.ServiceId
    WHERE c.UserId = @UserId
    GROUP BY
      p.PaymentId,
      p.InvoiceId,
      p.Amount,
      p.PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.CreatedAt,
      p.PaidAt,
      i.AppointmentId,
      i.TotalAmount,
      i.DiscountAmount,
      i.FinalAmount,
      i.RewardPointsUsed,
      i.RewardDiscountAmount,
      a.AppointmentDate,
      a.StartTime,
      a.EndTime,
      a.Status
    ORDER BY p.PaymentId DESC
  `);

  return result.recordset;
}

async function payAppointment(userId, appointmentId, payload = {}) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const item = await getPayableAppointment(
      userId,
      appointmentId,
      payload.voucherId || payload.VoucherId || null,
      payload.rewardPoints || payload.RewardPoints || 0,
    );

    const invoiceId = await createOrUpdateInvoice(
      transaction,
      appointmentId,
      item.TotalAmount,
      item.discountAmount,
      item.finalAmount,
      item.voucherId,
      item.rewardPointsUsed,
      item.rewardDiscountAmount,
    );

    const payment = await createPaymentRow(
      transaction,
      invoiceId,
      item.finalAmount,
      payload.method || payload.Method || "CASH",
      "PAID",
      payload.transactionCode || payload.TransactionCode || null,
    );

    if (item.rewardPointsUsed > 0) {
      await useLoyaltyPoints(
        transaction,
        item.CustomerId,
        payment.PaymentId,
        appointmentId,
        item.rewardPointsUsed,
        item.rewardDiscountAmount,
      );
    }

    if (item.voucherId) {
      await markVoucherUsed(transaction, item.CustomerId, item.voucherId);
    }

    await markInvoicePaid(transaction, invoiceId);
    await markAppointmentPaid(transaction, appointmentId);

    const earnedPoints = await addLoyaltyPoints(
      transaction,
      item.CustomerId,
      payment.PaymentId,
      appointmentId,
      item.finalAmount,
    );

    await updateCustomerMembershipLevel(transaction, item.CustomerId);

    await transaction.commit();

    return {
      ...payment,
      AppointmentId: Number(appointmentId),
      TotalAmount: item.TotalAmount,
      DiscountAmount: item.discountAmount,
      FinalAmount: item.finalAmount,
      MembershipDiscountAmount: item.membershipDiscountAmount,
      VoucherDiscountAmount: item.voucherDiscountAmount,
      RewardPointsUsed: item.rewardPointsUsed,
      RewardDiscountAmount: item.rewardDiscountAmount,
      EarnedPoints: earnedPoints,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function createVnpayPaymentUrl(userId, appointmentId, payload = {}, req) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const item = await getPayableAppointment(
      userId,
      appointmentId,
      payload.voucherId || payload.VoucherId || null,
      payload.rewardPoints || payload.RewardPoints || 0,
    );

    const invoiceId = await createOrUpdateInvoice(
      transaction,
      appointmentId,
      item.TotalAmount,
      item.discountAmount,
      item.finalAmount,
      item.voucherId,
      item.rewardPointsUsed,
      item.rewardDiscountAmount,
    );

    const txnRef = `${appointmentId}_${Date.now()}`;

    const payment = await createPaymentRow(
      transaction,
      invoiceId,
      item.finalAmount,
      "VNPAY",
      "PENDING",
      txnRef,
    );

    const tmnCode = process.env.VNP_TMN_CODE;
    const secretKey = process.env.VNP_HASH_SECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl =
      process.env.VNP_RETURN_URL ||
      "http://localhost:5000/api/payments/vnpay-return";

    if (!tmnCode || !secretKey || !vnpUrl) {
      throw new Error("Thiếu cấu hình VNPay");
    }

    const ipAddr =
      req?.headers?.["x-forwarded-for"] ||
      req?.connection?.remoteAddress ||
      req?.socket?.remoteAddress ||
      "127.0.0.1";

    const createDate = formatVnpDate(new Date());

    const vnpParams = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: `Thanh toan lich hen ${appointmentId}`,
      vnp_OrderType: "other",
      vnp_Amount: Math.round(item.finalAmount * 100),
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const secureHash = hmac
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    sortedParams.vnp_SecureHash = secureHash;

    const paymentUrl =
      vnpUrl + "?" + qs.stringify(sortedParams, { encode: false });

    await transaction.commit();

    return {
      paymentUrl,
      url: paymentUrl,
      PaymentId: payment.PaymentId,
      InvoiceId: invoiceId,
      AppointmentId: Number(appointmentId),
      TransactionCode: txnRef,
      TotalAmount: item.TotalAmount,
      DiscountAmount: item.discountAmount,
      FinalAmount: item.finalAmount,
      membershipDiscountAmount: item.membershipDiscountAmount,
      voucherDiscountAmount: item.voucherDiscountAmount,
      rewardPointsUsed: item.rewardPointsUsed,
      rewardDiscountAmount: item.rewardDiscountAmount,
      earnedPointsEstimate: Math.floor(Number(item.finalAmount || 0) / 10000),
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function processVnpayCallback(query = {}) {
  const secureHash = query.vnp_SecureHash;
  const secretKey = process.env.VNP_HASH_SECRET;

  const vnpParams = {};
  for (const key in query) {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
      vnpParams[key] = query[key];
    }
  }

  const sortedParams = sortObject(vnpParams);
  const signData = qs.stringify(sortedParams, { encode: false });
  const signed = crypto
    .createHmac("sha512", secretKey)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  if (String(secureHash).toLowerCase() !== String(signed).toLowerCase()) {
    return {
      success: false,
      code: "97",
      message: "Sai chữ ký VNPay",
    };
  }

  const txnRef = query.vnp_TxnRef;
  const responseCode = query.vnp_ResponseCode;
  const transactionNo = query.vnp_TransactionNo;

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const paymentResult = await new sql.Request(transaction).input(
      "TransactionCode",
      sql.NVarChar,
      txnRef,
    ).query(`
        SELECT TOP 1
          p.PaymentId,
          p.InvoiceId,
          p.Amount,
          p.Status,
          p.TransactionCode,
          i.AppointmentId,
          i.VoucherId,
          i.RewardPointsUsed,
          i.RewardDiscountAmount,
          a.CustomerId
        FROM Payments p
        INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
        INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
        WHERE p.TransactionCode = @TransactionCode
        ORDER BY p.PaymentId DESC
      `);

    const payment = paymentResult.recordset[0];

    if (!payment) {
      throw new Error("Không tìm thấy giao dịch VNPay");
    }

    if (payment.Status === "PAID") {
      await transaction.commit();

      return {
        success: true,
        code: "00",
        message: "Giao dịch đã được xử lý trước đó",
        AppointmentId: payment.AppointmentId,
      };
    }

    if (responseCode === "00") {
      await new sql.Request(transaction)
        .input("PaymentId", sql.Int, payment.PaymentId)
        .input("VnpTransactionNo", sql.NVarChar, transactionNo || null)
        .input("VnpResponseCode", sql.NVarChar, responseCode).query(`
          UPDATE Payments
          SET
            Status = 'PAID',
            VnpTransactionNo = @VnpTransactionNo,
            VnpResponseCode = @VnpResponseCode,
            PaidAt = GETDATE()
          WHERE PaymentId = @PaymentId
        `);

      await markInvoicePaid(transaction, payment.InvoiceId);
      await markAppointmentPaid(transaction, payment.AppointmentId);

      if (payment.VoucherId) {
        await markVoucherUsed(
          transaction,
          payment.CustomerId,
          payment.VoucherId,
        );
      }

      if (Number(payment.RewardPointsUsed || 0) > 0) {
        await useLoyaltyPoints(
          transaction,
          payment.CustomerId,
          payment.PaymentId,
          payment.AppointmentId,
          payment.RewardPointsUsed,
          payment.RewardDiscountAmount,
        );
      }

      const earnedPoints = await addLoyaltyPoints(
        transaction,
        payment.CustomerId,
        payment.PaymentId,
        payment.AppointmentId,
        payment.Amount,
      );

      await updateCustomerMembershipLevel(transaction, payment.CustomerId);

      await transaction.commit();

      return {
        success: true,
        code: "00",
        message: "Thanh toán thành công",
        AppointmentId: payment.AppointmentId,
        PaymentId: payment.PaymentId,
        EarnedPoints: earnedPoints,
      };
    }

    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, payment.PaymentId)
      .input("VnpResponseCode", sql.NVarChar, responseCode).query(`
        UPDATE Payments
        SET
          Status = 'FAILED',
          VnpResponseCode = @VnpResponseCode
        WHERE PaymentId = @PaymentId
      `);

    await transaction.commit();

    return {
      success: false,
      code: responseCode,
      message: "Thanh toán không thành công",
      AppointmentId: payment.AppointmentId,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function handleVnpayReturn(query) {
  return processVnpayCallback(query);
}

async function handleVnpayIpn(query) {
  return processVnpayCallback(query);
}

/* =========================================================
   PAYOS - Thanh toán & Hoàn tiền
   ========================================================= */

const { getPayOS } = require("../../config/payos.config");

async function createPayosPaymentUrl(userId, appointmentId, payload = {}) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const item = await getPayableAppointment(
      userId,
      appointmentId,
      payload.voucherId || payload.VoucherId || null,
      payload.rewardPoints || payload.RewardPoints || 0,
    );

    const invoiceId = await createOrUpdateInvoice(
      transaction,
      appointmentId,
      item.TotalAmount,
      item.discountAmount,
      item.finalAmount,
      item.voucherId,
      item.rewardPointsUsed,
      item.rewardDiscountAmount,
    );

    // orderCode phải là số nguyên dương, duy nhất
    const orderCode = Number(`${appointmentId}${Date.now() % 1000000}`);

    const payment = await createPaymentRow(
      transaction,
      invoiceId,
      item.finalAmount,
      "PAYOS",
      "PENDING",
      String(orderCode),
    );

    const payos = getPayOS();

    const returnUrl =
      process.env.PAYOS_RETURN_URL ||
      `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payments/payos-return`;

    const cancelUrl =
      process.env.PAYOS_CANCEL_URL ||
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/payment/${appointmentId}`;

    const paymentData = {
      orderCode: orderCode,
      amount: Math.round(item.finalAmount),
      description: `Thanh toan lich hen #${appointmentId}`.slice(0, 25),
      returnUrl: returnUrl,
      cancelUrl: cancelUrl,
      items: [
        {
          name: `Lich hen #${appointmentId}`,
          quantity: 1,
          price: Math.round(item.finalAmount),
        },
      ],
    };

    const paymentLink = await payos.paymentRequests.create(paymentData);

    // Lưu orderCode vào TransactionCode
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, payment.PaymentId)
      .input("TransactionCode", sql.NVarChar, String(orderCode)).query(`
        UPDATE Payments
        SET TransactionCode = @TransactionCode
        WHERE PaymentId = @PaymentId
      `);

    await transaction.commit();

    return {
      paymentUrl: paymentLink.checkoutUrl,
      url: paymentLink.checkoutUrl,
      orderCode: orderCode,
      PaymentId: payment.PaymentId,
      InvoiceId: invoiceId,
      AppointmentId: Number(appointmentId),
      TransactionCode: String(orderCode),
      TotalAmount: item.TotalAmount,
      DiscountAmount: item.discountAmount,
      FinalAmount: item.finalAmount,
      membershipDiscountAmount: item.membershipDiscountAmount,
      voucherDiscountAmount: item.voucherDiscountAmount,
      rewardPointsUsed: item.rewardPointsUsed,
      rewardDiscountAmount: item.rewardDiscountAmount,
      earnedPointsEstimate: Math.floor(Number(item.finalAmount || 0) / 10000),
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function processPayosWebhook(webhookBody) {
  const payos = getPayOS();

  let webhookData;
  try {
    webhookData = payos.webhooks.verify(webhookBody);
  } catch (err) {
    console.error("PayOS webhook verify failed:", err.message);
    return { success: false, message: "Chữ ký webhook không hợp lệ" };
  }

  // Bỏ qua test webhook từ PayOS (orderCode = 123)
  if (
    webhookData.orderCode === 123 ||
    String(webhookData.orderCode) === "123"
  ) {
    return { success: true, message: "Test webhook received" };
  }

  const orderCode = String(webhookData.orderCode);
  const code = webhookData.code; // "00" = thành công

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const paymentResult = await new sql.Request(transaction).input(
      "TransactionCode",
      sql.NVarChar,
      orderCode,
    ).query(`
        SELECT TOP 1
          p.PaymentId,
          p.InvoiceId,
          p.Amount,
          p.Status,
          p.TransactionCode,
          i.AppointmentId,
          i.VoucherId,
          i.RewardPointsUsed,
          i.RewardDiscountAmount,
          a.CustomerId
        FROM Payments p
        INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
        INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
        WHERE p.TransactionCode = @TransactionCode
          AND p.PaymentMethod = 'PAYOS'
        ORDER BY p.PaymentId DESC
      `);

    const payment = paymentResult.recordset[0];

    if (!payment) {
      await transaction.commit();
      return { success: false, message: "Không tìm thấy giao dịch PayOS" };
    }

    if (payment.Status === "PAID") {
      await transaction.commit();
      return {
        success: true,
        message: "Giao dịch đã được xử lý trước đó",
        AppointmentId: payment.AppointmentId,
      };
    }

    if (code === "00") {
      // Thanh toán thành công
      await new sql.Request(transaction)
        .input("PaymentId", sql.Int, payment.PaymentId)
        .input(
          "VnpTransactionNo",
          sql.NVarChar,
          String(webhookData.paymentLinkId || webhookData.reference || ""),
        ).query(`
          UPDATE Payments
          SET
            Status = 'PAID',
            VnpTransactionNo = @VnpTransactionNo,
            VnpResponseCode = '00',
            PaidAt = GETDATE()
          WHERE PaymentId = @PaymentId
        `);

      await markInvoicePaid(transaction, payment.InvoiceId);
      await markAppointmentPaid(transaction, payment.AppointmentId);

      if (payment.VoucherId) {
        await markVoucherUsed(
          transaction,
          payment.CustomerId,
          payment.VoucherId,
        );
      }

      if (Number(payment.RewardPointsUsed || 0) > 0) {
        await useLoyaltyPoints(
          transaction,
          payment.CustomerId,
          payment.PaymentId,
          payment.AppointmentId,
          payment.RewardPointsUsed,
          payment.RewardDiscountAmount,
        );
      }

      const earnedPoints = await addLoyaltyPoints(
        transaction,
        payment.CustomerId,
        payment.PaymentId,
        payment.AppointmentId,
        payment.Amount,
      );

      await updateCustomerMembershipLevel(transaction, payment.CustomerId);

      await transaction.commit();

      return {
        success: true,
        code: "00",
        message: "Thanh toán PayOS thành công",
        AppointmentId: payment.AppointmentId,
        PaymentId: payment.PaymentId,
        EarnedPoints: earnedPoints,
      };
    }

    // Thanh toán thất bại
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, payment.PaymentId)
      .input("VnpResponseCode", sql.NVarChar, code || "FAILED").query(`
        UPDATE Payments
        SET
          Status = 'FAILED',
          VnpResponseCode = @VnpResponseCode
        WHERE PaymentId = @PaymentId
      `);

    await transaction.commit();

    return {
      success: false,
      code: code,
      message: "Thanh toán PayOS không thành công",
      AppointmentId: payment.AppointmentId,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function handlePayosReturn(query = {}) {
  const orderCode = query.orderCode || query.code;
  const status = query.status; // PAID, CANCELLED, ...
  const cancel = query.cancel === "true" || status === "CANCELLED";

  if (!orderCode) {
    return {
      success: false,
      message: "Thiếu mã đơn hàng",
    };
  }

  const pool = await connectDB();

  // Tìm payment theo orderCode
  const paymentResult = await pool
    .request()
    .input("TransactionCode", sql.NVarChar, String(orderCode)).query(`
      SELECT TOP 1
        p.PaymentId,
        p.InvoiceId,
        p.Amount,
        p.Status,
        i.AppointmentId,
        a.CustomerId
      FROM Payments p
      INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
      INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
      WHERE p.TransactionCode = @TransactionCode
        AND p.PaymentMethod = 'PAYOS'
      ORDER BY p.PaymentId DESC
    `);

  const payment = paymentResult.recordset[0];

  if (!payment) {
    return { success: false, message: "Không tìm thấy giao dịch" };
  }

  if (payment.Status === "PAID") {
    return {
      success: true,
      message: "Thanh toán thành công",
      AppointmentId: payment.AppointmentId,
      PaymentId: payment.PaymentId,
    };
  }

  if (cancel) {
    return {
      success: false,
      message: "Thanh toán đã bị hủy",
      AppointmentId: payment.AppointmentId,
    };
  }

  // Kiểm tra trạng thái thực tế từ PayOS
  try {
    const payos = getPayOS();
    const info = await payos.paymentRequests.get(String(orderCode));

    if (info && info.status === "PAID") {
      // Webhook có thể chưa đến, xử lý tại đây
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        await new sql.Request(transaction)
          .input("PaymentId", sql.Int, payment.PaymentId)
          .input(
            "VnpTransactionNo",
            sql.NVarChar,
            String(info.id || info.paymentLinkId || ""),
          ).query(`
            UPDATE Payments
            SET
              Status = 'PAID',
              VnpTransactionNo = @VnpTransactionNo,
              VnpResponseCode = '00',
              PaidAt = GETDATE()
            WHERE PaymentId = @PaymentId
              AND Status != 'PAID'
          `);

        await markInvoicePaid(transaction, payment.InvoiceId);
        await markAppointmentPaid(transaction, payment.AppointmentId);
        await transaction.commit();

        return {
          success: true,
          message: "Thanh toán PayOS thành công",
          AppointmentId: payment.AppointmentId,
          PaymentId: payment.PaymentId,
        };
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }
  } catch (err) {
    console.error("PayOS getPaymentLinkInformation error:", err.message);
  }

  return {
    success: false,
    message: "Đang chờ xác nhận thanh toán",
    AppointmentId: payment.AppointmentId,
  };
}

async function cancelPayosPayment(paymentId, userId) {
  const pool = await connectDB();

  const paymentResult = await pool
    .request()
    .input("PaymentId", sql.Int, paymentId).query(`
      SELECT TOP 1
        p.PaymentId,
        p.TransactionCode,
        p.Status,
        p.PaymentMethod,
        i.AppointmentId,
        a.CustomerId,
        c.UserId
      FROM Payments p
      INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
      INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
      INNER JOIN Customers c ON c.CustomerId = a.CustomerId
      WHERE p.PaymentId = @PaymentId
    `);

  const payment = paymentResult.recordset[0];

  if (!payment) {
    throw new Error("Không tìm thấy giao dịch");
  }

  if (payment.PaymentMethod !== "PAYOS") {
    throw new Error("Chỉ hỗ trợ hủy giao dịch PayOS");
  }

  if (payment.Status === "PAID") {
    throw new Error("Không thể hủy giao dịch đã thanh toán");
  }

  if (payment.Status !== "PENDING") {
    throw new Error("Giao dịch không ở trạng thái chờ thanh toán");
  }

  try {
    const payos = getPayOS();
    await payos.paymentRequests.cancel(
      String(payment.TransactionCode),
      "Khách hàng hủy thanh toán",
    );
  } catch (err) {
    console.error("PayOS cancelPaymentLink error:", err.message);
  }

  await pool
    .request()
    .input("PaymentId", sql.Int, paymentId).query(`
      UPDATE Payments
      SET Status = 'FAILED', VnpResponseCode = 'CANCELLED'
      WHERE PaymentId = @PaymentId
    `);

  return { message: "Đã hủy giao dịch PayOS", PaymentId: paymentId };
}

async function refundPayosPayment(paymentId, userId, reason = "") {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const paymentResult = await new sql.Request(transaction).input(
      "PaymentId",
      sql.Int,
      paymentId,
    ).query(`
        SELECT TOP 1
          p.PaymentId,
          p.InvoiceId,
          p.Amount,
          p.Status,
          p.PaymentMethod,
          i.AppointmentId,
          a.CustomerId
        FROM Payments p
        INNER JOIN Invoices i ON i.InvoiceId = p.InvoiceId
        INNER JOIN Appointments a ON a.AppointmentId = i.AppointmentId
        WHERE p.PaymentId = @PaymentId
      `);

    const payment = paymentResult.recordset[0];

    if (!payment) {
      throw new Error("Không tìm thấy giao dịch");
    }

    if (payment.Status !== "PAID") {
      throw new Error("Chỉ có thể hoàn tiền cho giao dịch đã thanh toán");
    }

    // Kiểm tra đã có refund pending/completed chưa
    const existingRefund = await new sql.Request(transaction).input(
      "PaymentId",
      sql.Int,
      paymentId,
    ).query(`
        SELECT TOP 1 RefundId
        FROM Refunds
        WHERE PaymentId = @PaymentId
          AND Status IN ('PENDING', 'APPROVED', 'COMPLETED')
      `);

    if (existingRefund.recordset[0]) {
      throw new Error("Đã có yêu cầu hoàn tiền cho giao dịch này");
    }

    // Tạo record refund
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, paymentId)
      .input("RefundAmount", sql.Decimal(18, 2), payment.Amount)
      .input("Reason", sql.NVarChar, reason || "Yêu cầu hoàn tiền").query(`
        INSERT INTO Refunds (PaymentId, RefundAmount, Reason, Status, CreatedAt)
        VALUES (@PaymentId, @RefundAmount, @Reason, 'PENDING', GETDATE())
      `);

    // Cập nhật trạng thái payment
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, paymentId).query(`
        UPDATE Payments
        SET Status = 'REFUND_PENDING'
        WHERE PaymentId = @PaymentId
      `);

    // Cập nhật trạng thái invoice
    await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, payment.InvoiceId).query(`
        UPDATE Invoices
        SET Status = 'REFUND_PENDING'
        WHERE InvoiceId = @InvoiceId
      `);

    // Cập nhật trạng thái appointment
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, payment.AppointmentId).query(`
        UPDATE Appointments
        SET Status = 'REFUND_PENDING', UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await transaction.commit();

    return {
      message:
        "Đã ghi nhận yêu cầu hoàn tiền. Admin sẽ xử lý trong thời gian sớm nhất.",
      PaymentId: paymentId,
      AppointmentId: payment.AppointmentId,
      RefundAmount: payment.Amount,
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function applyVoucher(userId, appointmentId, body, isStaff = false) {
  const pool = await connectDB();

  const voucherId = body.voucherId || null;
  const rewardPoints = Number(body.rewardPoints || 0);

  // 1. Lấy thông tin hóa đơn hiện tại để xem có voucher nào đang được áp dụng không
  const oldInvoiceRes = await pool.request()
    .input("AppointmentId", sql.Int, appointmentId)
    .query(`
      SELECT TOP 1 VoucherId
      FROM Invoices
      WHERE AppointmentId = @AppointmentId
      ORDER BY InvoiceId DESC
    `);
  const oldVoucherId = oldInvoiceRes.recordset[0]?.VoucherId || null;

  // 2. Tính toán tiền chiết khấu và thực hiện các bước kiểm định
  const calculation = await getPayableAppointment(userId, appointmentId, voucherId, rewardPoints, isStaff);

  // 3. Ràng buộc số lần sử dụng tối đa của voucher mới (nếu áp dụng voucher mới)
  if (voucherId && voucherId !== oldVoucherId) {
    const countRes = await pool.request()
      .input("CustomerId", sql.Int, calculation.CustomerId)
      .input("VoucherId", sql.Int, voucherId)
      .query(`
        SELECT COUNT(*) AS UseCount
        FROM Invoices i
        JOIN Appointments a ON i.AppointmentId = a.AppointmentId
        WHERE a.CustomerId = @CustomerId
          AND i.VoucherId = @VoucherId
          AND a.Status NOT IN ('CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'NO_SHOW')
      `);
    if (countRes.recordset[0].UseCount >= 1) {
      throw new Error("Voucher này chỉ có thể sử dụng tối đa 1 lần");
    }
  }

  // 4. Cập nhật số lượng của voucher trong bảng Vouchers (trừ voucher mới, hoàn voucher cũ)
  if (oldVoucherId && oldVoucherId !== voucherId) {
    // Hoàn lại số lượng voucher cũ
    await pool.request().input("OldVoucherId", sql.Int, oldVoucherId).query(`
      UPDATE Vouchers
      SET Quantity = Quantity + 1
      WHERE VoucherId = @OldVoucherId
    `);
  }

  if (voucherId && voucherId !== oldVoucherId) {
    // Trừ đi số lượng voucher mới
    await pool.request().input("NewVoucherId", sql.Int, voucherId).query(`
      UPDATE Vouchers
      SET Quantity = CASE WHEN Quantity > 0 THEN Quantity - 1 ELSE 0 END
      WHERE VoucherId = @NewVoucherId
    `);
  }

  // 5. Cập nhật hoặc tạo hóa đơn mới trong CSDL
  await createOrUpdateInvoice(
    pool,
    appointmentId,
    calculation.TotalAmount,
    calculation.discountAmount,
    calculation.finalAmount,
    calculation.voucherId,
    calculation.rewardPointsUsed,
    calculation.rewardDiscountAmount
  );

  return calculation;
}

module.exports = {
  getMyPayments,
  getPayableAppointment,
  payAppointment,
  createVnpayPaymentUrl,
  processVnpayCallback,
  handleVnpayReturn,
  handleVnpayIpn,
  createPayosPaymentUrl,
  processPayosWebhook,
  handlePayosReturn,
  cancelPayosPayment,
  refundPayosPayment,
  applyVoucher,
};
