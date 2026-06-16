const service = require("./admin.service");
const { success, error } = require("../../utils/response");

async function getDashboard(req, res) {
  try {
    return success(res, await service.getDashboard());
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = { getDashboard };
