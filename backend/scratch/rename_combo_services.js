const { connectDB, sql } = require('../src/config/db');

async function renameComboServices() {
  const pool = await connectDB();

  // Rename "Combo tóc và nail" -> "Gội đầu dưỡng sinh thảo mộc"
  await pool.request()
    .input('ServiceId1', sql.Int, 17)
    .input('Name1', sql.NVarChar, 'Gội đầu dưỡng sinh thảo mộc')
    .input('Desc1', sql.NVarChar, 'Liệu trình gội đầu kết hợp dầu thảo mộc thiên nhiên, massage bấm huyệt đầu cổ vai giúp thư giãn sâu, kích thích tuần hoàn máu và nuôi dưỡng da đầu khỏe mạnh.')
    .input('Category1', sql.NVarChar, 'Hair')
    .query(`
      UPDATE Services 
      SET ServiceName = @Name1, 
          Description = @Desc1,
          CategoryId = (SELECT TOP 1 CategoryId FROM ServiceCategories WHERE CategoryName = @Category1)
      WHERE ServiceId = @ServiceId1
    `);
  console.log('✅ Đã đổi ServiceId=17: "Combo tóc và nail" -> "Gội đầu dưỡng sinh thảo mộc"');

  // Rename "Combo thư giãn cuối tuần" -> "Tẩy tế bào chết toàn thân"
  await pool.request()
    .input('ServiceId2', sql.Int, 18)
    .input('Name2', sql.NVarChar, 'Tẩy tế bào chết toàn thân')
    .input('Desc2', sql.NVarChar, 'Dịch vụ tẩy tế bào chết body toàn thân bằng muối khoáng biển kết hợp tinh dầu hữu cơ, giúp làn da mịn màng sáng khỏe, loại bỏ lớp sừng già cỗi hiệu quả.')
    .input('Category2', sql.NVarChar, 'Skincare')
    .query(`
      UPDATE Services 
      SET ServiceName = @Name2, 
          Description = @Desc2,
          CategoryId = (SELECT TOP 1 CategoryId FROM ServiceCategories WHERE CategoryName = @Category2)
      WHERE ServiceId = @ServiceId2
    `);
  console.log('✅ Đã đổi ServiceId=18: "Combo thư giãn cuối tuần" -> "Tẩy tế bào chết toàn thân"');

  // Verify
  const result = await pool.request().query(`
    SELECT ServiceId, ServiceName, Price, c.CategoryName 
    FROM Services s 
    LEFT JOIN ServiceCategories c ON s.CategoryId = c.CategoryId
    WHERE s.ServiceId IN (17, 18)
  `);
  console.log('\n=== VERIFIED ===');
  result.recordset.forEach(s => {
    console.log(`  ID: ${s.ServiceId} | ${s.ServiceName} | ${Number(s.Price).toLocaleString('vi-VN')}đ | Category: ${s.CategoryName}`);
  });

  process.exit(0);
}

renameComboServices().catch(err => { console.error(err); process.exit(1); });
