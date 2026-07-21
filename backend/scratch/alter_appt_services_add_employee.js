const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  console.log('=== ADDING EmployeeId TO AppointmentServices IF NOT EXISTS ===');

  await pool.request().query(`
    IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('AppointmentServices') 
          AND name = 'EmployeeId'
    )
    BEGIN
        ALTER TABLE AppointmentServices ADD EmployeeId INT NULL;
        ALTER TABLE AppointmentServices ADD CONSTRAINT FK_AppointmentServices_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId);
        PRINT 'Added EmployeeId column to AppointmentServices';
    END
    ELSE
    BEGIN
        PRINT 'EmployeeId column already exists in AppointmentServices';
    END
  `);

  console.log('✅ AppointmentServices schema updated successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed to update schema:', err);
  process.exit(1);
});
