const service = require("./packages.service");
const { success, error } = require("../../utils/response");

async function getAll(req, res) {
  try {
    return success(res, await service.getAll(req.query));
  } catch (err) {
    return error(res, err.message);
  }
}
async function getCategories(req, res) {
  try {
    return success(res, await service.getCategories());
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
async function getUsageHistory(req, res) {
  try {
    return success(
      res,
      await service.getUsageHistory(
        req.user.userId,
        req.params.customerPackageId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function getUsageHistoryPaginated(req, res) {
  try {
    const { page, limit } = req.query;
    return success(
      res,
      await service.getUsageHistoryPaginated(
        req.user.userId,
        req.params.customerPackageId,
        page,
        limit,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function getById(req, res) {
  try {
    return success(res, await service.getById(req.params.id));
  } catch (err) {
    return error(res, err.message, 404);
  }
}
async function buyPackage(req, res) {
  try {
    return success(
      res,
      await service.buyPackage(req.user.userId, req.params.id, req.body),
      "Mua combo / liệu trình thành công",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function createVnpayPackage(req, res) {
  try {
    const ip =
      req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    return success(
      res,
      await service.createVnpayPackageUrl(
        req.user.userId,
        req.params.id,
        req.body,
        ip,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function vnpayReturn(req, res) {
  try {
    return res.redirect(await service.handleVnpayReturn(req.query));
  } catch (err) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/packages?error=${encodeURIComponent(err.message)}`,
    );
  }
}
async function createPayosPackage(req, res) {
  try {
    return success(
      res,
      await service.createPayosPackageUrl(
        req.user.userId,
        req.params.id,
        req.body,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}
async function payosReturn(req, res) {
  try {
    return res.redirect(await service.handlePayosReturn(req.query));
  } catch (err) {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/packages?error=${encodeURIComponent(err.message)}`,
    );
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

/* ===========================================================
   ENTERPRISE PACKAGE MANAGEMENT CONTROLLERS
   =========================================================== */

async function requestExtension(req, res) {
  try {
    const { days, reason } = req.body;
    return success(
      res,
      await service.requestExtension(
        req.user.userId,
        req.params.customerPackageId,
        days,
        reason,
      ),
      "Yêu cầu gia hạn đã được gửi",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function requestFreeze(req, res) {
  try {
    const { startDate, reason } = req.body;
    return success(
      res,
      await service.requestFreeze(
        req.user.userId,
        req.params.customerPackageId,
        startDate,
        reason,
      ),
      "Yêu cầu đóng băng đã được gửi",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function unfreezePackage(req, res) {
  try {
    return success(
      res,
      await service.unfreezePackage(
        req.user.userId,
        req.params.customerPackageId,
      ),
      "Hủy đóng băng thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function addFamilyMember(req, res) {
  try {
    const { phoneOrEmail, relationship } = req.body;
    return success(
      res,
      await service.addFamilyMember(
        req.user.userId,
        req.params.customerPackageId,
        phoneOrEmail,
        relationship,
      ),
      "Thêm thành viên gia đình thành công",
      201,
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function removeFamilyMember(req, res) {
  try {
    return success(
      res,
      await service.removeFamilyMember(
        req.user.userId,
        req.params.customerPackageId,
        req.params.memberId,
      ),
      "Đã xóa thành viên",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getUsageHistoryPaginated(req, res) {
  try {
    const { page, limit } = req.query;
    return success(
      res,
      await service.getUsageHistoryPaginated(
        req.user.userId,
        req.params.customerPackageId,
        page,
        limit,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getMyPackageDetail(req, res) {
  try {
    let userId = req.user.userId;
    let customerId = null;
    const userRole = String(req.user?.role || "").toUpperCase();
    if (["RECEPTIONIST", "ADMIN", "MANAGER"].includes(userRole) && req.query.customerId) {
      customerId = Number(req.query.customerId);
    }
    return success(
      res,
      await service.getMyPackageDetail(
        userId,
        req.params.customerPackageId,
        customerId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getApprovals(req, res) {
  try {
    return success(res, await service.getApprovals(req.query));
  } catch (err) {
    return error(res, err.message);
  }
}

async function approveRequest(req, res) {
  try {
    const { requestType, action } = req.body;
    return success(
      res,
      await service.approveRequest(
        req.user.userId,
        requestType,
        req.params.requestId,
        action,
      ),
      "Xử lý yêu cầu thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function repayCustomerPackage(req, res) {
  try {
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    return success(
      res,
      await service.createVnpayRepayUrl(
        req.user.userId,
        req.params.customerPackageId,
        ipAddr,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getPackageReport(req, res) {
  try {
    return success(res, await service.getPackageReport(req.query));
  } catch (err) {
    return error(res, err.message);
  }
}

async function findMember(req, res) {
  try {
    const { q } = req.query;
    return success(res, await service.findMember(q, req.user.userId));
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function repayCustomerPackage(req, res) {
  try {
    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    return success(
      res,
      await service.createVnpayRepayUrl(
        req.user.userId,
        req.params.customerPackageId,
        ipAddr,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function repayPayosCustomerPackage(req, res) {
  try {
    return success(
      res,
      await service.createPayosRepayUrl(
        req.user.userId,
        req.params.customerPackageId,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function getComboHistoryAndReviews(req, res) {
  try {
    const { connectDB, sql } = require("../../config/db");
    const pool = await connectDB();
    const custRes = await pool.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`SELECT CustomerId FROM Customers WHERE UserId = @UserId`);
    const customerId = custRes.recordset[0]?.CustomerId;
    if (!customerId) throw new Error("Không tìm thấy thông tin khách hàng");

    const data = await service.getComboHistoryAndReviews(customerId);
    return success(res, data);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function bookCustomerPackage(req, res) {
  try {
    const data = await service.bookCustomerPackage(
      req.user.userId,
      req.params.customerPackageId,
      req.body
    );
    return success(res, data, "Đặt lịch hẹn sử dụng Combo thành công", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function rescheduleCustomerPackageAppointment(req, res) {
  try {
    const data = await service.rescheduleCustomerPackageAppointment(
      req.user.userId,
      req.params.customerPackageId,
      req.body
    );
    return success(res, data, "Đổi lịch hẹn Combo thành công", 200);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function submitComboReview(req, res) {
  try {
    const { connectDB, sql } = require("../../config/db");
    const pool = await connectDB();
    const custRes = await pool.request()
      .input("UserId", sql.Int, req.user.userId)
      .query(`SELECT CustomerId FROM Customers WHERE UserId = @UserId`);
    const customerId = custRes.recordset[0]?.CustomerId;
    if (!customerId) throw new Error("Không tìm thấy thông tin khách hàng");

    const imageUrls = (req.files || []).map((file) => file.path || file.filename);
    let stepReviews = req.body.stepReviews;
    if (typeof stepReviews === "string") {
      try {
        stepReviews = JSON.parse(stepReviews);
      } catch (_) {}
    }

    const data = await service.submitComboReview({
      customerId,
      appointmentId: req.body.appointmentId,
      overallRating: req.body.overallRating,
      overallComment: req.body.overallComment,
      stepReviews,
      imageUrls
    });
    return success(res, data, "Gửi đánh giá Combo thành công", 201);
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function cancelCustomerPackageAppointment(req, res) {
  try {
    const { customerPackageId } = req.params;
    const { reason, appointmentId } = req.body || {};
    const data = await service.cancelCustomerPackageAppointment(
      req.user.userId,
      customerPackageId,
      reason,
      appointmentId,
    );
    return success(res, data, "Hủy lịch hẹn Combo thành công");
  } catch (err) {
    return error(res, err.message, 400);
  }
}

module.exports = {

  getAll,
  getCategories,
  getMine,
  getUsageHistory,
  getById,
  buyPackage,
  createVnpayPackage,
  vnpayReturn,
  createPayosPackage,
  payosReturn,
  create,
  update,
  remove,
  requestExtension,
  requestFreeze,
  unfreezePackage,
  addFamilyMember,
  removeFamilyMember,
  getUsageHistoryPaginated,
  getMyPackageDetail,
  getApprovals,
  approveRequest,
  getPackageReport,
  findMember,
  repayCustomerPackage,
  repayPayosCustomerPackage,
  bookCustomerPackage,
  rescheduleCustomerPackageAppointment,
  cancelCustomerPackageAppointment,
  getComboHistoryAndReviews,
  submitComboReview
};





