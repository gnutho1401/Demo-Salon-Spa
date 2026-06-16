const service = require("./adminServices.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function userId(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function roleName(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

async function getCategories(req, res) {
  try {
    return success(res, await service.getCategories());
  } catch (err) {
    return error(res, err.message, 400);
  }
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

async function create(req, res) {
  try {
    const result = await service.create(req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin create service",
      actionType: "CREATE",
      description: `Created service ${result?.ServiceName || ""}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Created", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function update(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.update(req.params.id, req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin update service",
      actionType: "UPDATE",
      description: `Updated service ${result?.ServiceName || before?.ServiceName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Updated");
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
      actionName: "Admin change service status",
      actionType: "STATUS",
      description: `Changed service status ${result?.ServiceName || before?.ServiceName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ status: before?.Status }),
      newValue: JSON.stringify({ status: result?.Status }),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function remove(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.remove(req.params.id);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin delete service",
      actionType: "DELETE",
      description: `Deleted service ${before?.ServiceName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Deleted");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getCategories,
  list,
  getById,
  create,
  update,
  changeStatus,
  remove,
};
