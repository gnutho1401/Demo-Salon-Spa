const sql = require("mssql");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "sa",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "BeautySalonSystem1",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
  }
};

const eventBusService = require("./src/modules/event-bus/eventBus.service");
const treatmentNotesV2Service = require("./src/modules/treatment-notes-v2/treatment-notes-v2.service");

// Require route file once to initialize the event listener
require("./src/modules/treatment-notes-v2/treatment-notes-v2.routes");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  let pool;
  try {
    console.log("Connecting to SQL Server database...");
    pool = await sql.connect(dbConfig);
    console.log("Connected!");

    // 1. Find a test appointment ID to mock
    const apptRes = await pool.request().query(`
      SELECT TOP 1 a.AppointmentId 
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      ORDER BY a.AppointmentId DESC
    `);

    if (apptRes.recordset.length === 0) {
      console.error("No test appointments found in database. Please run seed script first.");
      process.exit(1);
    }

    const testApptId = apptRes.recordset[0].AppointmentId;
    console.log(`Found test appointment ID: ${testApptId}`);

    // Clean up any old notes for this appointment to avoid primary key constraints
    await pool.request()
      .input("AppointmentId", sql.Int, testApptId)
      .query("DELETE FROM TreatmentNotesV2 WHERE appointment_id = @AppointmentId");

    // 2. Publish APPOINTMENT_COMPLETED event to the bus
    console.log("Publishing APPOINTMENT_COMPLETED event on the Event Bus...");
    eventBusService.publish("APPOINTMENT_COMPLETED", {
      appointmentId: testApptId,
      userId: 1
    });

    // 3. Wait for event listener to process asynchronously
    console.log("Waiting 2000ms for asynchronous note insertion...");
    await sleep(2000);

    // 4. Query database to verify the note was automatically created as draft
    const note = await treatmentNotesV2Service.getNoteByAppointment(testApptId, true);
    if (!note) {
      throw new Error("Event Trigger Failure: No treatment note was created by the listener!");
    }

    if (note.status !== "draft") {
      throw new Error(`Expected note status to be 'draft', but got '${note.status}'`);
    }
    console.log(`Success: Decoupled event listener created draft Treatment Note UUID: ${note.id}`);

    // 5. Update draft fields
    console.log("Updating draft treatment note fields...");
    const updated = await treatmentNotesV2Service.updateNote(note.id, {
      duration_minutes: 90,
      before_condition: "Móng yếu, dễ tách lớp",
      after_result: "Khỏe và bóng mượt",
      procedure_steps: ["Vệ sinh sạch", "Sơn gel", "Top coat"],
      products_used: ["Gel OPI", "Base CND"],
      technician_notes: "Khách thích nhẹ nhàng.",
      recommendations: "Dưỡng móng 2 lần/ngày",
      internal_notes: "Bảo mật: Khách VIP được giảm giá đặc biệt."
    }, true);

    if (!updated) {
      throw new Error("Update Failure: Draft note was not updated.");
    }
    console.log("Success: Draft note updated successfully.");

    // Verify updated values
    const noteAfterUpdate = await treatmentNotesV2Service.getNoteByAppointment(testApptId, true);
    if (noteAfterUpdate.duration_minutes !== 90 || noteAfterUpdate.internal_notes !== "Bảo mật: Khách VIP được giảm giá đặc biệt.") {
      throw new Error("Validation Failure: Field values mismatch after update!");
    }
    console.log("Success: Note fields matched updated parameters.");

    // 6. Lock and finalize
    console.log("Finalizing treatment note to lock editing...");
    const finalized = await treatmentNotesV2Service.finalizeNote(note.id);
    if (!finalized) {
      throw new Error("Finalize Failure: Note was not locked.");
    }
    console.log("Success: Note status finalized.");

    // 7. Verify finalized note cannot be edited
    console.log("Asserting finalized note is immutable...");
    try {
      await treatmentNotesV2Service.updateNote(note.id, {
        before_condition: "Attempting to change finalized note condition"
      }, true);
      throw new Error("Validation Failure: Saved update on finalized note successfully (should have blocked it)!");
    } catch (err) {
      console.log(`Success: System correctly blocked edits on locked note with message: "${err.message}"`);
    }

    console.log("\n=======================================================");
    console.log("🎉 ALL EVENT-DRIVEN DECOUPLED LIFECYCLE TESTS PASSED!");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
