const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  const r = await pool.request().query("SELECT TOP 1 * FROM Vouchers");
  console.log("Vouchers columns:", Object.keys(r.recordset[0] || {}));
  await pool.close();
})();
