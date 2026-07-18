const { connectDB, sql } = require('../src/config/db');

async function setLocalAvatars() {
  const pool = await connectDB();
  console.log('🔄 Đang cập nhật lại ảnh đại diện KTV theo thư mục dự án /images/technicians/...');

  const employees = (await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, u.UserId
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    ORDER BY e.EmployeeId ASC
  `)).recordset;

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    // Map employee 1 -> test.png or 1.png, 2 -> 1.png, 3 -> 2.png, etc.
    let imgPath = `/images/technicians/${i === 0 ? 'test.png' : `${i}.png`}`;
    if (i >= 19) {
      imgPath = `/images/technicians/${(i % 19) + 1}.png`;
    }

    await pool.request()
      .input('EmployeeId', sql.Int, emp.EmployeeId)
      .input('ImageUrl', sql.NVarChar, imgPath)
      .query('UPDATE Employees SET ImageUrl = @ImageUrl WHERE EmployeeId = @EmployeeId');

    await pool.request()
      .input('UserId', sql.Int, emp.UserId)
      .input('AvatarUrl', sql.NVarChar, imgPath)
      .query('UPDATE Users SET AvatarUrl = @AvatarUrl WHERE UserId = @UserId');

    console.log(`  - ${emp.FullName} (ID: ${emp.EmployeeId}) -> ${imgPath}`);
  }

  console.log('✅ Đã hoàn tất cập nhật đường dẫn ảnh đại diện local trong thư mục dự án.');
  process.exit(0);
}

setLocalAvatars().catch(console.error);
