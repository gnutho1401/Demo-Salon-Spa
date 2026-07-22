const { connectDB, sql } = require("../src/config/db");

async function backfillTimes() {
  const pool = await connectDB();
  console.log("Backfilling StartTime and EndTime for existing AppointmentServices...");

  const apptsRes = await pool.request().query(`
    SELECT DISTINCT a.AppointmentId, a.AppointmentDate, CAST(a.StartTime AS VARCHAR(8)) AS StartTime
    FROM Appointments a
    JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    WHERE aps.StartTime IS NULL
  `);

  const pad = (n) => String(n).padStart(2, "0");

  for (const appt of apptsRes.recordset) {
    const svcsRes = await pool.request()
      .input("AppointmentId", sql.Int, appt.AppointmentId)
      .query(`
        SELECT aps.AppointmentServiceId, s.DurationMinutes
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
        ORDER BY aps.AppointmentServiceId ASC
      `);

    const startParts = (appt.StartTime || "09:00:00").split(":").map(Number);
    let curr = new Date();
    curr.setHours(startParts[0] || 9, startParts[1] || 0, 0, 0);

    for (const step of svcsRes.recordset) {
      const dur = Number(step.DurationMinutes) || 30;
      const end = new Date(curr.getTime() + dur * 60 * 1000);

      const startStr = `${pad(curr.getHours())}:${pad(curr.getMinutes())}:00`;
      const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}:00`;

      await pool.request()
        .input("AppointmentServiceId", sql.Int, step.AppointmentServiceId)
        .input("StartTime", sql.VarChar, startStr)
        .input("EndTime", sql.VarChar, endStr)
        .query(`
          UPDATE AppointmentServices
          SET StartTime = @StartTime, EndTime = @EndTime
          WHERE AppointmentServiceId = @AppointmentServiceId
        `);

      curr = end;
    }
  }

  console.log("Backfill completed successfully!");
  process.exit(0);
}

backfillTimes().catch(err => {
  console.error("Backfill error:", err);
  process.exit(1);
});
