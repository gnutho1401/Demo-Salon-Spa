const { connectDB } = require("../src/config/db");
require("dotenv").config();

async function run() {
  try {
    const db = await connectDB();
    console.log("Checking if AppointmentRescheduleRequests table exists...");
    
    const checkResult = await db.query(`
      SELECT OBJECT_ID(N'dbo.AppointmentRescheduleRequests', N'U') as TableId
    `);
    
    if (checkResult.recordset[0].TableId) {
      console.log("Table AppointmentRescheduleRequests already exists. Skipping creation.");
    } else {
      console.log("Creating AppointmentRescheduleRequests table...");
      await db.query(`
        CREATE TABLE AppointmentRescheduleRequests (
            RequestId INT IDENTITY(1,1) PRIMARY KEY,
            AppointmentId INT NOT NULL,
            RequesterId INT NOT NULL,
            RequestedDate DATE NOT NULL,
            RequestedStartTime TIME NOT NULL,
            RequestedEndTime TIME NOT NULL,
            Reason NVARCHAR(500) NULL,
            Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
            Notes NVARCHAR(500) NULL,
            CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
            UpdatedAt DATETIME NULL,
            CONSTRAINT FK_RescheduleRequests_Appointments FOREIGN KEY (AppointmentId) REFERENCES Appointments(AppointmentId) ON DELETE CASCADE,
            CONSTRAINT FK_RescheduleRequests_Users FOREIGN KEY (RequesterId) REFERENCES Users(UserId)
        );
      `);
      console.log("Table AppointmentRescheduleRequests created successfully!");
    }
    process.exit(0);
  } catch (err) {
    console.error("Failed to run DDL:", err);
    process.exit(1);
  }
}

run();
