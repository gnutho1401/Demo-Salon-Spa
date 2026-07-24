const AppointmentStatus = {
  BOOKED: "BOOKED",
  CONFIRMED: "CONFIRMED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  // Map legacy/DB-specific states to the standard 6 state machine states
  PENDING: "BOOKED",
  PENDING_PAYMENT: "BOOKED",
  PAID: "BOOKED",
  CHECKED_IN: "CONFIRMED",
  CHECKED_OUT: "COMPLETED",
};

const VALID_TRANSITIONS = {
  BOOKED: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/**
 * Maps a status string (including legacy ones) to the core state machine enum.
 */
function mapStatus(status) {
  if (!status) return "BOOKED";
  const s = String(status).trim().toUpperCase();
  if (AppointmentStatus[s]) {
    return AppointmentStatus[s];
  }
  return s;
}

/**
 * Validates a transition from currentStatus to targetStatus.
 * Throws an Error if transition is blocked/invalid.
 */
function validateTransition(currentStatus, targetStatus) {
  const current = mapStatus(currentStatus);
  const target = mapStatus(targetStatus);

  if (!VALID_TRANSITIONS[current]) {
    throw new Error(`Trạng thái hiện tại không hợp lệ: ${currentStatus}`);
  }

  if (!VALID_TRANSITIONS[current].includes(target)) {
    throw new Error(
      `Chuyển trạng thái không hợp lệ: Không thể chuyển từ ${currentStatus} sang ${targetStatus}`,
    );
  }
}

module.exports = {
  AppointmentStatus,
  validateTransition,
  mapStatus,
};
