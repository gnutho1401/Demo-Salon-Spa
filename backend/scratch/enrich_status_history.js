const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  
  // Insert CONFIRMED history for 391
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM AppointmentStatusHistory WHERE AppointmentId = 391 AND NewStatus = 'CONFIRMED')
    BEGIN
      INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, Reason, ChangedAt)
      VALUES (391, 'PENDING_PAYMENT', 'CONFIRMED', 'Payment completed via PayOS', '2026-07-12 13:38:05')
    END
  `).then(() => console.log('Enriched history for 391')).catch(err => console.error(err.message));

  // Insert CONFIRMED history for 392
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM AppointmentStatusHistory WHERE AppointmentId = 392 AND NewStatus = 'CONFIRMED')
    BEGIN
      INSERT INTO AppointmentStatusHistory (AppointmentId, OldStatus, NewStatus, Reason, ChangedAt)
      VALUES (392, 'PENDING_PAYMENT', 'CONFIRMED', 'Payment completed via PayOS', '2026-07-12 13:40:00')
    END
  `).then(() => console.log('Enriched history for 392')).catch(err => console.error(err.message));

  process.exit(0);
})();
