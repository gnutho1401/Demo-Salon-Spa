const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  const r = await pool.request().query("SELECT CustomerId, VIPExpiredAt, GETUTCDATE() as UTCDatetime, GETDATE() as LocalDatetime FROM Customers WHERE VIPExpiredAt IS NOT NULL");
  console.log(r.recordset);
  await pool.close();
})();
