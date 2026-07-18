const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  const r = await pool.request().query(`
    SELECT c.CustomerId, c.UserId, u.FullName, c.MembershipLevelId, c.VIPExpiredAt, c.LoyaltyPoints
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    WHERE u.FullName = 'Kien Duong'
  `);
  console.log("Customer data:", r.recordset);
  
  if (r.recordset.length > 0) {
    const userId = r.recordset[0].UserId;
    const membershipService = require('../src/modules/membership/membership.service');
    const mine = await membershipService.getMine(userId);
    console.log("getMine return value for userId", userId, ":", mine);
  }
  await pool.close();
})();
