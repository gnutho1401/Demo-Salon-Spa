const service = require("./adminWorkShifts.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function currentUser(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function currentRole(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

async function getTechnicians(req, res) {
  try {
    return success(res, await service.getTechnicians());
  } catch (err) {
    return error(res, err.message);
  }
}

async function list(req, res) {
  try {
    return success(res, await service.list(req.query));
  } catch (err) {
    return error(res, err.message);
  }
}

async function getById(req, res) {
  try {
    return success(res, await service.getById(req.params.id));
  } catch (err) {
    return error(res, err.message);
  }
}

async function create(req, res) {
  try {
    const result = await service.create(req.body);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin create work shift",
      actionType: "CREATE",
      description: `Created work shift ${result?.ShiftName || ""} on ${result?.ShiftDate ? String(result.ShiftDate).slice(0, 10) : ""}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Created", 201);
  } catch (err) {
    return error(res, err.message);
  }
}

async function update(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.update(req.params.id, req.body);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin update work shift",
      actionType: "UPDATE",
      description: `Updated work shift ${result?.ShiftName || ""} on ${result?.ShiftDate ? String(result.ShiftDate).slice(0, 10) : ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function remove(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.remove(req.params.id);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin delete work shift",
      actionType: "DELETE",
      description: `Deleted work shift ${before?.ShiftName || ""} on ${before?.ShiftDate ? String(before.ShiftDate).slice(0, 10) : ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  getTechnicians,
  list,
  getById,
  create,
  update,
  remove,
};
