const service = require("./receptionist.service");
const { success, error } = require("../../utils/response");

async function getDashboard(req, res) {
  try {
    return success(res, await service.getDashboard());
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getAppointments(req, res) {
  try {
    return success(res, await service.getAppointments(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getAppointmentById(req, res) {
  try {
    const data = await service.getAppointmentById(req.params.id);
    if (!data) return error(res, "Không tìm thấy lịch hẹn", 404);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createAppointment(req, res) {
  try {
    return success(
      res,
      await service.createAppointment(req.body, req.user?.userId),
      "Created",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createWalkInAppointment(req, res) {
  try {
    return success(
      res,
      await service.createAppointment(
        {
          ...req.body,
          isWalkIn: true,
          paymentStatus: req.body.paymentStatus || "UNPAID",
        },
        req.user?.userId,
      ),
      "Walk-in created",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function confirmAppointment(req, res) {
  try {
    return success(
      res,
      await service.confirmAppointment(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function checkInAppointment(req, res) {
  try {
    return success(
      res,
      await service.checkInAppointment(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function startAppointment(req, res) {
  try {
    return success(
      res,
      await service.startAppointment(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function completeAppointment(req, res) {
  try {
    return success(
      res,
      await service.completeAppointment(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function cancelAppointment(req, res) {
  try {
    return success(
      res,
      await service.cancelAppointment(
        req.params.id,
        req.body,
        req.user?.userId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function noShowAppointment(req, res) {
  try {
    return success(
      res,
      await service.noShowAppointment(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function rescheduleAppointment(req, res) {
  try {
    return success(
      res,
      await service.rescheduleAppointment(
        req.params.id,
        req.body,
        req.user?.userId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getAvailableTechnicians(req, res) {
  try {
    return success(res, await service.getAvailableTechnicians(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getAvailableSlots(req, res) {
  try {
    return success(res, await service.getAvailableSlots(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getCustomersSearch(req, res) {
  try {
    return success(res, await service.getCustomersSearch(req.query.keyword));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getCustomers(req, res) {
  try {
    return success(res, await service.getCustomers(req.query.keyword));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getCustomerById(req, res) {
  try {
    const data = await service.getCustomerById(req.params.id);
    if (!data) return error(res, "Không tìm thấy khách hàng", 404);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createCustomer(req, res) {
  try {
    return success(
      res,
      await service.createCustomer(req.body, req.user?.userId),
      "Created",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateCustomer(req, res) {
  try {
    return success(
      res,
      await service.updateCustomer(req.params.id, req.body, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getServices(req, res) {
  try {
    return success(res, await service.getServices());
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getTechnicians(req, res) {
  try {
    return success(
      res,
      await service.getTechniciansForService(req.query.serviceId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getInvoices(req, res) {
  try {
    return success(res, await service.getInvoices(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getInvoiceById(req, res) {
  try {
    const data = await service.getInvoiceById(req.params.id);
    if (!data) return error(res, "Không tìm thấy hóa đơn", 404);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function markInvoicePaid(req, res) {
  try {
    return success(
      res,
      await service.markInvoicePaid(
        req.params.id,
        req.body.method,
        req.user?.userId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function requestInvoiceRefund(req, res) {
  try {
    return success(
      res,
      await service.requestRefund(req.params.id, req.body, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

/* =========================
   WAITING LIST
========================= */

async function getWaitingList(req, res) {
  try {
    return success(res, await service.getWaitingList(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createWaitingList(req, res) {
  try {
    return success(
      res,
      await service.createWaitingList(req.body),
      "Đã thêm khách vào hàng chờ",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateWaitingList(req, res) {
  try {
    return success(
      res,
      await service.updateWaitingList(req.params.id, req.body),
      "Đã cập nhật hàng chờ",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function deleteWaitingList(req, res) {
  try {
    return success(
      res,
      await service.deleteWaitingList(req.params.id),
      "Đã hủy hàng chờ",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getNotifications(req, res) {
  try {
    return success(
      res,
      await service.getReceptionistNotifications(req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function markNotificationRead(req, res) {
  try {
    return success(
      res,
      await service.markNotificationRead(req.params.id, req.user?.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getReviews(req, res) {
  try {
    return success(res, await service.getReceptionistReviews(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getProfile(req, res) {
  try {
    return success(res, await service.getReceptionistProfile(req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getSettings(req, res) {
  try {
    return success(res, await service.getReceptionistProfile(req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateSettings(req, res) {
  try {
    return success(
      res,
      await service.updateReceptionistProfile(req.user.userId, req.body),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateAvatar(req, res) {
  try {
    return success(
      res,
      await service.updateReceptionistAvatar(req.user.userId, req.file),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getDashboard,

  getAppointments,
  getAppointmentById,
  createAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  noShowAppointment,
  rescheduleAppointment,

  getAvailableTechnicians,
  getAvailableSlots,

  getCustomersSearch,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,

  getServices,
  getTechnicians,

  getInvoices,
  getInvoiceById,
  markInvoicePaid,
  requestInvoiceRefund,

  getWaitingList,
  createWaitingList,
  updateWaitingList,
  deleteWaitingList,
  createWalkInAppointment,
  getNotifications,
  markNotificationRead,
  getReviews,
  getProfile,
  getSettings,
  updateSettings,
  updateAvatar
};
