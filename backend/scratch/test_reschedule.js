const { connectDB } = require("../src/config/db");
const rescheduleService = require("../src/modules/reschedule/reschedule.service");
require("dotenv").config();

async function run() {
  try {
    const db = await connectDB();
    console.log("=== BẮT ĐẦU TEST HỆ THỐNG ĐỔI LỊCH KTV ===");

    // 1. Get Technician (EmployeeId / UserId)
    const techRes = await db.query(`
      SELECT TOP 1 e.EmployeeId, u.UserId, u.FullName 
      FROM Employees e
      JOIN Users u ON e.UserId = u.UserId
      WHERE u.Email = 'technician@salon.com'
    `);
    const tech = techRes.recordset[0];
    if (!tech) {
      console.error("Không tìm thấy KTV technician@salon.com. Hãy seed DB trước.");
      process.exit(1);
    }
    console.log(`✓ Tìm thấy KTV: ${tech.FullName} (UserId: ${tech.UserId}, EmployeeId: ${tech.EmployeeId})`);

    // 2. Find an active appointment for this technician
    let apptRes = await db.query(`
      SELECT TOP 1 AppointmentId, Status, AppointmentDate, StartTime 
      FROM Appointments 
      WHERE EmployeeId = ${tech.EmployeeId} AND Status IN ('PENDING', 'CONFIRMED', 'PAID')
      ORDER BY AppointmentId DESC
    `);
    let appt = apptRes.recordset[0];

    if (!appt) {
      console.log("Không có cuộc hẹn nào ở trạng thái chờ/đã xác nhận của KTV này. Đang tạo cuộc hẹn mẫu...");
      // Find a customer
      const custRes = await db.query("SELECT TOP 1 CustomerId FROM Customers");
      const custId = custRes.recordset[0]?.CustomerId;
      if (!custId) {
        console.error("Không tìm thấy khách hàng nào để tạo cuộc hẹn mẫu.");
        process.exit(1);
      }
      
      // Create test appointment
      await db.query(`
        INSERT INTO Appointments (CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime, Status, Notes, CreatedAt)
        VALUES (${custId}, ${tech.EmployeeId}, CAST(GETDATE() AS DATE), '10:00:00', '11:00:00', 'CONFIRMED', N'Lịch hẹn mẫu để test đổi lịch', GETDATE())
      `);
      
      apptRes = await db.query(`
        SELECT TOP 1 AppointmentId, Status, AppointmentDate, StartTime 
        FROM Appointments 
        WHERE EmployeeId = ${tech.EmployeeId} AND Status = 'CONFIRMED'
        ORDER BY AppointmentId DESC
      `);
      appt = apptRes.recordset[0];
    }
    console.log(`✓ Lịch hẹn dùng để test: #${appt.AppointmentId} (Trạng thái: ${appt.Status})`);

    // 3. Clear any existing reschedule requests for this appointment to avoid conflict
    await db.query(`DELETE FROM AppointmentRescheduleRequests WHERE AppointmentId = ${appt.AppointmentId}`);

    // 4. Test: Create Reschedule Request
    console.log("\n--- Bước 1: Gửi đề xuất đổi lịch từ phía KTV ---");
    const requestedDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10); // Tomorrow
    const proposal = {
      requestedDate,
      requestedStartTime: "14:00:00",
      requestedEndTime: "15:00:00",
      reason: "Bận ca dạy thợ mới đột xuất"
    };

    const reqResult = await rescheduleService.createRequest(tech.UserId, appt.AppointmentId, proposal);
    console.log("Phản hồi tạo yêu cầu:", reqResult.message);

    // Verify in DB
    const checkReq = await db.query(`
      SELECT * FROM AppointmentRescheduleRequests 
      WHERE AppointmentId = ${appt.AppointmentId} AND Status = 'PENDING'
    `);
    const pendingRequest = checkReq.recordset[0];
    if (!pendingRequest) {
      throw new Error("Không tìm thấy yêu cầu đổi lịch ở trạng thái PENDING trong DB!");
    }
    console.log(`✓ Đã lưu yêu cầu PENDING vào DB. ID yêu cầu: #${pendingRequest.RequestId}`);

    // 5. Test: Get list of requests for receptionist
    console.log("\n--- Bước 2: Xem danh sách yêu cầu đổi lịch phía Lễ tân ---");
    const receptionistRequests = await rescheduleService.getReceptionistRequests();
    const found = receptionistRequests.find(r => r.RequestId === pendingRequest.RequestId);
    if (!found) {
      throw new Error("Lễ tân không thấy yêu cầu đổi lịch vừa tạo!");
    }
    console.log(`✓ Lễ tân đã thấy yêu cầu #${found.RequestId}. Đề xuất: ${found.RequestedDate} lúc ${found.RequestedStartTime}`);

    // 6. Test: Approve Request
    console.log("\n--- Bước 3: Lễ tân Duyệt yêu cầu đổi lịch ---");
    const receptionistUserId = 3; // Standard receptionist user ID in template or test profile
    const approveResult = await rescheduleService.approveRequest(pendingRequest.RequestId, receptionistUserId);
    console.log("Phản hồi duyệt yêu cầu:", approveResult.message);

    // Verify appointment was updated
    const updatedApptRes = await db.query(`
      SELECT AppointmentDate, CONVERT(VARCHAR(5), StartTime, 108) AS StartTime 
      FROM Appointments WHERE AppointmentId = ${appt.AppointmentId}
    `);
    const updatedAppt = updatedApptRes.recordset[0];
    console.log(`Thời gian gốc: ${new Date(appt.AppointmentDate).toISOString().slice(0,10)} lúc ${appt.StartTime}`);
    console.log(`Thời gian mới: ${new Date(updatedAppt.AppointmentDate).toISOString().slice(0,10)} lúc ${updatedAppt.StartTime}`);
    
    if (new Date(updatedAppt.AppointmentDate).toISOString().slice(0,10) !== requestedDate || updatedAppt.StartTime !== "14:00") {
      throw new Error("Lịch hẹn của cuộc hẹn chưa được cập nhật chính xác sang thời gian đề xuất!");
    }
    console.log("✓ Lịch hẹn của cuộc hẹn đã được đổi giờ thành công!");

    // 7. Test: Reject Request
    console.log("\n--- Bước 4: Test từ chối yêu cầu đổi lịch ---");
    // Create another request
    const proposal2 = {
      requestedDate,
      requestedStartTime: "16:00:00",
      requestedEndTime: "17:00:00",
      reason: "Muốn chuyển lịch thêm lần nữa"
    };
    const reqResult2 = await rescheduleService.createRequest(tech.UserId, appt.AppointmentId, proposal2);
    const checkReq2 = await db.query(`
      SELECT RequestId FROM AppointmentRescheduleRequests 
      WHERE AppointmentId = ${appt.AppointmentId} AND Status = 'PENDING'
    `);
    const pendingRequest2 = checkReq2.recordset[0];

    const rejectResult = await rescheduleService.rejectRequest(pendingRequest2.RequestId, "Trùng lịch lễ hội, không duyệt được", receptionistUserId);
    console.log("Phản hồi từ chối yêu cầu:", rejectResult.message);

    // Verify rejection in DB
    const checkReject = await db.query(`
      SELECT Status, Notes FROM AppointmentRescheduleRequests 
      WHERE RequestId = ${pendingRequest2.RequestId}
    `);
    const rejectedReq = checkReject.recordset[0];
    if (rejectedReq.Status !== "REJECTED" || rejectedReq.Notes !== "Trùng lịch lễ hội, không duyệt được") {
      throw new Error("Từ chối thất bại hoặc phản hồi bị lỗi!");
    }
    console.log("✓ Đã từ chối yêu cầu thành công. Phản hồi lưu lại:", rejectedReq.Notes);

    console.log("\n=== TẤT CẢ CÁC BƯỚC TEST ĐỀU THÀNH CÔNG RỰC RỠ! ===");
    process.exit(0);
  } catch (err) {
    console.error("\n✕ CÓ LỖI XẢY RA KHI TEST:", err.message);
    process.exit(1);
  }
}

run();
