const { connectDB, sql } = require('../src/config/db');

async function resetVouchers() {
  const pool = await connectDB();

  console.log('🔍 Đang tìm kiếm tài khoản kienduonggiakji7...');

  // Find user / customer by email or full name
  const userRes = await pool.request()
    .input('term', sql.NVarChar, '%kienduonggiakji7%')
    .query(`
      SELECT u.UserId, u.Email, u.FullName, c.CustomerId
      FROM Users u
      LEFT JOIN Customers c ON u.UserId = c.UserId
      WHERE u.Email LIKE @term OR u.FullName LIKE @term
    `);

  console.log('Kết quả tìm kiếm user:', userRes.recordset);

  if (userRes.recordset.length === 0) {
    // If exact search yields nothing, list users to see
    const allUsers = await pool.request().query(`
      SELECT u.UserId, u.Email, u.FullName, c.CustomerId
      FROM Users u
      LEFT JOIN Customers c ON u.UserId = c.UserId
    `);
    console.log('Tất cả users trong hệ thống:', allUsers.recordset);
    process.exit(1);
  }

  const customerId = userRes.recordset[0].CustomerId;
  if (!customerId) {
    console.log('❌ User chưa có bản ghi trong bảng Customers');
    process.exit(1);
  }

  console.log(`📌 Customer ID: ${customerId}`);

  // Inspect customer vouchers before reset
  const cvBefore = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .query(`
      SELECT cv.*, v.Code, v.DiscountValue
      FROM CustomerVouchers cv
      JOIN Vouchers v ON cv.VoucherId = v.VoucherId
      WHERE cv.CustomerId = @CustomerId
    `);

  console.log('📋 Danh sách vouchers hiện tại:', cvBefore.recordset);

  // Update UsedStatus = 0 for all vouchers of this customer
  const updateRes = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .query(`
      UPDATE CustomerVouchers
      SET UsedStatus = 0
      WHERE CustomerId = @CustomerId
    `);

  console.log(`✅ Đã reset UsedStatus = 0 cho tất cả ${updateRes.rowsAffected[0]} vouchers của khách hàng.`);

  process.exit(0);
}

resetVouchers().catch(err => {
  console.error('Lỗi khi reset voucher:', err);
  process.exit(1);
});
