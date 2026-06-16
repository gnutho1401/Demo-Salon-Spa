const service = require("./adminCategories.service");
const { success, error } = require("../../utils/response");

async function list(req, res) { try { return success(res, await service.list()); } catch (err) { return error(res, err.message, 400); } }
async function getById(req, res) { try { return success(res, await service.getById(req.params.id)); } catch (err) { return error(res, err.message, 400); } }
async function create(req, res) { try { return success(res, await service.create(req.body), "Created", 201); } catch (err) { return error(res, err.message, 400); } }
async function update(req, res) { try { return success(res, await service.update(req.params.id, req.body), "Updated"); } catch (err) { return error(res, err.message, 400); } }
async function remove(req, res) { try { return success(res, await service.remove(req.params.id), "Deleted"); } catch (err) { return error(res, err.message, 400); } }
async function toggleActive(req, res) { try { return success(res, await service.toggleActive(req.params.id), "Updated"); } catch (err) { return error(res, err.message, 400); } }

module.exports = { list, getById, create, update, remove, toggleActive };
