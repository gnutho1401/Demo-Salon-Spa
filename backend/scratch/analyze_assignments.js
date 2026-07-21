const { connectDB, sql } = require('../src/config/db');

async function main() {
  const pool = await connectDB();

  // Get all services
  const servicesRes = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, s.CategoryId, c.CategoryName, s.Status
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    ORDER BY s.CategoryId, s.ServiceId
  `);
  console.log(`Total services in DB: ${servicesRes.recordset.length}`);

  // Get all technicians and their specializations
  const techsRes = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.Status = 'ACTIVE'
      AND u.Status = 'ACTIVE'
      AND u.RoleId = (SELECT RoleId FROM Roles WHERE RoleName = 'TECHNICIAN')
  `);
  console.log(`Total active technicians: ${techsRes.recordset.length}`);

  // Get current EmployeeServices count
  const assignmentsRes = await pool.request().query(`
    SELECT es.EmployeeId, u.FullName, COUNT(es.ServiceId) as AssignedServicesCount
    FROM EmployeeServices es
    JOIN Employees e ON es.EmployeeId = e.EmployeeId
    JOIN Users u ON e.UserId = u.UserId
    GROUP BY es.EmployeeId, u.FullName
    ORDER BY AssignedServicesCount DESC
  `);
  console.log('\n=== CURRENT ASSIGNMENT COUNTS PER TECHNICIAN ===');
  assignmentsRes.recordset.forEach(row => {
    console.log(`- ${row.FullName} (ID: ${row.EmployeeId}): ${row.AssignedServicesCount} services`);
  });

  // Services with no assignments
  const unassignedServicesRes = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.ServiceId NOT IN (SELECT ServiceId FROM EmployeeServices)
  `);
  console.log('\n=== UNASSIGNED SERVICES ===');
  if (unassignedServicesRes.recordset.length === 0) {
    console.log('None! All services have at least one technician.');
  } else {
    unassignedServicesRes.recordset.forEach(s => {
      console.log(`- [ID ${s.ServiceId}] ${s.ServiceName} (${s.CategoryName || 'N/A'})`);
    });
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
