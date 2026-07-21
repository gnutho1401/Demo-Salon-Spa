const { connectDB, sql } = require('../src/config/db');

async function updateAvatars127to136() {
  const pool = await connectDB();
  console.log('🔄 Đang cập nhật hình ảnh kỹ thuật viên từ UserId 127 đến 136...');

  const mapping = [
    { userId: 127, img: '/images/technicians/10.png' },
    { userId: 128, img: '/images/technicians/11.png' },
    { userId: 129, img: '/images/technicians/12.png' },
    { userId: 130, img: '/images/technicians/13.png' },
    { userId: 131, img: '/images/technicians/14.png' },
    { userId: 132, img: '/images/technicians/15.png' },
    { userId: 133, img: '/images/technicians/16.png' },
    { userId: 134, img: '/images/technicians/17.png' },
    { userId: 135, img: '/images/technicians/18.png' },
    { userId: 136, img: '/images/technicians/19.png' },
  ];

  for (const item of mapping) {
    // Update Users table
    const userRes = await pool.request()
      .input('UserId', sql.Int, item.userId)
      .input('AvatarUrl', sql.NVarChar, item.img)
      .query('UPDATE Users SET AvatarUrl = @AvatarUrl WHERE UserId = @UserId');

    // Update Employees table matching UserId
    const empRes = await pool.request()
      .input('UserId', sql.Int, item.userId)
      .input('ImageUrl', sql.NVarChar, item.img)
      .query('UPDATE Employees SET ImageUrl = @ImageUrl WHERE UserId = @UserId');

    // Fetch FullName to display
    const info = (await pool.request()
      .input('UserId', sql.Int, item.userId)
      .query('SELECT FullName FROM Users WHERE UserId = @UserId')).recordset[0];

    console.log(`  ✅ UserId ${item.userId} (${info?.FullName || 'N/A'}): ${item.img}`);
  }

  console.log('🎉 Cập nhật thành công cho tất cả UserId từ 127 đến 136!');
  process.exit(0);
}

updateAvatars127to136().catch(err => {
  console.error(err);
  process.exit(1);
});
