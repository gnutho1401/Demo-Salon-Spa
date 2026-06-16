const service = require("./adminPackages.service");
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

async function getServices(req, res) {
  try {
    return success(res, await service.getServices());
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

async function getAssignedServices(req, res) {
  try {
    return success(res, await service.getAssignedServices(req.params.id));
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
      actionName: "Admin create package",
      actionType: "CREATE",
      description: `Created package ${result?.PackageName || ""}`,
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
      actionName: "Admin update package",
      actionType: "UPDATE",
      description: `Updated package ${result?.PackageName || before?.PackageName || ""}`,
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
      actionName: "Admin change package status",
      actionType: "STATUS",
      description: `Changed package status ${result?.PackageName || before?.PackageName || ""}`,
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
      actionName: "Admin delete package",
      actionType: "DELETE",
      description: `Deleted package ${before?.PackageName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Deleted");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updatePackageServices(req, res) {
  try {
    const result = await service.updatePackageServices(req.params.id, req.body);
    return success(res, result, "Updated package services");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getCategories,
  getServices,
  list,
  getById,
  getAssignedServices,
  create,
  update,
  changeStatus,
  remove,
  updatePackageServices,
};
