const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    const result = await pool.query(`
      SELECT TOP 5 u.Email, u.FullName, r.RoleName
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      WHERE r.RoleName = 'CUSTOMER'
    `);
    console.log("Customer accounts:");
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
