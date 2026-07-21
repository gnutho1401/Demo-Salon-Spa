const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const r = await pool.request().query(`
    SELECT 
      a.AppointmentId, 
      a.Status AS AppointmentStatus,
      i.InvoiceId,
      i.Status AS InvoiceStatus,
      (
        SELECT TOP 1 p.Status 
        FROM Payments p 
        WHERE p.InvoiceId = i.InvoiceId 
        ORDER BY p.PaymentId DESC
      ) AS PaymentStatus,
      (
        SELECT TOP 1 p.PaymentMethod 
        FROM Payments p 
        WHERE p.InvoiceId = i.InvoiceId 
        ORDER BY p.PaymentId DESC
      ) AS PaymentMethod
    FROM Appointments a
    LEFT JOIN Invoices i ON a.AppointmentId = i.AppointmentId
    ORDER BY a.AppointmentId DESC
  `);
  console.log("Appointments List:");
  console.table(r.recordset.slice(0, 15));
  process.exit(0);
})();
