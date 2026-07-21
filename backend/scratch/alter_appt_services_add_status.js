const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'AppointmentServices' AND COLUMN_NAME = 'Status'
    )
    BEGIN
      ALTER TABLE AppointmentServices ADD Status NVARCHAR(20) DEFAULT 'PENDING';
    END
  `);
  console.log('✅ Added Status column to AppointmentServices successfully!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
