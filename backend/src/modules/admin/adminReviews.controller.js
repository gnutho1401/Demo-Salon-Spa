const service = require("./adminReviews.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function userId(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function roleName(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

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

async function changeStatus(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.changeStatus(req.params.id, req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin change review status",
      actionType: "STATUS",
      description: `Changed review #${result?.ReviewId}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ status: before?.Status }),
      newValue: JSON.stringify({ status: result?.Status }),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function respond(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.respond(req.params.id, req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin respond review",
      actionType: "UPDATE",
      description: `Responded review #${result?.ReviewId}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ adminResponse: before?.AdminResponse }),
      newValue: JSON.stringify({ adminResponse: result?.AdminResponse }),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function removeResponse(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.removeResponse(req.params.id);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin remove review response",
      actionType: "UPDATE",
      description: `Removed response review #${result?.ReviewId}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ adminResponse: before?.AdminResponse }),
      newValue: JSON.stringify({ adminResponse: null }),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  list,
  getById,
  changeStatus,
  respond,
  removeResponse,
};
