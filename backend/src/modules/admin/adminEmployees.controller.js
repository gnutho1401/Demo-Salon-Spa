const service = require("./adminEmployees.service");
const logs = require("./adminSystemLogs.service");
const { success, error } = require("../../utils/response");

function currentUser(req) {
  return req.user?.userId || req.user?.UserId || null;
}

function currentRole(req) {
  return req.user?.roleName || req.user?.RoleName || null;
}

async function getRoles(req, res) {
  try {
    return success(res, await service.getRoles());
  } catch (err) {
    return error(res, err.message);
  }
}

async function getBranches(req, res) {
  try {
    return success(res, await service.getBranches());
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
      actionName: "Admin create employee",
      actionType: "CREATE",
      description: `Created employee ${result?.FullName || ""}`,
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
      actionName: "Admin update employee",
      actionType: "UPDATE",
      description: `Updated employee ${result?.FullName || before?.FullName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
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
      actionName: "Admin change employee status",
      actionType: "STATUS",
      description: `Changed employee status ${result?.FullName || before?.FullName || ""}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify({
        status: before?.Status,
        userStatus: before?.UserStatus,
      }),
      newValue: JSON.stringify({
        status: result?.Status,
        userStatus: result?.UserStatus,
      }),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function getAssignedServices(req, res) {
  try {
    return success(res, await service.getAssignedServices(req.params.id));
  } catch (err) {
    return error(res, err.message);
  }
}

async function updateAssignedServices(req, res) {
  try {
    const before = await service.getAssignedServices(req.params.id);
    const result = await service.updateAssignedServices(req.params.id, req.body.serviceIds);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin update employee services",
      actionType: "UPDATE",
      description: `Updated assigned services for employee ID ${req.params.id}`,
      ipAddress: req.ip,
      oldValue: JSON.stringify(before),
      newValue: JSON.stringify(result),
    });

    return success(res, result);
  } catch (err) {
    return error(res, err.message);
  }
}

async function uploadImage(req, res) {
  try {
    if (!req.file) return error(res, "Vui lòng chọn file ảnh", 400);
    const imageUrl = `/uploads/employees/${req.file.filename}`;
    const result = await service.updateImage(req.params.id, imageUrl);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin upload employee image",
      actionType: "UPDATE",
      description: `Uploaded image for employee ID ${req.params.id}`,
      ipAddress: req.ip,
      oldValue: null,
      newValue: JSON.stringify({ imageUrl }),
    });

    return success(res, result, "Image uploaded");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function remove(req, res) {
  try {
    const before = await service.getById(req.params.id);
    const result = await service.remove(req.params.id);

    await logs.writeLog({
      userId: currentUser(req),
      roleName: currentRole(req),
      actionName: "Admin delete employee",
      actionType: "DELETE",
      description: `Deleted employee ${before?.FullName || ""}`,
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
  getBranches,
  list,
  getById,
  create,
  update,
  changeStatus,
  getAssignedServices,
  updateAssignedServices,
  uploadImage,
  remove,
};

