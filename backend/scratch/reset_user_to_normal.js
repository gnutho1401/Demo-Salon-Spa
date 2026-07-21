const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  
  // Find customer by email or name
  const findRes = await pool.request()
    .query(`
      SELECT c.CustomerId, u.UserId, u.FullName, u.Email, c.LoyaltyPoints, c.MembershipLevelId, c.VIPExpiredAt
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE u.Email LIKE '%giakienkji1%' OR u.FullName LIKE '%Kien Duong%'
    `);
  console.log("Found customers matching query:", findRes.recordset);

  if (findRes.recordset.length > 0) {
    for (const cust of findRes.recordset) {
      // Update their LoyaltyPoints to 0, MembershipLevelId to 1 (Normal), VIPExpiredAt to null
      await pool.request()
        .input("CustomerId", sql.Int, cust.CustomerId)
        .query(`
          UPDATE Customers 
          SET LoyaltyPoints = 0, MembershipLevelId = 1, VIPExpiredAt = NULL 
          WHERE CustomerId = @CustomerId
        `);
      console.log(`Updated CustomerId: ${cust.CustomerId} (${cust.FullName}) to NORMAL (0 points, LevelId 1, VIPExpiredAt null)`);
    }
  } else {
    console.log("No matching customer found.");
  }
  
  await pool.close();
})();
