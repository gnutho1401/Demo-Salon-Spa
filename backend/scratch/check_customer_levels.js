const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  const r = await pool.request().query(`
    SELECT c.CustomerId, u.FullName, c.MembershipLevelId, ml.LevelName, c.VIPExpiredAt, c.LoyaltyPoints
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
  `);
  console.log(r.recordset);
  await pool.close();
})();
