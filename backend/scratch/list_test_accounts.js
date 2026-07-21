const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  
  // Customers
  const custs = await pool.request().query(`
    SELECT TOP 3 u.UserId, u.FullName, u.Email, u.Phone, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE r.RoleName = 'CUSTOMER' AND u.Status = 'ACTIVE'
  `);

  // Receptionists
  const recep = await pool.request().query(`
    SELECT TOP 3 u.UserId, u.FullName, u.Email, u.Phone, r.RoleName
    FROM Users u
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE r.RoleName IN ('RECEPTIONIST', 'STAFF') AND u.Status = 'ACTIVE'
  `);

  // Technicians
  const techs = await pool.request().query(`
    SELECT TOP 3 u.UserId, e.EmployeeId, u.FullName, u.Email, u.Phone, r.RoleName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    JOIN Roles r ON u.RoleId = r.RoleId
    WHERE r.RoleName IN ('TECHNICIAN', 'STYLIST') AND e.Status = 'ACTIVE'
  `);

  console.log('=== TEST ACCOUNTS ===');
  console.log('\n🌸 CUSTOMERS:');
  console.table(custs.recordset);

  console.log('\n💼 RECEPTIONISTS:');
  console.table(recep.recordset);

  console.log('\n✂️ TECHNICIANS:');
  console.table(techs.recordset);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
