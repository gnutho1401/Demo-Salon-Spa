const { sql, connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  
  // Get all employees who have NULL or empty ImageUrl
  const result = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.ImageUrl IS NULL OR e.ImageUrl = '' OR e.ImageUrl = 'NULL'
  `);

  console.log(`Found ${result.recordset.length} employees without images.`);

  let imageIndex = 1;
  for (const emp of result.recordset) {
    // Cyclic technician image paths (1.png to 9.png)
    const imagePath = `/images/technicians/${imageIndex}.png`;
    console.log(`Updating ${emp.FullName} (ID: ${emp.EmployeeId}) with image: ${imagePath}`);
    
    await pool.request()
      .input("EmployeeId", sql.Int, emp.EmployeeId)
      .input("ImageUrl", sql.NVarChar, imagePath)
      .query(`
        UPDATE Employees
        SET ImageUrl = @ImageUrl
        WHERE EmployeeId = @EmployeeId
      `);
      
    imageIndex = (imageIndex % 9) + 1;
  }

  console.log('Employee images updated successfully!');

  // Verify updates
  const verifyResult = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.ImageUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    ORDER BY e.EmployeeId ASC
  `);

  console.log('\n=== UPDATED EMPLOYEE LIST ===');
  verifyResult.recordset.forEach(r => {
    console.log(`ID: ${r.EmployeeId} | Name: "${r.FullName}" | ImageUrl: "${r.ImageUrl}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
