const { connectDB, sql } = require("../src/config/db");
const bcrypt = require("bcryptjs");

async function resetAllPasswords() {
  const pool = await connectDB();
  console.log("Hashing password '123456'...");
  const hash = await bcrypt.hash("123456", 10);
  console.log("Hashed password:", hash);

  console.log("Updating all users in database...");
  const result = await pool.request()
    .input("PasswordHash", sql.VarChar, hash)
    .query(`
      UPDATE Users
      SET PasswordHash = @PasswordHash
    `);

  console.log("Success! Total users updated:", result.rowsAffected[0]);
  process.exit(0);
}

resetAllPasswords().catch(err => {
  console.error("Failed to reset passwords:", err);
  process.exit(1);
});
