const { updateReceptionistProfile } = require("../src/modules/receptionist/receptionist.service");

async function test() {
  try {
    console.log("Testing profile update...");
    const updated = await updateReceptionistProfile(7, {
      fullName: "Lễ tân Hoài Thương",
      phone: "0901234502",
      position: "Senior Receptionist",
      bio: "Lễ tân đón tiếp chuyên nghiệp tại quầy chi nhánh 1."
    });
    console.log("Success! Updated profile:", updated.profile);
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err.message);
    process.exit(1);
  }
}

test();
