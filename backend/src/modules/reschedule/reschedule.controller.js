const service = require("./reschedule.service");

async function createRequest(req, res) {
  try {
    const data = await service.createRequest(req.user.userId, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getTechnicianRequests(req, res) {
  try {
    const data = await service.getTechnicianRequests(req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getReceptionistRequests(req, res) {
  try {
    const data = await service.getReceptionistRequests();
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function approveRequest(req, res) {
  try {
    const data = await service.approveRequest(req.params.id, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function rejectRequest(req, res) {
  try {
    const data = await service.rejectRequest(req.params.id, req.body.notes, req.user.userId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  createRequest,
  getTechnicianRequests,
  getReceptionistRequests,
  approveRequest,
  rejectRequest,
};
