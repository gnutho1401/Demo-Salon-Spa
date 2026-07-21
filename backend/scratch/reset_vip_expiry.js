const sql = require('mssql');
(async () => {
  const pool = await sql.connect({
    user: 'sa', password: 'sa', server: 'localhost',
    database: 'BeautySalonSystem1', port: 1433,
    options: { encrypt: false, trustServerCertificate: true }
  });
  // Reset all active temporary VIPs to expire in exactly 5 minutes from now UTC
  const r = await pool.request().query("UPDATE Customers SET VIPExpiredAt = DATEADD(minute, 5, GETUTCDATE()) WHERE VIPExpiredAt IS NOT NULL");
  console.log("Đã cập nhật reset lại thời gian VIP hết hạn của tất cả các user về đúng 5 phút.");
  await pool.close();
})();
