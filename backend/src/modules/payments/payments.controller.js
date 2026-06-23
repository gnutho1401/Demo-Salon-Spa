const service = require("./payments.service");
const { success, error } = require("../../utils/response");

async function getAll(req, res) {
  try {
    return success(res, await service.getAll());
  } catch (err) {
    return error(res, err.message);
  }
}

async function getMine(req, res) {
  try {
    return success(res, await service.getMyPayments(req.user.userId));
  } catch (err) {
    return error(res, err.message);
  }
}

async function createVnpayPayment(req, res) {
  try {
    return success(
      res,
      await service.createVnpayPaymentUrl(
        req.user.userId,
        req.params.appointmentId,
        req.body,
        req,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function payAppointment(req, res) {
  try {
    return success(
      res,
      await service.payAppointment(
        req.user.userId,
        req.params.appointmentId,
        req.body,
      ),
      "Thanh toán thành công",
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function vnpayReturn(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const result = await service.handleVnpayReturn(req.query);
    const status = result.success ? "success" : "failed";

    return res.redirect(
      `${frontendUrl}/customer/payment-result?status=${status}&appointmentId=${
        result.AppointmentId || ""
      }&paymentId=${result.PaymentId || ""}&message=${encodeURIComponent(
        result.message || "",
      )}&method=vnpay`,
    );
  } catch (err) {
    return res.redirect(
      `${frontendUrl}/customer/payment-result?status=failed&message=${encodeURIComponent(
        err.message,
      )}&method=vnpay`,
    );
  }
}

async function vnpayIpn(req, res) {
  try {
    const result = await service.handleVnpayIpn(req.query);

    return res.status(200).json({
      RspCode: result.code || "00",
      Message: result.message || "Confirm Success",
    });
  } catch (err) {
    return res.status(200).json({
      RspCode: "99",
      Message: err.message || "Unknown error",
    });
  }
}

async function momoReturn(req, res) {
  if (typeof service.momoReturn === "function") {
    return service.momoReturn(req, res);
  }

  return res.redirect(
    `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/payment-result?status=failed&message=${encodeURIComponent(
      "MoMo chưa được cấu hình",
    )}`,
  );
}

async function momoIpn(req, res) {
  if (typeof service.momoIpn === "function") {
    return service.momoIpn(req, res);
  }

  return res.status(200).json({
    RspCode: "99",
    Message: "MoMo chưa được cấu hình",
  });
}

async function refundMomoPayment(req, res) {
  try {
    if (typeof service.refundMomoPayment !== "function") {
      throw new Error("MoMo refund chưa được cấu hình");
    }

    return success(
      res,
      await service.refundMomoPayment(req.params.id, req.user.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

/* =========================================================
   PAYOS HANDLERS
   ========================================================= */

async function createPayosPayment(req, res) {
  try {
    return success(
      res,
      await service.createPayosPaymentUrl(
        req.user.userId,
        req.params.appointmentId,
        req.body,
      ),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function payosReturn(req, res) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const result = await service.handlePayosReturn(req.query);
    const status = result.success ? "success" : "failed";

    return res.redirect(
      `${frontendUrl}/customer/payment-result?status=${status}&appointmentId=${
        result.AppointmentId || ""
      }&paymentId=${result.PaymentId || ""}&message=${encodeURIComponent(
        result.message || "",
      )}&method=payos`,
    );
  } catch (err) {
    return res.redirect(
      `${frontendUrl}/customer/payment-result?status=failed&message=${encodeURIComponent(
        err.message,
      )}&method=payos`,
    );
  }
}

async function payosWebhook(req, res) {
  try {
    const result = await service.processPayosWebhook(req.body);

    return res.status(200).json({
      code: result.code || "00",
      message: result.message || "OK",
    });
  } catch (err) {
    console.error("PayOS webhook error:", err);
    return res.status(200).json({
      code: "99",
      message: err.message || "Unknown error",
    });
  }
}

async function cancelPayos(req, res) {
  try {
    return success(
      res,
      await service.cancelPayosPayment(req.params.id, req.user.userId),
    );
  } catch (err) {
    return error(res, err.message, 400);
  }
}

async function refundPayos(req, res) {
  try {
    return success(
      res,
      await service.refundPayosPayment(
        req.params.id,
        req.user.userId,
        req.body.reason || req.body.Reason || "",
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

module.exports = {
  getAll,
  getMine,
  createVnpayPayment,
  payAppointment,
  vnpayReturn,
  vnpayIpn,
  momoReturn,
  momoIpn,
  refundMomoPayment,
  createPayosPayment,
  payosReturn,
  payosWebhook,
  cancelPayos,
  refundPayos,
  getById,
  create,
  update,
  remove,
};

