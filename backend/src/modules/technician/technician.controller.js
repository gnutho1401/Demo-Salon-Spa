const service = require("./technician.service");
const { success, error } = require("../../utils/response");

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
    const data = await service.addTreatmentNote(
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
    const data = await service.saveTreatmentNote(req.user.userId, req.body);
    res.json({ success: true, data });
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
    res.json({ success: true, data, message: "Export data ready" });
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

module.exports = {
  getDashboard,
  getSchedule,
  startAppointment,
  completeAppointment,
  getAppointmentDetail,
  markNoShow,
  addTreatmentNote,
  getAppointments,
  getAppointmentsSummary,
  getCustomers,
  getCustomersSummary,
  getCustomerDetail,
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
};
