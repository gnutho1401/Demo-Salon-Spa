const { connectDB, sql } = require("../src/config/db");

async function migrate() {
  const pool = await connectDB();
  console.log("Adding StartTime and EndTime columns to AppointmentServices if not exist...");

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AppointmentServices' AND COLUMN_NAME = 'StartTime')
    BEGIN
        ALTER TABLE AppointmentServices ADD StartTime VARCHAR(8) NULL;
    END

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'AppointmentServices' AND COLUMN_NAME = 'EndTime')
    BEGIN
        ALTER TABLE AppointmentServices ADD EndTime VARCHAR(8) NULL;
    END
  `);

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
