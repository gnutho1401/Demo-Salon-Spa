const service = require("./adminWorkShifts.service");
const { success, error } = require("../../utils/response");

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
    return success(res, await service.create(req.body), "Created", 201);
  } catch (err) {
    return error(res, err.message);
  }
}

async function update(req, res) {
  try {
    return success(res, await service.update(req.params.id, req.body));
  } catch (err) {
    return error(res, err.message);
  }
}

async function remove(req, res) {
  try {
    return success(res, await service.remove(req.params.id));
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
