const { connectDB } = require('../src/config/db');

async function summary() {
  const pool = await connectDB();

  // Services by category
  const svc = await pool.request().query(`
    SELECT c.CategoryName, COUNT(*) as Cnt
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
    GROUP BY c.CategoryName
    ORDER BY c.CategoryName
  `);

  console.log('\n════════════════════════════════════════');
  console.log('  📋 DỊCH VỤ (theo danh mục)');
  console.log('════════════════════════════════════════');
  let totalSvc = 0;
  svc.recordset.forEach(r => {
    console.log(`  📂 ${r.CategoryName}: ${r.Cnt} dịch vụ`);
    totalSvc += r.Cnt;
  });
  console.log(`  ──────────────────────`);
  console.log(`  🏷️  TỔNG: ${totalSvc} dịch vụ`);

  // Technicians (excluding receptionists)
  const techs = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization, e.YearsOfExperience, b.BranchName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    LEFT JOIN Branches b ON e.BranchId = b.BranchId
    WHERE e.Status = 'ACTIVE'
    AND e.Position NOT LIKE '%Receptionist%' AND e.Position NOT LIKE '%tân%'
    ORDER BY e.EmployeeId
  `);

  console.log('\n════════════════════════════════════════');
  console.log('  👩‍🔧 KỸ THUẬT VIÊN');
  console.log('════════════════════════════════════════');
  techs.recordset.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.FullName} — ${e.Position} — ${e.Specialization} — ${e.YearsOfExperience} năm — ${e.BranchName}`);
  });
  console.log(`  ──────────────────────`);
  console.log(`  🏷️  TỔNG: ${techs.recordset.length} kỹ thuật viên`);

  // Receptionists
  const recs = await pool.request().query(`
    SELECT COUNT(*) as cnt FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.Status = 'ACTIVE'
    AND (e.Position LIKE '%Receptionist%' OR e.Position LIKE '%tân%')
  `);
  console.log(`  📌 Lễ tân: ${recs.recordset[0].cnt} người`);

  console.log('\n════════════════════════════════════════');

  process.exit(0);
}

summary().catch(err => { console.error(err); process.exit(1); });
