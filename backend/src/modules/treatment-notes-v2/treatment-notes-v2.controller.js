const service = require("./treatment-notes-v2.service");
const { success, error } = require("../../utils/response");

// Helper to determine if the user has Admin/Manager level access
function checkAdminAccess(req) {
  const role = String(req.user?.RoleName || "").toUpperCase();
  return role === "ADMIN" || role === "MANAGER";
}

async function createNote(req, res) {
  try {
    const data = req.body;
    const noteId = await service.createNote(data);
    return success(res, { noteId }, "Khởi tạo hồ sơ ghi chú trị liệu thành công.", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getCustomerHistory(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { technicianId, serviceType, startDate, endDate, status } = req.query;
    const isAdmin = checkAdminAccess(req);

    const history = await service.getCustomerHistory(customerId, {
      technicianId: technicianId ? Number(technicianId) : undefined,
      serviceType,
      startDate,
      endDate,
      status
    }, isAdmin);

    return success(res, history);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getNoteByAppointment(req, res) {
  try {
    const appointmentId = Number(req.params.id);
    const isAdmin = checkAdminAccess(req);

    const note = await service.getNoteByAppointment(appointmentId, isAdmin);
    if (!note) {
      return success(res, null, "Không tìm thấy ghi chú trị liệu cho lịch hẹn này.", 200);
    }
    return success(res, note);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getNoteById(req, res) {
  try {
    const noteId = req.params.id;
    const isAdmin = checkAdminAccess(req);
    const note = await service.getNoteById(noteId, isAdmin);
    if (!note) {
      return error(res, "Không tìm thấy ghi chú trị liệu.", 404);
    }
    return success(res, note);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateNote(req, res) {
  try {
    const noteId = req.params.id;
    const updateFields = req.body;
    const isAdmin = checkAdminAccess(req);

    const updated = await service.updateNote(noteId, updateFields, isAdmin);
    if (!updated) {
      return error(res, "Cập nhật ghi chú thất bại hoặc không có thay đổi.", 400);
    }
    return success(res, null, "Cập nhật hồ sơ trị liệu thành công.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function finalizeNote(req, res) {
  try {
    const noteId = req.params.id;
    const finalized = await service.finalizeNote(noteId);
    if (!finalized) {
      return error(res, "Không thể khóa hồ sơ trị liệu. Hồ sơ có thể đã khóa hoặc không tồn tại.", 400);
    }
    return success(res, null, "Khóa hồ sơ trị liệu thành công. Mọi chỉnh sửa đã bị vô hiệu hóa.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function searchNotes(req, res) {
  try {
    const { keyword, technicianId, status, serviceId, customerId } = req.query;
    const isAdmin = checkAdminAccess(req);

    const results = await service.searchNotes({
      keyword,
      technicianId: technicianId ? Number(technicianId) : undefined,
      status,
      serviceId: serviceId ? Number(serviceId) : undefined,
      customerId: customerId ? Number(customerId) : undefined
    }, isAdmin);

    return success(res, results);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getAnalytics(req, res) {
  try {
    // Only Admin or Manager can view global analytics
    if (!checkAdminAccess(req)) {
      return error(res, "Bạn không có quyền truy cập số liệu phân tích.", 403);
    }

    const analytics = await service.getAnalytics();
    return success(res, analytics);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  createNote,
  getCustomerHistory,
  getNoteByAppointment,
  getNoteById,
  updateNote,
  finalizeNote,
  searchNotes,
  getAnalytics
};
