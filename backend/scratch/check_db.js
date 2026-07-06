const { connectDB } = require("../src/config/db");
const availabilityService = require("../src/modules/appointments/availability.service");

async function check() {
  try {
    const pool = await connectDB();
    console.log("Database connected.");
    
    // Find the appointment by notes containing '#233'
    const apptRes = await pool.request().query(`
      SELECT AppointmentId, CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime, Status, Notes
      FROM Appointments 
      WHERE Notes LIKE '%233%'
    `);
    console.log("Found Appointments matching notes:", apptRes.recordset);
    
    if (apptRes.recordset.length === 0) {
      console.log("No appointments matching notes '%233%' found.");
      process.exit(0);
    }
    
    const appt = apptRes.recordset[0];
    
    // Get serviceId for this appointment
    const srvRes = await pool.request().query(`
      SELECT ServiceId FROM AppointmentServices WHERE AppointmentId = ${appt.AppointmentId}
    `);
    const serviceId = srvRes.recordset[0]?.ServiceId;
    console.log(`ServiceId: ${serviceId}`);

    // Check capability for EmployeeId 2 (Linh Chi) and this service
    const capability = await pool.request().query(`
      SELECT * FROM EmployeeServices WHERE EmployeeId = ${appt.EmployeeId} AND ServiceId = ${serviceId}
    `);
    console.log("Employee Capability:", capability.recordset);

    // Get shifts for EmployeeId 2 (Linh Chi) on 2026-07-08
    const date = "2026-07-08";
    const shifts = await pool.request().query(`
      SELECT sr.RegistrationId, sr.TechnicianId, sr.ShiftId, sr.Status, ws.ShiftDate, ws.StartTime, ws.EndTime
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = ${appt.EmployeeId} AND ws.ShiftDate = '${date}'
    `);
    console.log("Shifts for Employee on 2026-07-08:", shifts.recordset);

    // Call slots calculation
    try {
      const slots = await availabilityService.getAvailableSlots({
        employeeId: appt.EmployeeId,
        serviceId: serviceId,
        appointmentDate: date,
        excludeAppointmentId: appt.AppointmentId,
        includeAllSlots: true
      });
      console.log("Slots result:", slots);
    } catch (err) {
      console.error("Slots generation failed with error:", err.message);
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
