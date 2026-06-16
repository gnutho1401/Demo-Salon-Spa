const service = require("./adminServiceAssignments.service");
const { success, error } = require("../../utils/response");

async function getAssignedTechnicians(req, res) {
  try { return success(res, await service.getAssignedTechnicians(req.params.serviceId)); } catch (err) { return error(res, err.message, 400); }
}

async function updateAssignedTechnicians(req, res) {
  try { return success(res, await service.updateAssignedTechnicians(req.params.serviceId, req.body.employeeIds || req.body.technicianIds || []), "Updated"); } catch (err) { return error(res, err.message, 400); }
}

module.exports = { getAssignedTechnicians, updateAssignedTechnicians };
