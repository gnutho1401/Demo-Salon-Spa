const service = require("./technician.service");
const { success, error } = require("../../utils/response");
const treatmentNotesV2Service = require("../treatment-notes-v2/treatment-notes-v2.service");

async function getDashboard(req, res) {
  try {
    const data = await service.getDashboard(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

async function getSchedule(req, res) {
  try {
    const data = await service.getSchedule(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAvailableSlots(req, res) {
  try {
    const data = await service.getAvailableSlotsForTechnician(
      req.user.userId,
      req.query,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function startAppointment(req, res) {
  try {
    const data = await service.startAppointment(req.user.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function completeAppointment(req, res) {
  try {
    const data = await service.completeAppointment(
      req.user.userId,
      req.params.id,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function completeMyStep(req, res) {
  try {
    const data = await service.completeMyStep(req.user.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAppointmentDetail(req, res) {
  try {
    const data = await service.getAppointmentDetail(
      req.user.userId,
      req.params.id,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function markNoShow(req, res) {
  try {
    const data = await service.markNoShow(req.user.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function addTreatmentNote(req, res) {
  try {
    const data = await service.upsertTreatmentNote(
      req.user.userId,
      req.params.id,
      req.body,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAppointments(req, res) {
  try {
    const data = await service.getAppointments(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAppointmentsSummary(req, res) {
  try {
    const data = await service.getAppointmentsSummary(
      req.user.userId,
      req.query,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getCustomers(req, res) {
  try {
    const data = await service.getCustomers(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getCustomersSummary(req, res) {
  try {
    const data = await service.getCustomersSummary(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getCustomerDetail(req, res) {
  try {
    const data = await service.getCustomerDetail(
      req.user.userId,
      req.params.id,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getCustomerInsights(req, res) {
  try {
    const data = await service.getCustomerInsights(
      req.user.userId,
      req.params.id,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getTreatmentNotesPage(req, res) {
  try {
    const data = await service.getTreatmentNotesPage(
      req.user.userId,
      req.query,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function saveTreatmentNote(req, res) {
  try {
    const data = await service.upsertTreatmentNote(req.user.userId, req.body.appointmentId, req.body);
    res.json({
      success: true,
      data: {
        message: "Tạo ghi chú điều trị thành công",
        noteId: data.NoteId,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getCustomerNoteHistory(req, res) {
  try {
    const data = await service.getCustomerNoteHistory(
      req.user.userId,
      req.params.appointmentId,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteTreatmentNote(req, res) {
  try {
    const data = await service.deleteTreatmentNote(
      req.user.userId,
      req.params.noteId,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getEarnings(req, res) {
  try {
    const data = await service.getEarnings(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getEarningPayoutHistory(req, res) {
  try {
    const data = await service.getEarningPayoutHistory(
      req.user.userId,
      req.query,
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateEarningGoal(req, res) {
  try {
    const data = await service.updateEarningGoal(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function createPayoutRequest(req, res) {
  try {
    const data = await service.createPayoutRequest(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function exportEarnings(req, res) {
  try {
    const data = await service.getEarnings(req.user.userId, req.query);
    const history = data.earningsHistory || [];

    const headers = [
      "Mã lịch hẹn",
      "Ngày thực hiện",
      "Giờ bắt đầu",
      "Tên khách hàng",
      "Tên dịch vụ",
      "Giá dịch vụ (VND)",
      "Tỷ lệ hoa hồng",
      "Hoa hồng nhận được (VND)"
    ];

    let csvContent = "\ufeff"; // UTF-8 BOM
    csvContent += headers.join(",") + "\n";

    history.forEach(item => {
      const dateStr = item.AppointmentDate ? new Date(item.AppointmentDate).toLocaleDateString("vi-VN") : "";
      const row = [
        item.AppointmentId || "",
        `"${dateStr}"`,
        `"${item.StartTime || ""}"`,
        `"${String(item.CustomerName || "").replaceAll('"', '""')}"`,
        `"${String(item.ServiceName || "").replaceAll('"', '""')}"`,
        item.ServicePrice || 0,
        item.CommissionRate || 0.15,
        item.CommissionAmount || 0
      ];
      csvContent += row.join(",") + "\n";
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=doanh_thu_ktv_${new Date().toISOString().slice(0, 10)}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getProfile(req, res) {
  try {
    const data = await service.getProfile(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const data = await service.updateProfile(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getSettings(req, res) {
  try {
    const data = await service.getProfile(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateSettings(req, res) {
  try {
    const data = await service.updateProfile(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateAvatar(req, res) {
  try {
    const data = await service.updateAvatar(req.user.userId, req.file);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function uploadTreatmentAttachments(req, res) {
  try {
    const data = await service.uploadTreatmentAttachments(
      req.user.userId,
      req.params.noteId,
      req.files || [],
      req.body.attachmentType,
    );
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateTreatmentProgress(req, res) {
  try {
    const data = await service.updateTreatmentProgress(
      req.user.userId,
      req.params.noteId,
      req.body.progressStatus,
    );
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createShift(req, res) {
  try {
    const data = await service.createShift(req.user.userId, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getShifts(req, res) {
  try {
    const data = await service.getShiftsByTechnician(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function checkIn(req, res) {
  try {
    const data = await service.checkIn(req.user.userId, req.body.shiftId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function checkOut(req, res) {
  try {
    const data = await service.checkOut(req.user.userId, req.body.shiftId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getReviews(req, res) {
  try {
    const data = await service.getReviews(req.user.userId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function createAppointment(req, res) {
  try {
    const data = await service.createAppointment(req.user.userId, req.body);

    // Nếu đặt tái khám PENDING/PENDING_PAYMENT từ một Treatment Note, lưu liên kết để sau khi khách xác nhận/thanh toán sẽ auto-finalize
    const appointmentId = data?.appointmentId || data?.AppointmentId;
    const { treatmentNoteId, status } = req.body;
    if (appointmentId && treatmentNoteId && (status === "PENDING" || status === "PENDING_PAYMENT")) {
      try {
        await treatmentNotesV2Service.linkFollowUpAppointment(treatmentNoteId, appointmentId);
      } catch (linkErr) {
        console.warn("[createAppointment] Link follow-up failed (non-critical):", linkErr.message);
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getShiftQuotas(req, res) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await service.getShiftQuotas(date);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAttendanceWeeklyStats(req, res) {
  try {
    const data = await service.getAttendanceWeeklyStats(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAvailableShifts(req, res) {
  try {
    const data = await service.getAvailableShifts(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function registerShift(req, res) {
  try {
    const data = await service.registerShift(req.user.userId, req.body.shiftId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function cancelRegistration(req, res) {
  try {
    const data = await service.cancelRegistration(req.user.userId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getMyShifts(req, res) {
  try {
    const data = await service.getMyShifts(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getMyAttendance(req, res) {
  try {
    const data = await service.getMyAttendance(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getAttendanceByShift(req, res) {
  try {
    const data = await service.getAttendanceByShift(req.user.userId, req.params.shiftId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getWeeklyTimesheet(req, res) {
  try {
    const data = await service.getWeeklyTimesheet(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getMonthlyTimesheet(req, res) {
  try {
    const data = await service.getMonthlyTimesheet(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateAppointmentDuration(req, res) {
  try {
    const data = await service.updateAppointmentDuration(
      req.user.userId,
      req.params.id,
      req.body.durationMinutes
    );
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  getDashboard,
  getSchedule,
  getAvailableSlots,
  startAppointment,
  completeAppointment,
  getAppointmentDetail,
  markNoShow,
  addTreatmentNote,
  getCustomers,
  getCustomersSummary,
  getAppointments,
  getAppointmentsSummary,
  getCustomerDetail,
  getCustomerInsights,
  getTreatmentNotesPage,
  saveTreatmentNote,
  getCustomerNoteHistory,
  deleteTreatmentNote,
  getEarnings,
  getEarningPayoutHistory,
  updateEarningGoal,
  createPayoutRequest,
  exportEarnings,
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  updateAvatar,
  uploadTreatmentAttachments,
  updateTreatmentProgress,
  
  createShift,
  getShifts,
  checkIn,
  checkOut,
  getReviews,
  createAppointment,
  getShiftQuotas,
  getAttendanceWeeklyStats,
  
  getAvailableShifts,
  registerShift,
  cancelRegistration,
  getMyShifts,
  getMyAttendance,
  getAttendanceByShift,
  getWeeklyTimesheet,
  getMonthlyTimesheet,
  updateAppointmentDuration,
  completeMyStep,
};
