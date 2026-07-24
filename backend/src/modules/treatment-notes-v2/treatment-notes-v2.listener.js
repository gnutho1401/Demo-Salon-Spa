const eventBusService = require("../event-bus/eventBus.service");
const treatmentNotesV2Service = require("./treatment-notes-v2.service");

// Subscribe to APPOINTMENT_COMPLETED event
eventBusService.subscribe("APPOINTMENT_COMPLETED", async (data) => {
  console.log(
    `[TreatmentNoteListener] Handling APPOINTMENT_COMPLETED event for appointment #${data.appointmentId}`,
  );
  try {
    // We run the auto-creation in its own transaction (managed within createNoteOnCompletion)
    const noteId = await treatmentNotesV2Service.createNoteOnCompletion(
      data.appointmentId,
    );
    console.log(
      `[TreatmentNoteListener] Auto-created TreatmentNote V2: ${noteId}`,
    );
  } catch (err) {
    console.error(
      `[TreatmentNoteListener] Error auto-creating treatment note:`,
      err.message,
    );
  }
});

console.log(
  "[TreatmentNoteListener] Decoupled listener successfully initialized.",
);
