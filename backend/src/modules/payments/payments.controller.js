const service = require('./payments.service');
const { success, error } = require('../../utils/response');

async function getAll(req, res) { try { return success(res, await service.getAll()); } catch (err) { return error(res, err.message); } }
async function getMine(req, res) { try { return success(res, await service.getMine(req.user.userId)); } catch (err) { return error(res, err.message); } }
async function createVnpayPayment(req, res) {
  try {
    const ipAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    return success(res, await service.createVnpayPaymentUrl(req.user.userId, req.params.appointmentId, req.body, ipAddr));
  } catch (err) { return error(res, err.message, 400); }
}
async function vnpayReturn(req, res) { try { return res.redirect(await service.handleVnpayReturn(req.query)); } catch (err) { return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/payment-result?status=failed&message=${encodeURIComponent(err.message)}`); } }
async function vnpayIpn(req, res) { try { const result = await service.handleVnpayIpn(req.query); return res.status(200).json({ RspCode: result.code || '00', Message: result.message || 'Confirm Success' }); } catch (err) { return res.status(200).json({ RspCode: '99', Message: err.message || 'Unknown error' }); } }
async function momoReturn(req, res) { return service.momoReturn(req, res); }
async function momoIpn(req, res) { return service.momoIpn(req, res); }
async function refundMomoPayment(req, res) {
  try { return success(res, await service.refundMomoPayment(req.params.id, req.user.userId)); } catch (err) { return error(res, err.message, 400); }
}
async function getById(req, res) { try { return success(res, await service.getById(req.params.id)); } catch (err) { return error(res, err.message); } }
async function create(req, res) { try { return success(res, await service.create(req.body), 'Created', 201); } catch (err) { return error(res, err.message, 400); } }
async function update(req, res) { try { return success(res, await service.update(req.params.id, req.body), 'Updated'); } catch (err) { return error(res, err.message, 400); } }
async function remove(req, res) { try { return success(res, await service.remove(req.params.id), 'Deleted'); } catch (err) { return error(res, err.message, 400); } }
module.exports = { getAll, getMine, createVnpayPayment, vnpayReturn, vnpayIpn, momoReturn, momoIpn, refundMomoPayment, getById, create, update, remove };
