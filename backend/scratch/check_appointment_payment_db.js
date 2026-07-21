const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  
  // 1. Get Appointment
  const app = await pool.request().input("id", sql.Int, 391).query(`
    SELECT AppointmentId, Status, CustomerPackageId, TotalAmount = (
      SELECT SUM(Price) FROM AppointmentServices WHERE AppointmentId = @id
    )
    FROM Appointments WHERE AppointmentId = @id
  `);
  console.log("Appointment:", app.recordset[0]);

  // 2. Get Invoices
  const inv = await pool.request().input("id", sql.Int, 391).query(`
    SELECT InvoiceId, AppointmentId, VoucherId, TotalAmount, DiscountAmount, FinalAmount, Status
    FROM Invoices WHERE AppointmentId = @id
  `);
  console.log("Invoice:", inv.recordset[0]);

  if (inv.recordset[0]) {
    const invId = inv.recordset[0].InvoiceId;
    // 3. Get Payments
    const pay = await pool.request().input("invId", sql.Int, invId).query(`
      SELECT PaymentId, InvoiceId, Amount, PaymentMethod, Status, TransactionCode, PaidAt
      FROM Payments WHERE InvoiceId = @invId
    `);
    console.log("Payments:", pay.recordset);
  }

  process.exit(0);
})();
