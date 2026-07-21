const { connectDB, sql } = require('../src/config/db');

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
];

async function updateEmployeeAvatars() {
  const pool = await connectDB();
  console.log('🖼️ Đang cập nhật avatar cho danh sách kỹ thuật viên...');

  const employees = (await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.ImageUrl, u.AvatarUrl
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
  `)).recordset;

  let count = 0;
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const avatarUrl = DEFAULT_AVATARS[i % DEFAULT_AVATARS.length];

    if (!emp.ImageUrl || emp.ImageUrl === '/images/avatars/default-avatar.png') {
      await pool.request()
        .input('EmployeeId', sql.Int, emp.EmployeeId)
        .input('ImageUrl', sql.NVarChar, avatarUrl)
        .query('UPDATE Employees SET ImageUrl = @ImageUrl WHERE EmployeeId = @EmployeeId');

      await pool.request()
        .input('FullName', sql.NVarChar, emp.FullName)
        .input('AvatarUrl', sql.NVarChar, avatarUrl)
        .query('UPDATE Users SET AvatarUrl = @AvatarUrl WHERE FullName = @FullName');

      count++;
    }
  }

  console.log(`✅ Đã cập nhật ảnh avatar thật cho ${count} kỹ thuật viên.`);
  process.exit(0);
}

updateEmployeeAvatars().catch(err => {
  console.error(err);
  process.exit(1);
});
