const { getAvailableSlots } = require("../src/modules/appointments/availability.service");

async function testUnrestrictedSlots() {
  // Test slots for Technician ID 1, Service ID 7 (Cắt tóc), Date 2026-07-25
  const slots = await getAvailableSlots({
    employeeId: 1,
    serviceId: 7,
    appointmentDate: "2026-07-25"
  });

  console.log("Calculated available slots count:", Array.isArray(slots) ? slots.length : slots.slots?.length);
  console.log("Sample slots:", Array.isArray(slots) ? slots.slice(0, 5) : slots.slots?.slice(0, 5));

  process.exit(0);
}

testUnrestrictedSlots().catch(err => {
  console.error("Slot test error:", err);
  process.exit(1);
});
