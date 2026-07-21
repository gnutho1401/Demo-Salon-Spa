const { connectDB } = require('../src/config/db');

async function checkEmployees() {
  const pool = await connectDB();
  
  // Check all employees
  const result = await pool.request().query(`
    SELECT 
      e.EmployeeId, u.FullName, u.Email, u.Phone, 
      e.Position, e.Specialization, e.YearsOfExperience, e.Status,
      b.BranchName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    ORDER BY b.BranchName, e.EmployeeId
  `);
  
  console.log('\n=== DANH SÁCH KỸ THUẬT VIÊN ===');
  let currentBranch = '';
  let active = 0, inactive = 0;
  result.recordset.forEach((e, i) => {
    if (e.BranchName !== currentBranch) {
      currentBranch = e.BranchName;
      console.log(`\n📍 ${currentBranch || 'Chưa phân chi nhánh'}:`);
    }
    const status = e.Status === 'ACTIVE' ? '✅' : '❌';
    if (e.Status === 'ACTIVE') active++; else inactive++;
    console.log(`  ${status} ID:${e.EmployeeId} | ${e.FullName} | ${e.Position || 'N/A'} | ${e.Specialization || 'N/A'} | ${e.YearsOfExperience || 0} năm KN | ${e.Status}`);
  });

  // Check branches
  const branches = await pool.request().query(`SELECT * FROM Branches ORDER BY BranchId`);
  console.log('\n=== CHI NHÁNH ===');
  branches.recordset.forEach(b => console.log(`  ID:${b.BranchId} | ${b.BranchName} | ${b.Address || 'N/A'} | ${b.Status}`));

  console.log(`\n📊 Tổng: ${result.recordset.length} (Active: ${active}, Inactive: ${inactive})`);
  
  // Check Users with role TECHNICIAN that don't have Employee record
  const orphans = await pool.request().query(`
    SELECT u.UserId, u.FullName, u.Email, u.Role 
    FROM Users u 
    WHERE u.Role IN ('TECHNICIAN', 'EMPLOYEE') 
    AND u.UserId NOT IN (SELECT UserId FROM Employees)
  `);
  if (orphans.recordset.length > 0) {
    console.log('\n⚠️ Users with TECHNICIAN role but no Employee record:');
    orphans.recordset.forEach(u => console.log(`  ${u.UserId} | ${u.FullName} | ${u.Email}`));
  }

  process.exit(0);
}

checkEmployees().catch(err => { console.error(err); process.exit(1); });
