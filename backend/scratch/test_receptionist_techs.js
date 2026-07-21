const { getTechniciansForService } = require('../src/modules/receptionist/receptionist.service');
(async()=>{
  try {
    console.log("Calling getTechniciansForService(undefined)...");
    const techs = await getTechniciansForService(undefined);
    console.log("Success! Returned technicians count:", techs.length);
  } catch (err) {
    console.error("FAILED:", err);
  }
  process.exit(0);
})();
