const service = require("./hair.service");
const { success, error } = require("../../../utils/response");

async function getStyles(req, res) {
  try {
    const styles = await service.getStyles({
      audience: req.query?.audience,
      trending: req.query?.trending,
    });
    return success(res, styles, "Lấy danh mục mẫu tóc thành công");
  } catch (err) {
    console.error("[AI Hair Styles Error]:", err.message);
    return error(res, err.message, 500);
  }
}

async function tryOn(req, res) {
  try {
    const { image_url: imageUrl, prompt, style_id: styleId } = req.body || {};
    if (!imageUrl) return error(res, "Vui lòng tải lên ảnh chân dung.", 400);
    if (!prompt && !styleId) return error(res, "Vui lòng chọn mẫu tóc hoặc nhập mô tả mong muốn.", 400);

    const result = await service.createTryOn({
      userId: req.user.userId,
      imageUrl,
      prompt,
      styleId,
    });
    return success(res, result, "AI local đã áp dụng kiểu tóc thật lên ảnh", 201);
  } catch (err) {
    console.error("[AI Hair Try-on Error]:", err.message);
    const clientError = /^(Vui lòng|Ảnh chân dung|Chỉ hỗ trợ ảnh|Ảnh vượt quá|Ảnh đầu vào|URL ảnh không an toàn|Tài khoản chưa được liên kết|Mẫu tóc đã chọn)/i.test(err.message);
    return error(res, err.message, clientError ? 400 : 502);
  }
}

async function getHistory(req, res) {
  try {
    return success(res, await service.getHistory(req.user.userId), "Lấy lịch sử thử tóc thành công");
  } catch (err) {
    console.error("[AI Hair History Error]:", err.message);
    return error(res, err.message, 500);
  }
}

async function getImage(req, res) {
  try {
    const variant = String(req.params.variant || "").toLowerCase();
    if (!["source", "result"].includes(variant)) return error(res, "Loại ảnh không hợp lệ.", 400);
    const image = await service.getImage(req.user.userId, req.params.id, variant);
    res.set({
      "Content-Type": image.mimeType,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `inline; filename=hair-tryon-${req.params.id}-${variant}`,
    });
    return res.send(image.buffer);
  } catch (err) {
    console.error("[AI Hair Image Error]:", err.message);
    return error(res, err.message, /Không tìm thấy|không có quyền/i.test(err.message) ? 404 : 500);
  }
}

async function setFavorite(req, res) {
  try {
    return success(
      res,
      await service.setFavorite(req.user.userId, req.params.id, req.body?.is_favorite),
      "Đã cập nhật mẫu tóc yêu thích",
    );
  } catch (err) {
    return error(res, err.message, 404);
  }
}

async function remove(req, res) {
  try {
    return success(res, await service.removeTryOn(req.user.userId, req.params.id), "Đã xóa ảnh thử tóc");
  } catch (err) {
    return error(res, err.message, 404);
  }
}

module.exports = { getStyles, tryOn, getHistory, getImage, setFavorite, remove };
