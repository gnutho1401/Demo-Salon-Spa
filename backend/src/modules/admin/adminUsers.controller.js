const service = require("./adminUsers.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function userId(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function roleName(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

async function getRoles(req, res) {
  try {
    return success(res, await service.getRoles());
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
      actionName: "Admin create user",
      actionType: "CREATE",
      description: `Created user ${result?.Email || ""}`,
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
      actionName: "Admin update user",
      actionType: "UPDATE",
      description: `Updated user ${result?.Email || before?.Email || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function updateRole(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.updateRole(req.params.id, req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin update user role",
      actionType: "UPDATE",
      description: `Changed role for ${result?.Email || before?.Email || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ role: before?.RoleName }),
      newValue: JSON.stringify({ role: result?.RoleName }),
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
      actionName: "Admin change user status",
      actionType: "STATUS",
      description: `Changed status for ${result?.Email || before?.Email || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({ status: before?.Status }),
      newValue: JSON.stringify({ status: result?.Status }),
    });

    return success(res, result, "Updated");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function resetPassword(req, res) {
  try {
    const result = await service.resetPassword(req.params.id, req.body);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin reset user password",
      actionType: "UPDATE",
      description: `Reset password for ${result?.Email || ""}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify({ UserId: result?.UserId }),
    });

    return success(res, result, "Password reset");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function uploadAvatar(req, res) {
  try {
    if (!req.file) return error(res, "Vui lòng chọn file ảnh", 400);
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const result = await service.updateAvatar(req.params.id, avatarUrl);

    await logs.writeLog({
      userId: userId(req),
      roleName: roleName(req),
      actionName: "Admin upload user avatar",
      actionType: "UPDATE",
      description: `Uploaded avatar for user ID ${req.params.id}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify({ avatarUrl }),
    });

    return success(res, result, "Avatar uploaded");
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
      actionName: "Admin delete user",
      actionType: "DELETE",
      description: `Deleted user ${before?.Email || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getRoles,
  list,
  getById,
  create,
  update,
  updateRole,
  changeStatus,
  resetPassword,
  uploadAvatar,
  remove,
};

