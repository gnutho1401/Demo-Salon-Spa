const {connectDB, sql} = require('../src/config/db');
(async()=>{
  const pool = await connectDB();
  const r = await pool.request().query(`
    SELECT TOP 5 h.HistoryId, h.AppointmentId, h.OldStatus, h.NewStatus, 
           h.Reason, h.ChangedAt, h.ChangedBy
    FROM AppointmentStatusHistory h 
    ORDER BY h.HistoryId DESC
  `);
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
})();
