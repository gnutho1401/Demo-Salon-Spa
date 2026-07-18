const { connectDB, sql } = require('../src/config/db');

// Defined mapping based on primary specialization and workload balance
const categoryTechMapping = {
  'Hair': [1, 4, 5, 9, 27],                 // Linh Nguyen, Thảo Vy, Quốc Bảo, Hoàng Nam, Đức Minh
  'Skincare': [1, 5, 6, 10, 29, 25],         // Linh Nguyen, Quốc Bảo, Ngọc Hân, Thanh Tâm, Thu Hà, Phương Linh
  'Massage': [1, 2, 7, 28, 33, 34],          // Linh Nguyen, Linh Chi, Tuấn Kiệt, Khánh Ngọc, Bích Ngọc, Hoài An
  'Detox': [2, 7, 28, 33, 34, 26],           // Linh Chi, Tuấn Kiệt, Khánh Ngọc, Bích Ngọc, Hoài An, Hải Yến
  'Nail': [3, 8, 30],                        // Minh Anh, Bảo Trâm, Gia Huy
  'Nối mi & Uốn mi': [32, 3, 8, 30],         // Thanh Trúc, Minh Anh, Bảo Trâm, Gia Huy
  'Phun xăm thẩm mỹ': [31, 6, 10, 29],       // Ngọc Diệp, Ngọc Hân, Thanh Tâm, Thu Hà
  'Triệt lông': [26, 7, 28, 34],             // Hải Yến, Tuấn Kiệt, Khánh Ngọc, Hoài An
  'Makeup': [25, 1, 4, 31, 32]               // Phương Linh, Linh Nguyen, Thảo Vy, Ngọc Diệp, Thanh Trúc
};

async function main() {
  const pool = await connectDB();

  // 1. Get all active services
  const servicesRes = await pool.request().query(`
    SELECT s.ServiceId, s.ServiceName, c.CategoryName
    FROM Services s
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.Status = 'AVAILABLE'
  `);
  const services = servicesRes.recordset;
  console.log(`Found ${services.length} active services in database.`);

  // 2. Start a transaction
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Clear old assignments
    console.log('Clearing old EmployeeServices assignments...');
    await new sql.Request(transaction).query(`DELETE FROM EmployeeServices`);

    let totalInserted = 0;

    for (const service of services) {
      const categoryName = service.CategoryName;
      const techIds = categoryTechMapping[categoryName];

      if (!techIds || techIds.length === 0) {
        console.warn(`⚠️ Warning: No technician mapping found for category [${categoryName}] of service "${service.ServiceName}" (ID ${service.ServiceId})`);
        continue;
      }

      for (const employeeId of techIds) {
        // Double check if employee exists and is active/technician
        const check = await new sql.Request(transaction)
          .input("EmployeeId", sql.Int, employeeId)
          .query(`
            SELECT 1
            FROM Employees e
            JOIN Users u ON e.UserId = u.UserId
            WHERE e.EmployeeId = @EmployeeId
              AND u.Status = 'ACTIVE'
              AND e.Status = 'ACTIVE'
              AND u.RoleId = (SELECT RoleId FROM Roles WHERE RoleName = 'TECHNICIAN')
          `);

        if (!check.recordset[0]) {
          throw new Error(`Employee ID ${employeeId} is not a valid active technician in the database.`);
        }

        // Insert assignment
        await new sql.Request(transaction)
          .input("EmployeeId", sql.Int, employeeId)
          .input("ServiceId", sql.Int, service.ServiceId)
          .query(`
            INSERT INTO EmployeeServices (EmployeeId, ServiceId)
            VALUES (@EmployeeId, @ServiceId)
          `);
        
        totalInserted++;
      }
    }

    await transaction.commit();
    console.log(`✅ Success! Inserted ${totalInserted} technician-to-service assignments successfully.`);
  } catch (err) {
    console.error('❌ Transaction failed, rolling back:', err);
    try {
      await transaction.rollback();
    } catch (_) {}
    process.exit(1);
  }

  // 3. Print the new assignment counts to verify balance
  const statsRes = await pool.request().query(`
    SELECT es.EmployeeId, u.FullName, COUNT(es.ServiceId) as AssignedServicesCount
    FROM EmployeeServices es
    JOIN Employees e ON es.EmployeeId = e.EmployeeId
    JOIN Users u ON e.UserId = u.UserId
    GROUP BY es.EmployeeId, u.FullName
    ORDER BY AssignedServicesCount DESC
  `);
  console.log('\n=== NEW ASSIGNMENT COUNTS PER TECHNICIAN ===');
  statsRes.recordset.forEach(row => {
    console.log(`- ${row.FullName} (ID: ${row.EmployeeId}): ${row.AssignedServicesCount} services`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
