const { getDashboard } = require('../src/modules/receptionist/receptionist.service');
(async()=>{
  try {
    console.log("Calling getDashboard...");
    const stats = await getDashboard();
    console.log("Success! getDashboard returned stats.");
    console.log("Stats Keys:", Object.keys(stats));
  } catch (err) {
    console.error("FAILED to run getDashboard:", err);
  }
  process.exit(0);
})();
