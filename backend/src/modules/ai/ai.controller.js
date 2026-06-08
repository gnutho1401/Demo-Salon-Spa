const service = require('./ai.service');
const { success, error } = require('../../utils/response');

async function getAll(req, res) { try { return success(res, await service.getAll()); } catch (err) { return error(res, err.message); } }
async function getMine(req, res) { try { return success(res, await service.getMine(req.user.userId)); } catch (err) { return error(res, err.message, 400); } }
async function chat(req, res) { try { return success(res, await service.chat(req.user.userId, req.body.question), 'AI đã trả lời'); } catch (err) { return error(res, err.message, 400); } }
async function getChatHistory(req, res) { try { return success(res, await service.getChatHistory(req.user.userId)); } catch (err) { return error(res, err.message, 400); } }
async function getById(req, res) { try { return success(res, await service.getById(req.params.id)); } catch (err) { return error(res, err.message); } }
async function create(req, res) { try { return success(res, await service.create(req.body), 'Created', 201); } catch (err) { return error(res, err.message, 400); } }
async function update(req, res) { try { return success(res, await service.update(req.params.id, req.body), 'Updated'); } catch (err) { return error(res, err.message, 400); } }
async function remove(req, res) { try { return success(res, await service.remove(req.params.id), 'Deleted'); } catch (err) { return error(res, err.message, 400); } }

module.exports = { getAll, getMine, chat, getChatHistory, getById, create, update, remove };
