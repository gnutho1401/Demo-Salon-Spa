const { connectDB } = require("../src/config/db");

async function check() {
  try {
    const pool = await connectDB();
    const res = await pool.request().query("SELECT * FROM Branches");
    console.log("Branches table records:", res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
