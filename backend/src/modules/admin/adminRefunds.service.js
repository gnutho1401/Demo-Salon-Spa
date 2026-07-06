const { sql, connectDB } = require("../../config/db");
const { getPayOSPayout } = require("../../config/payos.config");

async function getAllRefunds(query) {
  const pool = await connectDB();
  
  const status = query.status || "";
  const keyword = query.keyword || "";

  const result = await pool.request()
    .input("Status", sql.NVarChar, status || null)
    .input("Keyword", sql.NVarChar, `%${keyword}%`)
    .query(`
      SELECT 
        r.RefundId,
        r.PaymentId,
        r.RefundAmount,
        r.Reason AS RefundReason,
        r.Status AS RefundStatus,
        r.CreatedAt,
        r.RefundedAt,
        r.BankCode,
        r.AccountNumber,
        r.AccountName,
        r.PayosPayoutId,
        p.Amount AS PaymentAmount,
        p.PaymentMethod,
        p.TransactionCode,
        i.InvoiceId,
        i.AppointmentId,
        c.FullName AS CustomerName,
        c.Phone AS CustomerPhone
      FROM Refunds r
      JOIN Payments p ON r.PaymentId = p.PaymentId
      JOIN Invoices i ON p.InvoiceId = i.InvoiceId
      JOIN Appointments a ON i.AppointmentId = a.AppointmentId
      JOIN Customers cust ON a.CustomerId = cust.CustomerId
      JOIN Users c ON cust.UserId = c.UserId
      WHERE (@Status IS NULL OR r.Status = @Status)
        AND (@Keyword IS NULL OR c.FullName LIKE @Keyword OR c.Phone LIKE @Keyword OR p.TransactionCode LIKE @Keyword)
      ORDER BY 
        CASE WHEN r.Status = 'PENDING' THEN 1 ELSE 2 END,
        r.CreatedAt DESC
    `);

  return result.recordset;
}

