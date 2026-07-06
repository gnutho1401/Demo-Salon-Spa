const service = require("./employees.service");
const { success, error } = require("../../utils/response");

async function getAll(req, res) {
  try {
    return success(res, await service.getAll());
  } catch (err) {
    return error(res, err.message);
  }
}
async function getById(req, res) {
  try {
    const data = await service.getById(req.params.id);

    if (!data) {
      return error(res, "Không tìm thấy kỹ thuật viên", 404);
    }

    return success(res, data);
  } catch (err) {
    return error(res, err.message);
  }
}
async function create(req, res) {
  try {
    return success(res, await service.create(req.body), "Created", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function update(req, res) {
  try {
    return success(
      res,
      await service.update(req.params.id, req.body),
      "Updated",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function remove(req, res) {
  try {
    return success(res, await service.remove(req.params.id), "Deleted");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getByService(req, res) {
  try {
    const serviceId = req.params.serviceId;
    const data = await service.getByService(serviceId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || "Không lấy được kỹ thuật viên theo dịch vụ",
    });
  }
}
async function getBranches(req, res) {
  try {
    return success(res, await service.getBranches());
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = { getAll, getById, create, update, remove, getByService, getBranches };
