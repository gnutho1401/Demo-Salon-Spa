const service = require('./packages.service');
const { success, error } = require('../../utils/response');

async function getAll(req, res) { try { return success(res, await service.getAll(req.query)); } catch (err) { return error(res, err.message); } }
async function getCategories(req, res) { try { return success(res, await service.getCategories()); } catch (err) { return error(res, err.message); } }
async function getMine(req, res) { try { return success(res, await service.getMine(req.user.userId)); } catch (err) { return error(res, err.message, 400); } }
async function getById(req, res) { try { return success(res, await service.getById(req.params.id)); } catch (err) { return error(res, err.message, 404); } }
async function buyPackage(req, res) { try { return success(res, await service.buyPackage(req.user.userId, req.params.id, req.body), 'Mua combo / liệu trình thành công', 201); } catch (err) { return error(res, err.message, 400); } }
async function createVnpayPackage(req, res) { try { const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1'; return success(res, await service.createVnpayPackageUrl(req.user.userId, req.params.id, req.body, ip)); } catch (err) { return error(res, err.message, 400); } }
async function vnpayReturn(req, res) { try { return res.redirect(await service.handleVnpayReturn(req.query)); } catch (err) { return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/packages?error=${encodeURIComponent(err.message)}`); } }
async function create(req, res) { try { return success(res, await service.create(req.body), 'Created', 201); } catch (err) { return error(res, err.message, 400); } }
async function update(req, res) { try { return success(res, await service.update(req.params.id, req.body), 'Updated'); } catch (err) { return error(res, err.message, 400); } }
async function remove(req, res) { try { return success(res, await service.remove(req.params.id), 'Deleted'); } catch (err) { return error(res, err.message, 400); } }

module.exports = { getAll, getCategories, getMine, getById, buyPackage, createVnpayPackage, vnpayReturn, create, update, remove };
