const { connectDB } = require("../src/config/db");
const availabilityService = require("../src/modules/appointments/availability.service");

async function run() {
  try {
    const db = await connectDB();
    console.log("Database connected.");
    
    // Find the last active appointment for technician Linh Nguyen
    const apptRes = await db.query(`
      SELECT TOP 1 AppointmentId, EmployeeId 
      FROM Appointments 
      WHERE EmployeeId = 1 AND Status IN ('PENDING', 'CONFIRMED', 'PAID')
      ORDER BY AppointmentId DESC
    `);
    const appt = apptRes.recordset[0];
    if (!appt) {
      console.log("No active appointments found for employee 1.");
      process.exit(0);
    }
    
    // Get serviceId for this appointment
    const srvRes = await db.query(`
      SELECT ServiceId FROM AppointmentServices WHERE AppointmentId = ${appt.AppointmentId}
    `);
    const serviceId = srvRes.recordset[0]?.ServiceId;
    
    console.log(`Appointment: #${appt.AppointmentId}, EmployeeId: ${appt.EmployeeId}, ServiceId: ${serviceId}`);
    
    const date = "2026-07-06";
    console.log(`Testing slot calculation for date: ${date}`);
    
    const slots = await availabilityService.getAvailableSlots({
      employeeId: appt.EmployeeId,
      serviceId: serviceId,
      appointmentDate: date,
      excludeAppointmentId: appt.AppointmentId,
      includeAllSlots: true
    });
    
    console.log("Result:", slots);
    process.exit(0);
  } catch (err) {
    console.error("ERROR DETECTED:", err);
    process.exit(1);
  }
}

run();
