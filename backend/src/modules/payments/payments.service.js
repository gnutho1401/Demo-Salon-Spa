const { sql, connectDB } = require("../../config/db");
const crypto = require("crypto");
const qs = require("qs");
const { notifyCustomer } = require("../../utils/notifyUser");
const {
  getCustomerDiscountPercent,
  calcMembershipDiscount,
  addLoyaltyPoints,
} = require("../../utils/membershipDiscount");

function formatVnpDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sortObject(obj) {
  const sorted = {};
  const keys = Object.keys(obj).sort();

  keys.forEach((key) => {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  });

  return sorted;
}

function createVnpHash(params) {
  const secret = process.env.VNP_HASH_SECRET?.trim();

  const signData = qs.stringify(sortObject(params), {
    encode: false,
  });

  const hash = crypto
    .createHmac("sha512", secret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");

  return hash;
}

function buildVnpayUrl(vnpUrl, params) {
  const sortedParams = sortObject(params);
  const secureHash = createVnpHash(params);

  sortedParams.vnp_SecureHash = secureHash;

  const paymentUrl =
    vnpUrl + "?" + qs.stringify(sortedParams, { encode: false });

  return paymentUrl;
}

function verifyVnpParams(query) {
  const params = { ...query };
  const secureHash = params.vnp_SecureHash;

  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const checkHash = createVnpHash(params);

  return checkHash === secureHash;
}

function normalizePaymentMethod(method) {
  return String(method || "CASH").toUpperCase();
}

function getInitialPaymentStatus(method) {
  const paymentMethod = normalizePaymentMethod(method);

  if (paymentMethod === "VNPAY") return "PENDING";

  if (paymentMethod === "CASH" || paymentMethod === "BANKING") {
    return "PAID";
  }

  return "PENDING";
}

async function getAll() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      p.PaymentId,
      i.InvoiceId,
      a.AppointmentId,
      p.Amount,
      p.PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.PaidAt,
      STRING_AGG(s.ServiceName, N', ') AS ServiceNames
    FROM Payments p
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    GROUP BY 
      p.PaymentId,
      i.InvoiceId,
      a.AppointmentId,
      p.Amount,
      p.PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.PaidAt
    ORDER BY p.PaymentId DESC
  `);

  return result.recordset;
}

async function getMine(userId) {
  const pool = await connectDB();

  const result = await pool.request().input("UserId", sql.Int, userId).query(`
    SELECT
      p.PaymentId,
      i.InvoiceId,
      a.AppointmentId,
      p.Amount,
      p.PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.CreatedAt,
      p.PaidAt,
      STRING_AGG(s.ServiceName, N', ') AS ServiceNames
    FROM Payments p
    JOIN Invoices i ON p.InvoiceId = i.InvoiceId
    JOIN Appointments a ON i.AppointmentId = a.AppointmentId
    JOIN Customers c ON a.CustomerId = c.CustomerId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE c.UserId = @UserId
    GROUP BY 
      p.PaymentId,
      i.InvoiceId,
      a.AppointmentId,
      p.Amount,
      p.PaymentMethod,
      p.Status,
      p.TransactionCode,
      p.CreatedAt,
      p.PaidAt
    ORDER BY p.PaymentId DESC
  `);

  return result.recordset;
}

async function getPayableAppointment(userId, appointmentId, voucherId = null) {
  const pool = await connectDB();

  const info = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT 
        a.AppointmentId,
        a.CustomerId,
        a.Status,
        SUM(aps.Price) AS TotalAmount
      FROM Appointments a
      JOIN Customers c ON a.CustomerId = c.CustomerId
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      WHERE a.AppointmentId = @AppointmentId
        AND c.UserId = @UserId
      GROUP BY a.AppointmentId, a.CustomerId, a.Status
    `);

  const item = info.recordset[0];

  if (!item) throw new Error("Không tìm thấy lịch hẹn cần thanh toán");

  if (
    ["CANCELLED", "COMPLETED", "REFUND_PENDING", "REFUNDED"].includes(
      String(item.Status || "").toUpperCase(),
    )
  ) {
    throw new Error("Lịch hẹn này không còn được thanh toán");
  }

  const paid = await pool
    .request()
    .input("AppointmentId", sql.Int, appointmentId).query(`
      SELECT TOP 1 p.PaymentId
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      WHERE i.AppointmentId = @AppointmentId
        AND p.Status = 'PAID'
    `);

  if (paid.recordset[0]) throw new Error("Lịch hẹn này đã được thanh toán");

  const totalAmount = Number(item.TotalAmount || 0);
  let discountAmount = 0;
  let finalAmount = totalAmount;
  let usedVoucherId = null;

  if (voucherId) {
    const voucherResult = await pool
      .request()
      .input("VoucherId", sql.Int, voucherId)
      .input("CustomerId", sql.Int, item.CustomerId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount).query(`
    SELECT TOP 1
      v.VoucherId,
      v.Code,
      v.DiscountType,
      v.DiscountValue,
      v.MinOrderAmount,
      v.MaxDiscountAmount,
      cv.UsedStatus
    FROM Vouchers v
    JOIN CustomerVouchers cv ON v.VoucherId = cv.VoucherId
    WHERE v.VoucherId = @VoucherId
      AND cv.CustomerId = @CustomerId
      AND v.Status = 'ACTIVE'
      AND ISNULL(cv.UsedStatus, 0) = 0
      AND ISNULL(v.MinOrderAmount, 0) <= @TotalAmount
      AND (v.StartDate IS NULL OR v.StartDate <= CAST(GETDATE() AS DATE))
      AND (v.EndDate IS NULL OR v.EndDate >= CAST(GETDATE() AS DATE))
      AND NOT EXISTS (
        SELECT 1
        FROM Payments p
        JOIN Invoices i ON p.InvoiceId = i.InvoiceId
        JOIN Appointments a2 ON i.AppointmentId = a2.AppointmentId
        WHERE i.VoucherId = v.VoucherId
          AND a2.CustomerId = @CustomerId
          AND p.Status = 'PAID'
      )
  `);

    const voucher = voucherResult.recordset[0];

    if (!voucher) {
      throw new Error(
        "Voucher không hợp lệ, chưa lưu, đã dùng hoặc không đủ điều kiện",
      );
    }

    if (String(voucher.DiscountType).toUpperCase() === "PERCENT") {
      discountAmount = (totalAmount * Number(voucher.DiscountValue || 0)) / 100;

      if (
        voucher.MaxDiscountAmount !== null &&
        voucher.MaxDiscountAmount !== undefined
      ) {
        discountAmount = Math.min(
          discountAmount,
          Number(voucher.MaxDiscountAmount || 0),
        );
      }
    } else {
      discountAmount = Number(voucher.DiscountValue || 0);
    }

    discountAmount = Math.min(discountAmount, totalAmount);
    finalAmount = Math.max(totalAmount - discountAmount, 0);
    usedVoucherId = voucher.VoucherId;
  }

  return {
    ...item,
    TotalAmount: totalAmount,
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
) {
  let invoiceId;

  const invoice = await new sql.Request(transaction).input(
    "AppointmentId",
    sql.Int,
    appointmentId,
  ).query(`
      SELECT InvoiceId 
      FROM Invoices 
      WHERE AppointmentId = @AppointmentId
    `);

  if (invoice.recordset[0]) {
    invoiceId = invoice.recordset[0].InvoiceId;

    await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, invoiceId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount || 0)
      .input("DiscountAmount", sql.Decimal(18, 2), discountAmount || 0)
      .input("FinalAmount", sql.Decimal(18, 2), finalAmount || 0)
      .input("VoucherId", sql.Int, voucherId).query(`
        UPDATE Invoices
        SET 
          TotalAmount = @TotalAmount,
          DiscountAmount = @DiscountAmount,
          FinalAmount = @FinalAmount,
          VoucherId = @VoucherId
        WHERE InvoiceId = @InvoiceId
      `);
  } else {
    const createdInvoice = await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, appointmentId)
      .input("TotalAmount", sql.Decimal(18, 2), totalAmount || 0)
      .input("DiscountAmount", sql.Decimal(18, 2), discountAmount || 0)
      .input("FinalAmount", sql.Decimal(18, 2), finalAmount || 0)
      .input("VoucherId", sql.Int, voucherId).query(`
        INSERT INTO Invoices 
          (AppointmentId, TotalAmount, DiscountAmount, FinalAmount, VoucherId)
        OUTPUT INSERTED.InvoiceId
        VALUES 
          (@AppointmentId, @TotalAmount, @DiscountAmount, @FinalAmount, @VoucherId)
      `);

    invoiceId = createdInvoice.recordset[0].InvoiceId;
  }

  return invoiceId;
}

