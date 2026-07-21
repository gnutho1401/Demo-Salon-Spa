const { formatTimeOnly } = require('../src/modules/waiting-list/waiting-list.service');

function checkTimeMatch(cand, slot) {
  const startTime = `${slot.startTime}:00`;
  const endTime = `${slot.endTime}:00`;

  let prefFrom = cand.PreferredTimeFrom ? formatTimeOnly(cand.PreferredTimeFrom) : (cand.PreferredTime ? formatTimeOnly(cand.PreferredTime) : null);
  let prefTo = cand.PreferredTimeTo ? formatTimeOnly(cand.PreferredTimeTo) : null;

  const flexSlot = cand.FlexibleTimeSlot ? String(cand.FlexibleTimeSlot).toUpperCase() : "";
  if (!prefFrom && !prefTo) {
    if (flexSlot === "MORNING") {
      prefFrom = "08:00:00";
      prefTo = "12:00:00";
    } else if (flexSlot === "AFTERNOON") {
      prefFrom = "13:00:00";
      prefTo = "17:00:00";
    } else if (flexSlot === "EVENING") {
      prefFrom = "18:00:00";
      prefTo = "20:00:00";
    }
  }

  let isExactTime = false;
  let timeOk = false;

  if (prefFrom && prefTo) {
    if (startTime >= prefFrom && endTime <= prefTo) {
      isExactTime = true;
      timeOk = true;
    }
  } else if (prefFrom) {
    if (startTime.slice(0, 5) === prefFrom.slice(0, 5) || (startTime >= prefFrom && (!prefTo || endTime <= prefTo))) {
      isExactTime = true;
      timeOk = true;
    }
  } else {
    isExactTime = false;
    timeOk = true;
  }

  if (!timeOk && cand.AcceptOtherTimeSlots) {
    timeOk = true;
  }

  return { isExactTime, timeOk };
}

// Test case 1: Candidate selected AFTERNOON, AcceptOtherTimeSlots = false
const afternoonCand = {
  FlexibleTimeSlot: "AFTERNOON",
  PreferredTimeFrom: null,
  PreferredTimeTo: null,
  AcceptOtherTimeSlots: false
};

const morningSlot = { startTime: "08:00", endTime: "09:00" };
const afternoonSlot = { startTime: "14:00", endTime: "15:00" };

console.log("Morning slot check for AFTERNOON candidate:", checkTimeMatch(afternoonCand, morningSlot));
console.log("Afternoon slot check for AFTERNOON candidate:", checkTimeMatch(afternoonCand, afternoonSlot));

// Test case 2: Candidate selected MORNING, AcceptOtherTimeSlots = false
const morningCand = {
  FlexibleTimeSlot: "MORNING",
  PreferredTimeFrom: null,
  PreferredTimeTo: null,
  AcceptOtherTimeSlots: false
};

console.log("Morning slot check for MORNING candidate:", checkTimeMatch(morningCand, morningSlot));
console.log("Afternoon slot check for MORNING candidate:", checkTimeMatch(morningCand, afternoonSlot));
