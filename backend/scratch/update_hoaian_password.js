const { connectDB } = require("../src/config/db");
const bcrypt = require("bcryptjs");
const sql = require("mssql");

async function run() {
  const pool = await connectDB();
  const password = "123456";
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log("Updating Hoai An's password to 123456...");
  await pool.request()
    .input("UserId", sql.Int, 136)
    .input("PasswordHash", sql.VarChar(255), hashedPassword)
    .query("UPDATE Users SET PasswordHash = @PasswordHash, IsVerified = 1, Status = 'ACTIVE' WHERE UserId = @UserId");

  console.log("Update complete!");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
