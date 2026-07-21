const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT TOP 10 
      aps.AppointmentId, 
      aps.ServiceId, 
      aps.Price AS aps_price, 
      s.Price AS s_price,
      s.ServiceName,
      a.CustomerPackageId,
      cp.PackageId,
      p.PackageName
    FROM AppointmentServices aps
    JOIN Services s ON aps.ServiceId = s.ServiceId
    JOIN Appointments a ON aps.AppointmentId = a.AppointmentId
    LEFT JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
    LEFT JOIN Packages p ON cp.PackageId = p.PackageId
    ORDER BY aps.AppointmentId DESC
  `);

  console.log('=== APPOINTMENT SERVICE PRICES ===');
  result.recordset.forEach(r => {
    console.log(`AppId: ${r.AppointmentId} | SvcId: ${r.ServiceId} | SvcName: "${r.ServiceName}" | AP_Price: ${r.aps_price} | Original_Price: ${r.s_price} | Package: "${r.PackageName || 'None'}"`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
