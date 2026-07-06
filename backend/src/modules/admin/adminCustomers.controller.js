const service = require("./adminCustomers.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function currentUser(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function currentRole(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

async function getMembershipLevels(req, res) {
  try {
    return success(res, await service.getMembershipLevels());
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
      actionName: "Admin create customer",
      actionType: "CREATE",
      description: `Created customer account ${result?.profile?.FullName} (${result?.profile?.Email})`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify(result.profile),
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
      actionName: "Admin update customer",
      actionType: "UPDATE",
      description: `Updated customer profile for ${result?.profile?.FullName}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before.profile),
      newValue: JSON.stringify(result.profile),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function adjustPoints(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.adjustPoints(req.params.id, req.body);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin adjust loyalty points",
      actionType: "UPDATE",
      description: `Adjusted points for customer ${result?.profile?.FullName}. Points change: ${req.body.Points || req.body.points || 0}. Note: ${req.body.Note || req.body.note || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ LoyaltyPoints: before.profile.LoyaltyPoints, MembershipLevelName: before.profile.MembershipLevelName }),
      newValue: JSON.stringify({ LoyaltyPoints: result.profile.LoyaltyPoints, MembershipLevelName: result.profile.MembershipLevelName }),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function changeStatus(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.changeStatus(req.params.id, req.body);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin change customer status",
      actionType: "STATUS",
      description: `Changed customer status for ${result?.profile?.FullName} from ${before?.profile?.Status} to ${result?.profile?.Status}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ Status: before.profile.Status }),
      newValue: JSON.stringify({ Status: result.profile.Status }),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function resetPassword(req, res) {
  try {
    const result = await service.resetPassword(req.params.id, req.body);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin reset customer password",
      actionType: "UPDATE",
      description: `Reset password for customer ${result?.profile?.FullName}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: null,
    });

    return success(res, result, "Password reset successfully");
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  getMembershipLevels,
  list,
  getById,
  create,
  update,
  adjustPoints,
  changeStatus,
  resetPassword,
};
