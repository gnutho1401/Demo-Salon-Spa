const skinService = require('./skin.service');
const { success, error } = require('../../../utils/response');

async function analyze(req, res) {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return error(res, 'Vui lòng cung cấp link hình ảnh da mặt hoặc ảnh dạng base64.', 400);
    }
    const result = await skinService.analyzeSkin(req.user.userId, imageUrl);
    return success(res, result, 'Phân tích làn da thành công');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getHistory(req, res) {
  try {
    const list = await skinService.getHistory(req.user.userId);
    return success(res, list, 'Lấy lịch sử phân tích da thành công');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {
  analyze,
  getHistory
};
