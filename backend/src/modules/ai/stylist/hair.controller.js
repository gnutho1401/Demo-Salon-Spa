const service = require('./hair.service');
const { success, error } = require('../../../utils/response');

async function tryOn(req, res) {
  try {
    const { image_url, prompt } = req.body;
    if (!image_url) {
      return error(res, 'Vui lòng cung cấp hình ảnh chân dung (image_url)', 400);
    }
    if (!prompt) {
      return error(res, 'Vui lòng cung cấp mô tả kiểu tóc/màu nhuộm (prompt)', 400);
    }

    const result = await service.editHair(image_url, prompt);
    return success(res, result, 'Biến đổi kiểu tóc thành công');
  } catch (err) {
    console.error('[AI Hair Controller Error]:', err.message);
    return error(res, err.message, 500);
  }
}

module.exports = { tryOn };
