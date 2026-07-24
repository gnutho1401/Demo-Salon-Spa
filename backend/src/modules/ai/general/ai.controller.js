const service = require("./ai.service");
const { success, error } = require("../../../utils/response");

async function getAll(req, res) {
  try {
    return success(res, await service.getAll());
  } catch (err) {
    return error(res, err.message);
  }
}
async function getMine(req, res) {
  try {
    return success(res, await service.getMine(req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function chat(req, res) {
  try {
    return success(
      res,
      await service.chat(req.user?.userId, req.body.question),
      "AI đã trả lời",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function getChatHistory(req, res) {
  try {
    return success(res, await service.getChatHistory(req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
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
async function predictChurn(req, res) {
  try {
    return success(res, await service.predictCustomersChurn(req.user.userId));
  } catch (err) {
    return error(res, err.message, 500);
  }
}

async function sendVoucherToCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { voucherId, discountPercent } = req.body;
    if (!voucherId && !discountPercent)
      throw new Error("Vui lòng chọn Voucher hoặc tỷ lệ giảm giá");
    const data = await service.sendVoucherToCustomer(
      customerId,
      voucherId ? Number(voucherId) : null,
      discountPercent ? Number(discountPercent) : null,
    );
    return success(res, data, "Gửi tặng Voucher thành công!");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function sendReminderToCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { message } = req.body;
    if (!message) throw new Error("Vui lòng nhập nội dung tin nhắn chăm sóc");
    const data = await service.sendReminderToCustomer(customerId, message);
    return success(res, data, "Đã gửi tin nhắn chăm sóc thành công!");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function upgradeVipCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const data = await service.upgradeToVIP(customerId);
    return success(res, data, "Nâng cấp VIP thành công!");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function giftFreeServiceToCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { serviceName } = req.body;
    if (!serviceName) throw new Error("Vui lòng chỉ định tên dịch vụ tặng");
    const data = await service.giftFreeService(customerId, serviceName);
    return success(res, data, "Tặng dịch vụ miễn phí thành công!");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function addPointsToCustomer(req, res) {
  try {
    const customerId = Number(req.params.id);
    const { points } = req.body;
    const data = await service.addLoyaltyPoints(
      customerId,
      Number(points || 200),
    );
    return success(res, data, "Cộng điểm tích lũy thành công!");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function clearMyChatHistory(req, res) {
  try {
    const data = await service.clearChatHistory(req.user.userId);
    return success(res, data, "Xóa lịch sử chat thành công");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  getAll,
  getMine,
  chat,
  getChatHistory,
  getById,
  create,
  update,
  remove,
  predictChurn,
  sendVoucherToCustomer,
  sendReminderToCustomer,
  upgradeVipCustomer,
  giftFreeServiceToCustomer,
  addPointsToCustomer,
  clearMyChatHistory,
};