async function processRefund(refundId, adminId, manual = false) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const refundQuery = await new sql.Request(transaction)
      .input("RefundId", sql.Int, refundId)
      .query(`
        SELECT r.RefundId, r.PaymentId, r.Status, r.RefundAmount, r.BankCode, r.AccountNumber, r.AccountName, 
               p.InvoiceId, p.PaymentMethod, i.AppointmentId, a.AppointmentDate
        FROM Refunds r
        JOIN Payments p ON r.PaymentId = p.PaymentId
        JOIN Invoices i ON p.InvoiceId = i.InvoiceId
        JOIN Appointments a ON i.AppointmentId = a.AppointmentId
        WHERE r.RefundId = @RefundId
      `);

    const refund = refundQuery.recordset[0];

    if (!refund) {
      throw new Error("Không tìm thấy yêu cầu hoàn tiền");
    }

    if (refund.Status !== 'PENDING') {
      throw new Error("Yêu cầu này đã được xử lý");
    }

    // Call payOS Payout API if payment method is PAYOS and NOT manual
    if (String(refund.PaymentMethod).toUpperCase() === 'PAYOS' && !manual) {
      if (!refund.BankCode || !refund.AccountNumber) {
        throw new Error("Không thể hoàn tiền tự động: Yêu cầu thiếu thông tin tài khoản ngân hàng của khách");
      }
      
      const payos = getPayOSPayout();
      try {
        const payoutResult = await payos.payouts.create({
          amount: Number(refund.RefundAmount),
          description: `Hoan tien AP${String(refund.AppointmentId).padStart(5, '0')}`,
          toBin: refund.BankCode,
          toAccountNumber: refund.AccountNumber,
          referenceId: `REF_${refund.RefundId}_${Date.now()}`
        });

        // 1. Cập nhật bảng Refunds kèm PayosPayoutId
        await new sql.Request(transaction)
          .input("RefundId", sql.Int, refundId)
          .input("PayosPayoutId", sql.NVarChar, payoutResult.id || payoutResult.referenceId || null)
          .query(`
            UPDATE Refunds
            SET Status = 'COMPLETED', RefundedAt = GETDATE(), PayosPayoutId = @PayosPayoutId
            WHERE RefundId = @RefundId
          `);
      } catch (payosError) {
        console.error("PayOS Payout error:", payosError);
        throw new Error(`Lỗi từ cổng thanh toán PayOS: ${payosError.message || payosError}`);
      }
    } else {
      // 1. Cập nhật bảng Refunds (cho các phương thức khác thì duyệt thủ công bình thường)
      await new sql.Request(transaction)
        .input("RefundId", sql.Int, refundId)
        .query(`
          UPDATE Refunds
          SET Status = 'COMPLETED', RefundedAt = GETDATE()
          WHERE RefundId = @RefundId
        `);
    }

    // 2. Cập nhật bảng Payments
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, refund.PaymentId)
      .query(`
        UPDATE Payments
        SET Status = 'REFUNDED'
        WHERE PaymentId = @PaymentId
      `);

    // 3. Cập nhật bảng Invoices
    await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, refund.InvoiceId)
      .query(`
        UPDATE Invoices
        SET Status = 'REFUNDED'
        WHERE InvoiceId = @InvoiceId
      `);

    // 4. Cập nhật bảng Appointments
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, refund.AppointmentId)
      .query(`
        UPDATE Appointments
        SET Status = 'CANCELLED', UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await transaction.commit();

    if (refund.AppointmentDate) {
      try {
        const { runAutoMatch } = require("../waiting-list/waiting-list.service");
        const dateStr = refund.AppointmentDate instanceof Date
          ? refund.AppointmentDate.toISOString().slice(0, 10)
          : String(refund.AppointmentDate).slice(0, 10);
        runAutoMatch(dateStr).catch(err => console.error("Auto match failed after admin refund complete:", err.message));
      } catch (err) {
        console.error("Auto match trigger failed after admin refund complete:", err.message);
      }
    }

    return { success: true, message: "Đã xác nhận hoàn tiền thành công" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function rejectRefund(refundId, reason, adminId) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const refundQuery = await new sql.Request(transaction)
      .input("RefundId", sql.Int, refundId)
      .query(`
        SELECT r.RefundId, r.PaymentId, r.Status, p.InvoiceId, i.AppointmentId
        FROM Refunds r
        JOIN Payments p ON r.PaymentId = p.PaymentId
        JOIN Invoices i ON p.InvoiceId = i.InvoiceId
        WHERE r.RefundId = @RefundId
      `);

    const refund = refundQuery.recordset[0];

    if (!refund) {
      throw new Error("Không tìm thấy yêu cầu hoàn tiền");
    }

    if (refund.Status !== 'PENDING') {
      throw new Error("Yêu cầu này đã được xử lý");
    }

    // 1. Cập nhật bảng Refunds
    await new sql.Request(transaction)
      .input("RefundId", sql.Int, refundId)
      .input("Reason", sql.NVarChar, reason || 'Từ chối hoàn tiền')
      .query(`
        UPDATE Refunds
        SET Status = 'REJECTED', Reason = @Reason, RefundedAt = GETDATE()
        WHERE RefundId = @RefundId
      `);

    // 2. Cập nhật bảng Payments
    await new sql.Request(transaction)
      .input("PaymentId", sql.Int, refund.PaymentId)
      .query(`
        UPDATE Payments
        SET Status = 'PAID'
        WHERE PaymentId = @PaymentId
      `);

    // 3. Cập nhật bảng Invoices
    await new sql.Request(transaction)
      .input("InvoiceId", sql.Int, refund.InvoiceId)
      .query(`
        UPDATE Invoices
        SET Status = 'PAID'
        WHERE InvoiceId = @InvoiceId
      `);

    // 4. Cập nhật bảng Appointments
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, refund.AppointmentId)
      .query(`
        UPDATE Appointments
        SET Status = 'CONFIRMED', CancelReason = NULL, UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await transaction.commit();
    return { success: true, message: "Đã từ chối hoàn tiền" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  getAllRefunds,
  processRefund,
  rejectRefund
};
