const { connectDB } = require("../src/config/db");
const sql = require("mssql");

async function check() {
  try {
    const pool = await connectDB();
    console.log("Database connected.");
    
    // Find future work shifts
    const shiftsRes = await pool.request().query(`
      SELECT TOP 5 * FROM WorkShifts 
      WHERE ShiftDate >= CAST(GETDATE() AS DATE)
      ORDER BY ShiftDate ASC, ShiftId ASC
    `);
    console.log("Future work shifts:", shiftsRes.recordset);
    
    const futureShifts = shiftsRes.recordset;
    if (futureShifts.length > 0) {
      console.log("Registering receptionist 21 (User 7) for future shifts...");
      for (const shift of futureShifts) {
        // Check if already registered
        const checkReg = await pool.request()
          .input("ShiftId", sql.Int, shift.ShiftId)
          .input("TechId", sql.Int, 21)
          .query("SELECT * FROM ShiftRegistrations WHERE ShiftId = @ShiftId AND TechnicianId = @TechId");
          
        if (checkReg.recordset.length === 0) {
          console.log(`Registering for ShiftId ${shift.ShiftId} (${shift.ShiftName} - ${shift.ShiftDate.toISOString().slice(0, 10)})`);
          await pool.request()
            .input("ShiftId", sql.Int, shift.ShiftId)
            .input("TechId", sql.Int, 21)
            .query("INSERT INTO ShiftRegistrations (ShiftId, TechnicianId, Status) VALUES (@ShiftId, @TechId, 'APPROVED')");
        }
      }
    } else {
      // If no future shifts exist in database, let's create a few dummy ones for testing!
      console.log("No future work shifts found. Creating dummy work shifts and registrations for this week...");
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        
        // Insert shift "Ca sáng"
        const insShift = await pool.request()
          .input("ShiftName", sql.NVarChar, i % 2 === 0 ? "Ca sáng" : "Ca chiều")
          .input("ShiftDate", sql.Date, dateStr)
          .input("StartTime", sql.VarChar, i % 2 === 0 ? "08:00:00" : "12:00:00")
          .input("EndTime", sql.VarChar, i % 2 === 0 ? "12:00:00" : "18:00:00")
          .query(`
            INSERT INTO WorkShifts (ShiftName, ShiftDate, StartTime, EndTime, MaxTechnicians, Status)
            OUTPUT INSERTED.ShiftId
            VALUES (@ShiftName, @ShiftDate, CAST(@StartTime AS Time), CAST(@EndTime AS Time), 6, 'OPEN')
          `);
          
        const newShiftId = insShift.recordset[0].ShiftId;
        
        // Register for this shift
        await pool.request()
          .input("ShiftId", sql.Int, newShiftId)
          .input("TechId", sql.Int, 21)
          .query("INSERT INTO ShiftRegistrations (ShiftId, TechnicianId, Status) VALUES (@ShiftId, @TechId, 'APPROVED')");
      }
    }
    
    console.log("Successfully set up ca trực for receptionist 21.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
