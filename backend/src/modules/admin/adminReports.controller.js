const service = require("./adminReports.service");
const { success, error } = require("../../utils/response");

async function getSummary(req, res) {
  try {
    return success(res, await service.getSummary(req.query));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { getSummary };