async function payAppointment(userId, appointmentId, payload = {}) {
  const pool = await connectDB();

  const rawPaymentMethod =
    typeof payload === "string"
      ? payload
      : payload.paymentMethod || payload.PaymentMethod || "CASH";

  const paymentMethod = normalizePaymentMethod(rawPaymentMethod);
  const paymentStatus = getInitialPaymentStatus(paymentMethod);

  const item = await getPayableAppointment(
    userId,
    appointmentId,
    payload.voucherId || payload.VoucherId || null,
  );

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const invoiceId = await createOrUpdateInvoice(
      transaction,
      appointmentId,
      item.TotalAmount,
      item.discountAmount,
      item.finalAmount,
      item.voucherId,
    );

    const payment = await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, invoiceId)
      .input("Amount", sql.Decimal(18, 2), item.finalAmount)
      .input("PaymentMethod", sql.NVarChar, paymentMethod)
      .input("Status", sql.NVarChar, paymentStatus)
      .input("TransactionCode", sql.NVarChar, `PAY${Date.now()}`).query(`
        INSERT INTO Payments 
          (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt)
        OUTPUT INSERTED.*
        VALUES 
          (
            @InvoiceId,
            @Amount,
            @PaymentMethod,
            @Status,
            @TransactionCode,
            CASE WHEN @Status = 'PAID' THEN GETDATE() ELSE NULL END
          )
      `);

    if (paymentStatus === "PAID") {
      await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        appointmentId,
      ).query(`
          UPDATE Appointments
          SET 
            Status = CASE
              WHEN Status IN ('PENDING_PAYMENT', 'PENDING') THEN 'CONFIRMED'
              ELSE Status
            END,
            UpdatedAt = GETDATE()
          WHERE AppointmentId = @AppointmentId
        `);
    }

    if (item.voucherId && paymentStatus === "PAID") {
      const usedResult = await new sql.Request(transaction)
        .input("CustomerId", sql.Int, item.CustomerId)
        .input("VoucherId", sql.Int, item.voucherId).query(`
    UPDATE CustomerVouchers
    SET 
      UsedStatus = 1,
      UsedAt = GETDATE()
    WHERE CustomerId = @CustomerId
      AND VoucherId = @VoucherId
      AND ISNULL(UsedStatus, 0) = 0
  `);

      if (usedResult.rowsAffected[0] === 0) {
        throw new Error("Voucher này đã được sử dụng rồi");
      }
    }

    await transaction.commit();

    return payment.recordset[0];
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }
}

