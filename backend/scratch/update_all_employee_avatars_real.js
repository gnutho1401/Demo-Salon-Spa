const { connectDB, sql } = require('../src/config/db');

const FEMALE_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
];

const MALE_AVATARS = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=300',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=300',
];

async function updateRealAvatars() {
  const pool = await connectDB();
  console.log('🔄 Đang cập nhật ảnh đại diện thật cho tất cả Kỹ thuật viên...');

  const emps = (await pool.request().query(`
    SELECT e.EmployeeId, u.FullName
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
  `)).recordset;

  let fIdx = 0;
  let mIdx = 0;

  for (const emp of emps) {
    const name = emp.FullName || '';
    const isMale = name.includes('Minh') || name.includes('Bảo') || name.includes('Kiệt') || name.includes('Nam') || name.includes('Đức') || name.includes('Huy');
    
    let avatarUrl;
    if (isMale) {
      avatarUrl = MALE_AVATARS[mIdx % MALE_AVATARS.length];
      mIdx++;
    } else {
      avatarUrl = FEMALE_AVATARS[fIdx % FEMALE_AVATARS.length];
      fIdx++;
    }

    await pool.request()
      .input('EmployeeId', sql.Int, emp.EmployeeId)
      .input('ImageUrl', sql.NVarChar, avatarUrl)
      .query('UPDATE Employees SET ImageUrl = @ImageUrl WHERE EmployeeId = @EmployeeId');

    await pool.request()
      .input('FullName', sql.NVarChar, emp.FullName)
      .input('AvatarUrl', sql.NVarChar, avatarUrl)
      .query('UPDATE Users SET AvatarUrl = @AvatarUrl WHERE FullName = @FullName');
  }

  console.log('✅ Đã cập nhật xong ảnh đại diện thật cho tất cả KTV.');
  process.exit(0);
}

updateRealAvatars().catch(console.error);
