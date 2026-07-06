const { connectDB } = require("../src/config/db");
const sql = require("mssql");

async function run() {
  try {
    const pool = await connectDB();
    console.log("Database connected.");
    
    // Check if receptionist 7 already has employee (double check)
    const checkEmp = await pool.request().input("UserId", sql.Int, 7).query(`
      SELECT * FROM Employees WHERE UserId = @UserId
    `);
    
    if (checkEmp.recordset.length === 0) {
      console.log("Inserting employee record for receptionist 7...");
      await pool.request().query(`
        INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
        VALUES (7, 1, 'Receptionist', 'Customer Service', 8500000, '2026-06-16', 2, 'Lễ tân đón tiếp tại quầy chi nhánh 1.', '/images/avatars/receptionist-2.png', 'ACTIVE')
      `);
    }

    // Insert for receptionist 3
    const checkEmp3 = await pool.request().input("UserId", sql.Int, 3).query(`
      SELECT * FROM Employees WHERE UserId = @UserId
    `);
    if (checkEmp3.recordset.length === 0) {
      console.log("Inserting employee record for receptionist 3...");
      await pool.request().query(`
        INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
        VALUES (3, 1, 'Receptionist', 'Customer Service', 8000000, '2026-06-16', 1, 'Lễ tân test.', NULL, 'ACTIVE')
      `);
    }

    // Insert for receptionist 6
    const checkEmp6 = await pool.request().input("UserId", sql.Int, 6).query(`
      SELECT * FROM Employees WHERE UserId = @UserId
    `);
    if (checkEmp6.recordset.length === 0) {
      console.log("Inserting employee record for receptionist 6...");
      await pool.request().query(`
        INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
        VALUES (6, 1, 'Receptionist', 'Customer Service', 8000000, '2026-06-16', 2, 'Lễ tân Mai Anh.', '/images/avatars/receptionist-1.png', 'ACTIVE')
      `);
    }

    // Insert for receptionist 8
    const checkEmp8 = await pool.request().input("UserId", sql.Int, 8).query(`
      SELECT * FROM Employees WHERE UserId = @UserId
    `);
    if (checkEmp8.recordset.length === 0) {
      console.log("Inserting employee record for receptionist 8...");
      await pool.request().query(`
        INSERT INTO Employees (UserId, BranchId, Position, Specialization, Salary, HireDate, YearsOfExperience, Bio, ImageUrl, Status)
        VALUES (8, 2, 'Receptionist', 'Customer Service', 8500000, '2026-06-16', 3, 'Lễ tân Bảo Ngọc.', '/images/avatars/receptionist-3.png', 'ACTIVE')
      `);
    }

    console.log("Successfully inserted employee records for all receptionists.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
