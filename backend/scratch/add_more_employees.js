const { connectDB, sql } = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function addEmployees() {
  const pool = await connectDB();

  const newEmployees = [
    {
      fullName: 'Phương Linh',
      email: 'phuonglinh@lunaspa.com',
      phone: '0905111201',
      position: 'Chuyên viên Makeup',
      specialization: 'Makeup, Bridal',
      years: 4,
      bio: 'Chuyên viên trang điểm chuyên nghiệp với hơn 4 năm kinh nghiệm, từng makeup cho nhiều cô dâu và sự kiện lớn tại Đà Nẵng.'
    },
    {
      fullName: 'Hải Yến',
      email: 'haiyen@lunaspa.com',
      phone: '0905111202',
      position: 'Chuyên viên Triệt lông',
      specialization: 'Triệt lông, Waxing',
      years: 3,
      bio: 'Kỹ thuật viên triệt lông chuyên nghiệp, thành thạo công nghệ OPT và waxing an toàn, tận tâm với từng khách hàng.'
    },
    {
      fullName: 'Đức Minh',
      email: 'ducminh@lunaspa.com',
      phone: '0905111203',
      position: 'Barber / Tạo mẫu tóc nam',
      specialization: 'Hair Styling, Barber',
      years: 5,
      bio: 'Barber chuyên nghiệp phong cách Hàn Quốc và Nhật Bản, thành thạo cắt fade, undercut và các kiểu tóc nam hiện đại.'
    },
    {
      fullName: 'Khánh Ngọc',
      email: 'khanhngoc@lunaspa.com',
      phone: '0905111204',
      position: 'Chuyên viên Detox & Body',
      specialization: 'Detox, Body Care, Slim',
      years: 4,
      bio: 'Chuyên viên chăm sóc body và detox chuyên sâu, am hiểu liệu trình giảm béo khoa học và xông hơi thảo dược truyền thống.'
    },
    {
      fullName: 'Thu Hà',
      email: 'thuha@lunaspa.com',
      phone: '0905111205',
      position: 'Chuyên viên Skincare',
      specialization: 'Skincare, Anti-aging, Collagen',
      years: 6,
      bio: 'Chuyên gia chăm sóc da với chứng chỉ Dermalogica quốc tế, giàu kinh nghiệm trong điều trị nám, tàn nhang và trẻ hóa da.'
    },
    {
      fullName: 'Gia Huy',
      email: 'giahuy@lunaspa.com',
      phone: '0905111206',
      position: 'Kỹ thuật viên Nail',
      specialization: 'Nail Art, Pedicure',
      years: 3,
      bio: 'Nghệ nhân nail art sáng tạo, chuyên thiết kế mẫu nail nghệ thuật đính đá và vẽ tay theo yêu cầu khách hàng.'
    },
  ];

  const passwordHash = await bcrypt.hash('Luna@2026', 10);

  console.log('\n=== THÊM KỸ THUẬT VIÊN MỚI ===');
  let added = 0;

  for (const emp of newEmployees) {
    // Check if email exists
    const exists = await pool.request()
      .input('email', sql.NVarChar, emp.email)
      .query(`SELECT COUNT(*) as cnt FROM Users WHERE Email = @email`);
    
    if (exists.recordset[0].cnt > 0) {
      console.log(`  ⏭️ "${emp.fullName}" (${emp.email}) đã tồn tại, bỏ qua`);
      continue;
    }

    // Create User
    const userResult = await pool.request()
      .input('fullName', sql.NVarChar, emp.fullName)
      .input('email', sql.NVarChar, emp.email)
      .input('phone', sql.NVarChar, emp.phone)
      .input('password', sql.NVarChar, passwordHash)
      .input('roleId', sql.Int, 4) // TECHNICIAN
      .query(`
        INSERT INTO Users (FullName, Email, Phone, PasswordHash, IsVerified, RoleId)
        OUTPUT INSERTED.UserId
        VALUES (@fullName, @email, @phone, @password, 1, @roleId)
      `);
    
    const userId = userResult.recordset[0].UserId;

    // Create Employee record (BranchId = 1)
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('branchId', sql.Int, 1)
      .input('position', sql.NVarChar, emp.position)
      .input('specialization', sql.NVarChar, emp.specialization)
      .input('years', sql.Int, emp.years)
      .input('bio', sql.NVarChar, emp.bio)
      .input('status', sql.NVarChar, 'ACTIVE')
      .query(`
        INSERT INTO Employees (UserId, BranchId, Position, Specialization, YearsOfExperience, Bio, Status)
        VALUES (@userId, @branchId, @position, @specialization, @years, @bio, @status)
      `);

    console.log(`  ✅ ${emp.fullName} — ${emp.position} (${emp.specialization}) — ${emp.years} năm KN`);
    added++;
  }

  // Final summary
  const total = await pool.request().query(`
    SELECT e.EmployeeId, u.FullName, e.Position, e.Specialization, e.YearsOfExperience
    FROM Employees e
    JOIN Users u ON e.UserId = u.UserId
    WHERE e.Status = 'ACTIVE'
    AND e.Position NOT LIKE '%Receptionist%' AND e.Position NOT LIKE '%Lễ tân%'
    ORDER BY e.EmployeeId
  `);

  console.log(`\n=== TỔNG KẾT (đã thêm ${added} người) ===`);
  total.recordset.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.FullName} — ${e.Position} — ${e.Specialization} — ${e.YearsOfExperience} năm`);
  });
  console.log(`\n  🏷️ Tổng kỹ thuật viên ACTIVE: ${total.recordset.length}`);

  process.exit(0);
}

addEmployees().catch(err => { console.error(err); process.exit(1); });
