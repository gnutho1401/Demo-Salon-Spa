const { connectDB } = require("../src/config/db");
const sql = require("mssql");

async function test() {
  try {
    const pool = await connectDB();
    console.log("Database connected.");
    
    const result = await pool.request().query(`
      SELECT u.UserId, u.Email, u.FullName, r.RoleName, u.PasswordHash, u.Status
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      WHERE r.RoleName IN ('Receptionist', 'Admin', 'Manager')
    `);
    console.log("Users found:", result.recordset);
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
}

test();
