const { connectDB } = require('../src/config/db');

async function updateWorkShiftsTo2000() {
  const pool = await connectDB();
  console.log('🔄 Đang cập nhật lại toàn bộ ca trực trong DB về giờ đóng cửa 20:00 (8h tối)...');

  // Update WorkShifts where EndTime > '20:00:00' or ShiftName contains 22:00
  await pool.request().query(`
    UPDATE WorkShifts
    SET EndTime = '20:00:00',
        ShiftName = REPLACE(ShiftName, '22:00', '20:00')
    WHERE CAST(EndTime AS VARCHAR) > '20:00:00' OR ShiftName LIKE '%22:00%'
  `);

  console.log('✅ Đã cập nhật xong tất cả các ca trực về giờ đóng cửa 20:00!');
  process.exit(0);
}

updateWorkShiftsTo2000().catch(err => {
  console.error(err);
  process.exit(1);
});
