const sql = require("mssql");
const path = require("path");
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

const treatmentNotesV2Service = require("./src/modules/treatment-notes-v2/treatment-notes-v2.service");

async function main() {
  let pool;
  try {
    console.log("Connecting to database:", dbConfig.database);
    pool = await sql.connect(dbConfig);
    console.log("Connected!");

    // 1. Find a completed or in-progress appointment to test trigger
    const apptResult = await pool.request().query(`
      SELECT TOP 1 a.AppointmentId 
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      ORDER BY a.AppointmentId DESC
    `);

    if (apptResult.recordset.length === 0) {
      console.log("No appointments found in database. Cannot run automation test.");
      return;
    }

    const testApptId = apptResult.recordset[0].AppointmentId;
    console.log(`Using test appointment ID: ${testApptId}`);

    // Clean up any old note first for this appt
    await pool.request()
      .input("AppointmentId", sql.Int, testApptId)
      .query(`DELETE FROM TreatmentNotesV2 WHERE appointment_id = @AppointmentId`);

    // 2. Trigger auto-creation
    console.log("Triggering auto-creation of Treatment Note V2...");
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const noteId = await treatmentNotesV2Service.createNoteOnCompletion(testApptId, transaction);
      await transaction.commit();
      console.log(`Successfully created V2 Note with ID: ${noteId}`);

      // 3. Verify it was created as draft
      const note = await treatmentNotesV2Service.getNoteByAppointment(testApptId);
      if (!note || note.status !== "draft") {
        throw new Error("Validation failed: Note should be in draft status!");
      }
      console.log("Verification passed: Note created successfully in 'draft' status!");

      // 4. Test updating the draft note
      console.log("Testing note updates...");
      const updated = await treatmentNotesV2Service.updateNote(note.id, {
        duration_minutes: 75,
        treatment_summary: "Test summary description from verification script",
        procedure_steps: ["Step 1 from script", "Step 2 from script"],
        products_used: ["Product A", "Product B"]
      });

      if (!updated) {
        throw new Error("Validation failed: Could not update draft note!");
      }
      
      const updatedNote = await treatmentNotesV2Service.getNoteByAppointment(testApptId);
      if (updatedNote.duration_minutes !== 75 || updatedNote.treatment_summary !== "Test summary description from verification script") {
        throw new Error("Validation failed: Updated fields do not match!");
      }
      console.log("Verification passed: Draft note updated successfully!");

      // 5. Test note finalization locking
      console.log("Testing note finalization...");
      const finalized = await treatmentNotesV2Service.finalizeNote(note.id);
      if (!finalized) {
        throw new Error("Validation failed: Could not finalize note!");
      }

      const finalizedNote = await treatmentNotesV2Service.getNoteByAppointment(testApptId);
      if (finalizedNote.status !== "finalized") {
        throw new Error("Validation failed: Status is not finalized!");
      }
      console.log("Verification passed: Note status successfully locked to 'finalized'!");

      // 6. Verify finalized note is write-once (cannot be updated)
      console.log("Verifying finalized note immutability...");
      try {
        await treatmentNotesV2Service.updateNote(note.id, {
          treatment_summary: "This update should fail!"
        });
        throw new Error("Validation failed: Finalized note should not allow updates!");
      } catch (err) {
        console.log("Verification passed: Properly blocked updates on finalized note! Error message:", err.message);
      }

    } catch (err) {
      if (transaction.isOpen) await transaction.rollback();
      throw err;
    }

    console.log("All Treatment Notes V2 backend verification checks PASSED successfully!");
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
