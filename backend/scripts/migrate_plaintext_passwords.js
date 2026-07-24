require("dotenv").config();

const bcrypt = require("bcryptjs");
const { connectDB, sql } = require("../src/config/db");

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT UserId, PasswordHash
    FROM Users
    WHERE PasswordHash IS NOT NULL
  `);

  const legacyUsers = result.recordset.filter(
    (user) => !BCRYPT_PATTERN.test(String(user.PasswordHash || ""))
  );

  for (const user of legacyUsers) {
    const passwordHash = await bcrypt.hash(String(user.PasswordHash), 12);
    await pool
      .request()
      .input("UserId", sql.Int, user.UserId)
      .input("PasswordHash", sql.NVarChar, passwordHash)
      .query(`
        UPDATE Users
        SET PasswordHash = @PasswordHash,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);
  }

  console.log(`Migrated ${legacyUsers.length} legacy password(s) to bcrypt.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Password migration failed:", error.message);
  process.exit(1);
});
