const service = require('./waiting-list.service');
const { success, error } = require('../../utils/response');

async function getMine(req, res) { try { return success(res, await service.getMine(req.user.userId)); } catch (err) { return error(res, err.message, 400); } }
async function create(req, res) { try { return success(res, await service.create(req.user.userId, req.body), 'Đã thêm vào hàng chờ', 201); } catch (err) { return error(res, err.message, 400); } }
async function cancel(req, res) { try { return success(res, await service.cancel(req.user.userId, req.params.id), 'Đã hủy hàng chờ'); } catch (err) { return error(res, err.message, 400); } }
module.exports = { getMine, create, cancel };
