const service = require("./adminRefunds.service");
const { success, error } = require("../../utils/response");

async function getAllRefunds(req, res) {
  try {
    const data = await service.getAllRefunds(req.query);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function processRefund(req, res) {
  try {
    const manual = req.body?.manual === true;
    const data = await service.processRefund(
      req.params.id,
      req.user?.userId,
      manual,
    );
    return success(res, data, data.message);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function rejectRefund(req, res) {
  try {
    const data = await service.rejectRefund(
      req.params.id,
      req.body.reason,
      req.user?.userId,
    );
    return success(res, data, data.message);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getAllRefunds,
  processRefund,
  rejectRefund,
};
