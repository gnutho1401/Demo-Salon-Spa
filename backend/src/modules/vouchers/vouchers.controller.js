const service = require("./vouchers.service");
const { success, error } = require("../../utils/response");

async function getAllActive(req, res) {
  try {
    return success(res, await service.getAllActive());
  } catch (err) {
    return error(res, err.message);
  }
}
async function getMine(req, res) {
  try {
    let userId = req.user.userId;
    let customerId = null;
    const userRole = String(req.user?.role || "").toUpperCase();
    if (["RECEPTIONIST", "ADMIN", "MANAGER"].includes(userRole) && req.query.customerId) {
      customerId = Number(req.query.customerId);
    }
    return success(res, await service.getMine(userId, customerId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function saveVoucher(req, res) {
  try {
    return success(
      res,
      await service.saveVoucher(req.user.userId, req.params.id),
      "Lưu voucher thành công",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function validateVoucher(req, res) {
  try {
    let userId = req.user.UserId || req.user.userId || req.user.id;
    let customerId = null;
    const userRole = String(req.user?.role || "").toUpperCase();
    if (["RECEPTIONIST", "ADMIN", "MANAGER"].includes(userRole) && req.body.customerId) {
      customerId = Number(req.body.customerId);
    }
    const data = await service.validateVoucher(userId, req.body, customerId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message || "Voucher không hợp lệ",
    });
  }
}
module.exports = { getAllActive, getMine, saveVoucher, validateVoucher };
