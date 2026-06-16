const service = require("./adminFeedbacks.service");
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
      actionName: "Admin change feedback status",
      actionType: "STATUS",
      description: `Changed feedback #${result?.FeedbackId}`,
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
      actionName: "Admin respond feedback",
      actionType: "UPDATE",
      description: `Responded feedback #${result?.FeedbackId}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({
        status: before?.Status,
        adminResponse: before?.AdminResponse,
      }),
      newValue: JSON.stringify({
        status: result?.Status,
        adminResponse: result?.AdminResponse,
      }),
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
      actionName: "Admin remove feedback response",
      actionType: "UPDATE",
      description: `Removed response feedback #${result?.FeedbackId}`,
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
