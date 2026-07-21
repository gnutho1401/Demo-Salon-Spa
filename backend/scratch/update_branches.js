const { connectDB, sql } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    console.log("Connected to Database to update Branches...");

    // Update Branch 1
    await pool.request()
      .input('BranchId', sql.Int, 1)
      .input('BranchName', sql.NVarChar, 'LUNA Beauty Salon - Hải Châu')
      .input('Address', sql.NVarChar, '123 Nguyễn Văn Linh, Hải Châu, Đà Nẵng')
      .query('UPDATE Branches SET BranchName = @BranchName, Address = @Address WHERE BranchId = @BranchId');

    // Update Branch 2
    await pool.request()
      .input('BranchId', sql.Int, 2)
      .input('BranchName', sql.NVarChar, 'LUNA Beauty Salon - Sơn Trà')
      .input('Address', sql.NVarChar, '456 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng')
      .query('UPDATE Branches SET BranchName = @BranchName, Address = @Address WHERE BranchId = @BranchId');

    // Update Branch 3
    await pool.request()
      .input('BranchId', sql.Int, 3)
      .input('BranchName', sql.NVarChar, 'LUNA Beauty Salon - Liên Chiểu')
      .input('Address', sql.NVarChar, '789 Tôn Đức Thắng, Liên Chiểu, Đà Nẵng')
      .query('UPDATE Branches SET BranchName = @BranchName, Address = @Address WHERE BranchId = @BranchId');

    console.log("Database branches updated successfully!");
  } catch (err) {
    console.error("Failed to update branches:", err);
  } finally {
    process.exit(0);
  }
})();
