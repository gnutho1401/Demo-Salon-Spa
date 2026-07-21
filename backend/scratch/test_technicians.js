const { getTechniciansForService } = require("../src/modules/receptionist/receptionist.service");

async function test() {
  try {
    console.log("Testing getTechniciansForService...");
    const techs = await getTechniciansForService();
    console.log("Success! techs count:", techs.length);
    console.log("techs list sample:", techs.slice(0, 3));
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

test();