async function createVnpayPaymentUrl(
  userId,
  appointmentId,
  payload = {},
  ipAddr = "127.0.0.1",
) {
  const vnpUrl =
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

  const tmnCode = process.env.VNP_TMN_CODE;
  const returnUrl =
    process.env.VNP_RETURN_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/api/payments/vnpay-return`;

  if (!tmnCode) throw new Error("Thiếu VNP_TMN_CODE trong file .env");

  const item = await getPayableAppointment(
    userId,
    appointmentId,
    payload.voucherId || payload.VoucherId || null,
  );

  const txnRef = `APT${appointmentId}_${Date.now()}`;

  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const invoiceId = await createOrUpdateInvoice(
      transaction,
      appointmentId,
      item.TotalAmount,
      item.discountAmount,
      item.finalAmount,
      item.voucherId,
    );

    await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, invoiceId)
      .input("Amount", sql.Decimal(18, 2), item.finalAmount)
      .input("PaymentMethod", sql.NVarChar, "VNPAY")
      .input("Status", sql.NVarChar, "PENDING")
      .input("TransactionCode", sql.NVarChar, txnRef)
      .input("VnpTxnRef", sql.NVarChar, txnRef).query(`
        INSERT INTO Payments 
          (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, VnpTxnRef)
        VALUES 
          (@InvoiceId, @Amount, @PaymentMethod, @Status, @TransactionCode, @VnpTxnRef)
      `);

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode.trim(),
    vnp_Amount: Math.round(Number(item.finalAmount || 0) * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Thanh toan lich hen ${appointmentId}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr:
      ipAddr === "::1" || ipAddr === "::ffff:127.0.0.1"
        ? "127.0.0.1"
        : String(ipAddr).split(",")[0],
    vnp_CreateDate: formatVnpDate(),
  };

  const paymentUrl = buildVnpayUrl(vnpUrl, params);

  return {
    paymentUrl,
    amount: item.finalAmount,
    originalAmount: item.TotalAmount,
    discountAmount: item.discountAmount,
    voucherId: item.voucherId,
    transactionCode: txnRef,
  };
}

async function processVnpayCallback(query) {
  const isValid = verifyVnpParams(query);

  const txnRef = query.vnp_TxnRef;
  const responseCode = query.vnp_ResponseCode;
  const transactionStatus = query.vnp_TransactionStatus;
  const transactionNo = query.vnp_TransactionNo;
  const paidAmount = Number(query.vnp_Amount || 0) / 100;

  if (!isValid) {
    return { ok: false, code: "97", message: "Invalid checksum" };
  }

  const pool = await connectDB();

  const found = await pool
    .request()
    .input("TransactionCode", sql.NVarChar, txnRef).query(`
      SELECT TOP 1
        p.PaymentId,
        p.Amount,
        p.Status AS PaymentStatus,
        i.AppointmentId,
        i.VoucherId,
        a.CustomerId,
        a.Status AS AppointmentStatus
      FROM Payments p
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      WHERE p.TransactionCode = @TransactionCode
         OR p.VnpTxnRef = @TransactionCode
    `);

  const payment = found.recordset[0];

  if (!payment) {
    return { ok: false, code: "01", message: "Order not found" };
  }

  if (Math.round(Number(payment.Amount || 0)) !== Math.round(paidAmount)) {
    return {
      ok: false,
      code: "04",
      message: "Invalid amount",
      appointmentId: payment.AppointmentId,
    };
  }

  if (String(payment.PaymentStatus).toUpperCase() === "PAID") {
    return {
      ok: true,
      code: "00",
      message: "Order already confirmed",
      appointmentId: payment.AppointmentId,
    };
  }

  const isSuccess = responseCode === "00" && transactionStatus === "00";

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    if (isSuccess) {
      await new sql.Request(transaction)
        .input("PaymentId", sql.Int, payment.PaymentId)
        .input("TxnRef", sql.NVarChar, txnRef)
        .input("TransactionNo", sql.NVarChar, transactionNo || txnRef)
        .input("ResponseCode", sql.NVarChar, responseCode).query(`
          UPDATE Payments
          SET
            Status = 'PAID',
            VnpTxnRef = @TxnRef,
            VnpTransactionNo = @TransactionNo,
            VnpResponseCode = @ResponseCode,
            PaidAt = GETDATE()
          WHERE PaymentId = @PaymentId
        `);

      await new sql.Request(transaction).input(
        "AppointmentId",
        sql.Int,
        payment.AppointmentId,
      ).query(`
          UPDATE Appointments
          SET
            Status = CASE
              WHEN Status IN ('PENDING_PAYMENT', 'PENDING') THEN 'CONFIRMED'
              ELSE Status
            END,
            UpdatedAt = GETDATE()
          WHERE AppointmentId = @AppointmentId
        `);

      if (payment.VoucherId) {
        const usedResult = await new sql.Request(transaction)
          .input("CustomerId", sql.Int, payment.CustomerId)
          .input("VoucherId", sql.Int, payment.VoucherId).query(`
    UPDATE CustomerVouchers
    SET
      UsedStatus = 1,
      UsedAt = GETDATE()
    WHERE CustomerId = @CustomerId
      AND VoucherId = @VoucherId
      AND ISNULL(UsedStatus, 0) = 0
  `);

        if (usedResult.rowsAffected[0] === 0) {
          throw new Error("Voucher này đã được sử dụng rồi");
        }
      }

      await new sql.Request(transaction)
        .input("AppointmentId", sql.Int, payment.AppointmentId)
        .input("OldStatus", sql.NVarChar, payment.AppointmentStatus).query(`
          INSERT INTO AppointmentStatusHistory
            (AppointmentId, OldStatus, NewStatus, ChangedBy, Reason)
          VALUES
            (@AppointmentId, @OldStatus, 'CONFIRMED', NULL, N'VNPay payment successful')
        `);
    } else {
      await new sql.Request(transaction)
        .input("PaymentId", sql.Int, payment.PaymentId)
        .input("TxnRef", sql.NVarChar, txnRef)
        .input("TransactionNo", sql.NVarChar, transactionNo || null)
        .input("ResponseCode", sql.NVarChar, responseCode).query(`
          UPDATE Payments
          SET
            Status = 'FAILED',
            VnpTxnRef = @TxnRef,
            VnpTransactionNo = @TransactionNo,
            VnpResponseCode = @ResponseCode
          WHERE PaymentId = @PaymentId
            AND Status = 'PENDING'
        `);
    }

    await transaction.commit();

    return {
      ok: isSuccess,
      code: "00",
      message: isSuccess ? "Confirm Success" : "Payment Failed",
      appointmentId: payment.AppointmentId,
    };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}

    throw err;
  }
}

async function handleVnpayReturn(query) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const result = await processVnpayCallback(query);

  if (!result.appointmentId) {
    return `${frontendUrl}/customer/payment-result?status=failed`;
  }

  if (result.ok) {
    return `${frontendUrl}/customer/payment-result?status=success&appointmentId=${result.appointmentId}`;
  }

  return `${frontendUrl}/customer/payment-result?status=failed&appointmentId=${result.appointmentId}`;
}

async function handleVnpayIpn(query) {
  return await processVnpayCallback(query);
}

async function getById(id) {
  const pool = await connectDB();

  const result = await pool.request().input("PaymentId", sql.Int, id).query(`
    SELECT * 
    FROM Payments 
    WHERE PaymentId = @PaymentId
  `);

  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();

  const paymentMethod = normalizePaymentMethod(
    data.paymentMethod || data.PaymentMethod || "CASH",
  );

  const status =
    data.status || data.Status || getInitialPaymentStatus(paymentMethod);

  const result = await pool
    .request()
    .input("InvoiceId", sql.Int, data.invoiceId || data.InvoiceId)
    .input("Amount", sql.Decimal(18, 2), data.amount || data.Amount)
    .input("PaymentMethod", sql.NVarChar, paymentMethod)
    .input("Status", sql.NVarChar, status)
    .input(
      "TransactionCode",
      sql.NVarChar,
      data.transactionCode || data.TransactionCode || null,
    ).query(`
      INSERT INTO Payments 
        (InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt)
      OUTPUT INSERTED.*
      VALUES 
        (
          @InvoiceId,
          @Amount,
          @PaymentMethod,
          @Status,
          @TransactionCode,
          CASE WHEN @Status = 'PAID' THEN GETDATE() ELSE NULL END
        )
    `);

  return result.recordset[0];
}

async function update(id, data) {
  const pool = await connectDB();

  await pool
    .request()
    .input("PaymentId", sql.Int, id)
    .input("Status", sql.NVarChar, data.status || data.Status || null).query(`
      UPDATE Payments
      SET 
        Status = COALESCE(@Status, Status),
        PaidAt = CASE 
          WHEN @Status = 'PAID' AND PaidAt IS NULL THEN GETDATE()
          WHEN @Status IN ('PENDING', 'UNPAID', 'FAILED', 'CANCELLED') THEN NULL
          ELSE PaidAt
        END
      WHERE PaymentId = @PaymentId
    `);

  return await getById(id);
}

async function remove(id) {
  const pool = await connectDB();

  await pool.request().input("PaymentId", sql.Int, id).query(`
    DELETE FROM Payments 
    WHERE PaymentId = @PaymentId
  `);

  return { PaymentId: Number(id) };
}

module.exports = {
  getAll,
  getMine,
  payAppointment,
  createVnpayPaymentUrl,
  handleVnpayReturn,
  handleVnpayIpn,
  getById,
  create,
  update,
  remove,
};
