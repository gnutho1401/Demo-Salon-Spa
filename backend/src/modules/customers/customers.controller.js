const service = require('./customers.service');
const { success, error } = require('../../utils/response');

async function getAll(req, res) {
  try { return success(res, await service.getAll()); } catch (err) { return error(res, err.message); }
}

async function getById(req, res) {
  try { return success(res, await service.getById(req.params.id)); } catch (err) { return error(res, err.message); }
}

async function getMyProfile(req, res) {
  try { return success(res, await service.getMyProfile(req.user.userId)); }
  catch (err) { return error(res, err.message, 400); }
}


async function getMyDashboard(req, res) {
  try { return success(res, await service.getMyDashboard(req.user.userId)); }
  catch (err) { return error(res, err.message, 400); }
}

async function createMyFeedback(req, res) {
  try { return success(res, await service.createMyFeedback(req.user.userId, req.body), 'Gửi phản hồi thành công', 201); }
  catch (err) { return error(res, err.message, 400); }
}

async function getMyFeedbacks(req, res) {
  try { return success(res, await service.getMyFeedbacks(req.user.userId)); }
  catch (err) { return error(res, err.message, 400); }
}

async function createMyReview(req, res) {
  try { return success(res, await service.createMyReview(req.user.userId, req.body), 'Gửi đánh giá thành công', 201); }
  catch (err) { return error(res, err.message, 400); }
}

async function getMyReviews(req, res) {
  try { return success(res, await service.getMyReviews(req.user.userId)); }
  catch (err) { return error(res, err.message, 400); }
}

async function getMyReviewableServices(req, res) {
  try { return success(res, await service.getMyReviewableServices(req.user.userId)); }
  catch (err) { return error(res, err.message, 400); }
}

async function updateMyProfile(req, res) {
  try { return success(res, await service.updateMyProfile(req.user.userId, req.body), 'Cập nhật hồ sơ thành công'); }
  catch (err) { return error(res, err.message, 400); }
}

async function updateMyAvatar(req, res) {
  try {
    if (!req.file) return error(res, 'Vui lòng chọn ảnh đại diện', 400);
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    return success(res, await service.updateMyAvatar(req.user.userId, avatarUrl), 'Cập nhật ảnh đại diện thành công');
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function createGuestContact(req, res) {
  try { return success(res, await service.createGuestContact(req.body), 'Gửi liên hệ thành công', 201); }
  catch (err) { return error(res, err.message, 400); }
}

async function create(req, res) {
  try { return success(res, await service.create(req.body), 'Created', 201); } catch (err) { return error(res, err.message, 400); }
}

async function update(req, res) {
  try { return success(res, await service.update(req.params.id, req.body), 'Updated'); } catch (err) { return error(res, err.message, 400); }
}

async function remove(req, res) {
  try { return success(res, await service.remove(req.params.id), 'Deleted'); } catch (err) { return error(res, err.message, 400); }
}

module.exports = { getAll, getById, getMyProfile, getMyDashboard, createMyFeedback, getMyFeedbacks, createMyReview, getMyReviews, getMyReviewableServices, updateMyProfile, updateMyAvatar, createGuestContact, create, update, remove };
