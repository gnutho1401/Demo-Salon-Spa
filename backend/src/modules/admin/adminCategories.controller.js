const service = require("./adminCategories.service");
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

async function create(req, res) {
  try {
    const result = await service.create(req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin create service category",
      actionType: "CREATE",
      description: `Created service category ${result?.CategoryName || ""}`,
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
      actionName: "Admin update service category",
      actionType: "UPDATE",
      description: `Updated service category ${result?.CategoryName || before?.CategoryName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
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
      actionName: "Admin delete service category",
      actionType: "DELETE",
      description: `Deleted service category ${before?.CategoryName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: null,
    });

    return success(res, result, "Deleted");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function toggleActive(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.toggleActive(req.params.id);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin toggle active service category",
      actionType: "UPDATE",
      description: `Toggled active status of category ${result?.CategoryName || before?.CategoryName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = { list, getById, create, update, remove, toggleActive };
