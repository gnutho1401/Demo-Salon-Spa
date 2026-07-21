const sql = require("mssql");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const service = require("../src/modules/treatment-notes-v2/treatment-notes-v2.service");

async function run() {
  try {
    console.log("=== BẮT ĐẦU KIỂM THỬ TÍNH NĂNG AI IN TREATMENT NOTES ===");

    // 1. Kiểm thử AI Soạn ghi chú siêu tốc
    console.log("\n1. Đang gọi AI Smart Note Generator...");
    const rawText = "khách làm nail móng hơi mỏng xước viền thích form oval vẽ hoa đào khuyên về dưỡng ẩm bôi dầu dừa";
    const serviceName = "Sơn Gel Vẽ Trang Trí";
    const categoryName = "Nail";
    
    const aiNote = await service.generateAINote(rawText, serviceName, categoryName);
    console.log("-> Kết quả AI Note (Nếu có fallback, is_fallback sẽ là true):", JSON.stringify(aiNote, null, 2));

    // 2. Tìm một khách hàng có lịch sử làm đẹp để kiểm thử phân tích khách hàng
    console.log("\n2. Đang tìm một khách hàng hợp lệ trong DB...");
    const pool = await service.getPool();
    const customerRes = await pool.request().query("SELECT TOP 1 CustomerId, FullName FROM Customers c JOIN Users u ON c.UserId = u.UserId");
    if (customerRes.recordset.length === 0) {
      console.log("Không tìm thấy khách hàng nào trong DB. Bỏ qua kiểm thử AI Insights.");
      return;
    }

    const customerId = customerRes.recordset[0].CustomerId;
    const customerName = customerRes.recordset[0].FullName;
    console.log(`-> Tìm thấy khách hàng: ${customerName} (ID: ${customerId})`);

    console.log("\n3. Đang gọi AI Customer Insights...");
    const aiInsights = await service.getCustomerAIInsights(customerId);
    console.log("-> Báo cáo Markdown của AI:\n", aiInsights.reportMarkdown);
    console.log("-> Đề xuất đặt lịch tái khám:\n", JSON.stringify(aiInsights.suggestedFollowUp, null, 2));

    console.log("\n=== KIỂM THỬ HOÀN TẤT THÀNH CÔNG! ===");
  } catch (err) {
    console.error("LỖI KIỂM THỬ:", err);
  } finally {
    process.exit(0);
  }
}

run();
