const waitingListService = require("./waiting-list.service");
const { success, error } = require("../../utils/response");

async function getOptions(req, res) {
  try {
    const data = await waitingListService.getOptions();
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getMine(req, res) {
  try {
    const data = await waitingListService.getMine(req.user.userId, req.query);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getById(req, res) {
  try {
    const data = await waitingListService.getById(
      req.user.userId,
      req.params.id,
    );
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function create(req, res) {
  try {
    const data = await waitingListService.create(req.user.userId, req.body);
    return success(res, data, "Đã thêm yêu cầu hàng chờ.", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function update(req, res) {
  try {
    const data = await waitingListService.update(
      req.user.userId,
      req.params.id,
      req.body,
    );
    return success(res, data, "Đã cập nhật yêu cầu hàng chờ.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function cancel(req, res) {
  try {
    const data = await waitingListService.cancel(
      req.user.userId,
      req.params.id,
      req.body,
    );
    return success(res, data, "Đã hủy yêu cầu hàng chờ.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function confirmMatch(req, res) {
  try {
    const data = await waitingListService.confirmMatch(
      req.user.userId,
      req.params.id
    );
    return success(res, data, "Đã xác nhận lịch hẹn ghép.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function rejectMatch(req, res) {
  try {
    const data = await waitingListService.rejectMatch(
      req.user.userId,
      req.params.id
    );
    return success(res, data, "Đã từ chối lịch hẹn ghép.");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getOptions,
  getMine,
  getById,
  create,
  update,
  cancel,
  confirmMatch,
  rejectMatch,
};
