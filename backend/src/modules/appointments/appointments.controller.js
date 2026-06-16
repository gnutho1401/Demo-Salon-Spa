const service = require("./appointments.service");
const { success, error } = require("../../utils/response");

async function getAll(req, res) {
  try {
    return success(res, await service.getAll());
  } catch (err) {
    return error(res, err.message);
  }
}

async function getById(req, res) {
  try {
    return success(res, await service.getById(req.params.id, req.user));
  } catch (err) {
    return error(res, err.message, 403);
  }
}

async function getAvailableSlots(req, res) {
  try {
    return success(res, await service.getAvailableSlots(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getMyAppointments(req, res) {
  try {
    return success(res, await service.getMyAppointments(req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function create(req, res) {
  try {
    return success(
      res,
      await service.create(req.user.userId, req.body),
      "Đặt lịch thành công",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function update(req, res) {
  try {
    return success(
      res,
      await service.update(req.params.id, req.body, req.user),
      "Cập nhật lịch hẹn thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getRescheduleInfo(req, res) {
  try {
    return success(res, await service.getRescheduleInfo(req.params.id, req.user));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function reschedule(req, res) {
  try {
    return success(
      res,
      await service.reschedule(req.params.id, req.body, req.user),
      "Đổi lịch thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function markNoShow(req, res) {
  try {
    return success(
      res,
      await service.markNoShow(req.params.id, req.body || {}, req.user),
      "Đã đánh dấu vắng mặt",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function remove(req, res) {
  try {
    return success(
      res,
      await service.remove(req.params.id, req.body || {}, req.user),
      "Hủy lịch hẹn thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getAll,
  getById,
  getMyAppointments,
  getAvailableSlots,
  getRescheduleInfo,
  reschedule,
  markNoShow,
  create,
  update,
  remove,
};
