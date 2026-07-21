const { connectDB, sql } = require('../src/config/db');

async function main() {
  const pool = await connectDB();

  // 1. Get all active technicians
  const techs = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.Status = 'ACTIVE'
      AND u.Status = 'ACTIVE'
      AND u.RoleId = (SELECT RoleId FROM Roles WHERE RoleName = 'TECHNICIAN')
    ORDER BY e.EmployeeId
  `);

  console.log('=== ACTIVE TECHNICIANS ===');
  techs.recordset.forEach(t => {
    console.log(`ID: ${t.EmployeeId} | Name: ${t.FullName} | Position: ${t.Position} | Spec: ${t.Specialization}`);
  });

  // 2. Get all services
  const services = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    ORDER BY c.CategoryName, s.ServiceId
  `);

  console.log('\n=== SERVICES BY CATEGORY ===');
  const grouped = {};
  services.recordset.forEach(s => {
    const cat = s.CategoryName || 'Uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ id: s.ServiceId, name: s.ServiceName });
  });

  for (const cat in grouped) {
    console.log(`\nCategory: [${cat}]`);
    grouped[cat].forEach(s => {
      console.log(`  - ID: ${s.id} | ${s.name}`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
