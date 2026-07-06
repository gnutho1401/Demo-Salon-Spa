const service = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

async function list(req, res) {
  try {
    return success(res, await service.list(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getById(req, res) {
  try {
    return success(res, await service.getById(req.params.id));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getLogFilters(req, res) {
  try {
    return success(res, await service.getLogFilters());
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { list, getById, getLogFilters };
