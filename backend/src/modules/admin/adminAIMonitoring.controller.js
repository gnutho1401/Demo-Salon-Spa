const service = require("./adminAIMonitoring.service");
const { success, error } = require("../../utils/response");

async function list(req, res) { try { return success(res, await service.list(req.query)); } catch (err) { return error(res, err.message, 400); } }
async function getById(req, res) { try { return success(res, await service.getById(req.params.type, req.params.id)); } catch (err) { return error(res, err.message, 400); } }
async function markChecked(req, res) { try { return success(res, await service.markChecked(req.params.type, req.params.id, req.body), "Updated"); } catch (err) { return error(res, err.message, 400); } }

module.exports = { list, getById, markChecked };
