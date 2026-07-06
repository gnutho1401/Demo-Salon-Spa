const { sql, connectDB } = require("../../config/db");

// Helper to get service details
async function getServiceById(serviceId) {
  const pool = await connectDB();
  const result = await pool.request().input("ServiceId", sql.Int, serviceId)
    .query(`
      SELECT ServiceId, ServiceName, DurationMinutes, Price
      FROM Services
      WHERE ServiceId = @ServiceId
        AND Status = 'AVAILABLE'
    `);

  if (!result.recordset[0]) {
    throw new Error("Dịch vụ không tồn tại hoặc đã ngừng hoạt động");
  }
  return result.recordset[0];
}

// Helper to verify technician capability
async function checkEmployeeCanDoService(employeeId, serviceId) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input("EmployeeId", sql.Int, employeeId)
    .input("ServiceId", sql.Int, serviceId).query(`
      SELECT EmployeeId
      FROM EmployeeServices
      WHERE EmployeeId = @EmployeeId
        AND ServiceId = @ServiceId
    `);

  if (!result.recordset[0]) {
    throw new Error("Kỹ thuật viên này không thực hiện dịch vụ đã chọn");
  }
}

// Helper for date formatting
function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

// Helper for time formatting
function normalizeTimeOnly(value) {
  if (!value) return "00:00:00";
  const text = String(value);
  if (text.includes("T")) {
    return text.split("T")[1].slice(0, 8);
  }
  if (text.length === 5) {
    return text + ":00";
  }
  return text.slice(0, 8);
}

// Helper to add minutes
function addMinutesToTime(time, minutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return date.toTimeString().slice(0, 8);
}

// Parse datetime input to ISO-style parts
function parseDateTime(val) {
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    throw new Error("Ngày giờ không hợp lệ");
  }
  const pad = n => String(n).padStart(2, '0');
  
  if (typeof val === 'string') {
    const parts = val.trim().split(/[\sT]+/);
    if (parts.length >= 2) {
      return { date: parts[0], time: parts[1].slice(0, 8) };
    } else if (parts[0].includes('-')) {
      return { date: parts[0], time: "00:00:00" };
    }
  }

  const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { date: dateStr, time: timeStr };
}

/**
 * Checks whether the technician is available for the requested time slot.
 * Returns true if available, false if busy or outside working hours.
 */
async function checkAvailability(technicianId, startTime, endTime, excludeAppointmentId = null) {
  try {
    await validateAvailability(technicianId, startTime, endTime, excludeAppointmentId);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Validates technician availability. Throws errors explaining why if unavailable.
 */
async function validateAvailability(technicianId, startTime, endTime, excludeAppointmentId = null) {
  const pool = await connectDB();
  const startParsed = parseDateTime(startTime);
  const endParsed = parseDateTime(endTime);

  const date = startParsed.date;
  const reqStart = startParsed.time;
  const reqEnd = endParsed.time;

  if (reqStart >= reqEnd) {
    throw new Error("Thời gian bắt đầu phải trước thời gian kết thúc");
  }

  // 1. Check salon open hours only (08:00 - 22:00)
  // Shift registration is for internal attendance management only, not for booking control.
  const SALON_OPEN  = "08:00:00";
  const SALON_CLOSE = "22:00:00";
  if (reqStart < SALON_OPEN || reqEnd > SALON_CLOSE) {
    throw new Error(`Thời gian hẹn nằm ngoài giờ mở cửa của salon (08:00 - 22:00)`);
  }

  // 2. Check overlap in Appointments
  const overlapResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(technicianId))
    .input("AppointmentDate", sql.Date, date)
    .input("StartTime", sql.VarChar, reqStart)
    .input("EndTime", sql.VarChar, reqEnd)
    .input("ExcludeAppointmentId", sql.Int, excludeAppointmentId ? Number(excludeAppointmentId) : null)
    .query(`
      SELECT AppointmentId,
             CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
             CONVERT(VARCHAR(8), EndTime, 108) AS EndTime
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @AppointmentDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED', 'REFUND_PENDING')
        AND (@StartTime < CONVERT(VARCHAR(8), EndTime, 108) AND @EndTime > CONVERT(VARCHAR(8), StartTime, 108))
        AND (CAST(@ExcludeAppointmentId AS INT) IS NULL OR AppointmentId <> CAST(@ExcludeAppointmentId AS INT))
    `);

  if (overlapResult.recordset.length > 0) {
    throw new Error("Kỹ thuật viên đã có lịch hẹn trùng lặp trong khung giờ này");
  }

  // 3. Check overlap in active WaitingList matching holds
  const heldResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(technicianId))
    .input("AppointmentDate", sql.Date, date)
    .input("StartTime", sql.VarChar, reqStart)
    .input("EndTime", sql.VarChar, reqEnd)
    .query(`
      SELECT TOP 1 1 AS Held
      FROM WaitingList
      WHERE MatchedEmployeeId = @EmployeeId
        AND MatchedDate = @AppointmentDate
        AND Status = 'MATCHED'
        AND HoldExpiresAt > GETUTCDATE()
        AND (
          @StartTime < CONVERT(VARCHAR(8), MatchedEndTime, 108)
          AND @EndTime > CONVERT(VARCHAR(8), MatchedStartTime, 108)
        )
    `);

  if (heldResult.recordset[0]) {
    throw new Error("Khung giờ này đang được giữ chỗ cho khách hàng từ hàng chờ");
  }
}

// Generate time slots list for a technician
async function calculateSlotsInternal({
  employeeId,
  serviceId,
  appointmentDate,
  excludeAppointmentId = null,
  includeAllSlots = false,
}) {
  const selectedService = await getServiceById(Number(serviceId));
  await checkEmployeeCanDoService(Number(employeeId), Number(serviceId));

  const pool = await connectDB();

  const shiftsRes = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("AppointmentDate", sql.Date, appointmentDate).query(`
      SELECT 
        CONVERT(VARCHAR(8), ws.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), ws.EndTime, 108) AS EndTime
      FROM ShiftRegistrations sr
      JOIN WorkShifts ws ON sr.ShiftId = ws.ShiftId
      WHERE sr.TechnicianId = @EmployeeId
        AND sr.Status = 'APPROVED'
        AND ws.ShiftDate = @AppointmentDate
    `);

  const shifts = shiftsRes.recordset;
  let shiftStart = "08:00:00";
  let shiftEnd = "18:00:00";

  if (shifts.length > 0) {
    shifts.sort((a, b) => a.StartTime.localeCompare(b.StartTime));
    shiftStart = shifts[0].StartTime;
    const endTimes = shifts.map(s => s.EndTime);
    endTimes.sort();
    shiftEnd = endTimes[endTimes.length - 1];
  }

  const bookedResult = await pool
    .request()
    .input("EmployeeId", sql.Int, Number(employeeId))
    .input("AppointmentDate", sql.Date, appointmentDate)
    .input(
      "ExcludeAppointmentId",
      sql.Int,
      excludeAppointmentId ? Number(excludeAppointmentId) : null,
    ).query(`
      SELECT
        CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), EndTime, 108) AS EndTime
      FROM Appointments
      WHERE EmployeeId = @EmployeeId
        AND AppointmentDate = @AppointmentDate
        AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED', 'REFUND_PENDING')
        AND (CAST(@ExcludeAppointmentId AS INT) IS NULL OR AppointmentId <> CAST(@ExcludeAppointmentId AS INT))
      UNION ALL
      SELECT
        CONVERT(VARCHAR(8), MatchedStartTime, 108) AS StartTime,
        CONVERT(VARCHAR(8), MatchedEndTime, 108) AS EndTime
      FROM WaitingList
      WHERE MatchedEmployeeId = @EmployeeId
        AND MatchedDate = @AppointmentDate
        AND Status = 'MATCHED'
        AND HoldExpiresAt > GETUTCDATE()
    `);

  const booked = bookedResult.recordset.map((item) => ({
    start: item.StartTime,
    end: item.EndTime,
  }));

  const slots = [];
  let current = shiftStart.slice(0, 5);

  while (current < shiftEnd.slice(0, 5)) {
    const slotStart = current + ":00";
    const slotEnd = addMinutesToTime(
      slotStart,
      selectedService.DurationMinutes,
    );

    if (slotEnd <= shiftEnd) {
      const isInRegisteredShift = shifts.length === 0
        ? (slotStart >= "08:00:00" && slotEnd <= "18:00:00")
        : shifts.some(s => slotStart >= s.StartTime && slotEnd <= s.EndTime);

      if (isInRegisteredShift) {
        const isBusy = booked.some((b) => slotStart < b.end && slotEnd > b.start);
      const dateText = normalizeDateOnly(appointmentDate);
      const slotDateTime = new Date(
        `${dateText}T${slotStart.slice(0, 5)}:00`,
      );
      const isPast = slotDateTime.getTime() <= Date.now();
      const available = !isBusy && !isPast;

      if (available || includeAllSlots) {
        slots.push({
          startTime: slotStart.slice(0, 5),
          endTime: slotEnd.slice(0, 5),
          available: available,
        });
      }
    }
    }

    current = addMinutesToTime(slotStart, 30).slice(0, 5);
  }

  return slots;
}

// Generate slot alternatives for other technicians
async function getSlotAlternatives(employeeId, serviceId, appointmentDate, limit = 6) {
  const pool = await connectDB();
  const alternatives = [];

  const prefEmpResult = await pool.request().input("EmployeeId", sql.Int, employeeId).query(`
    SELECT e.EmployeeId, u.FullName, COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl
    FROM Employees e
    INNER JOIN Users u ON e.UserId = u.UserId
    WHERE e.EmployeeId = @EmployeeId
  `);
  const preferredEmployee = prefEmpResult.recordset[0] || { FullName: "Kỹ thuật viên" };

  try {
    const otherTechsResult = await pool.request()
      .input("ServiceId", sql.Int, serviceId)
      .input("PrefEmployeeId", sql.Int, employeeId)
      .query(`
        SELECT DISTINCT e.EmployeeId, u.FullName, COALESCE(e.ImageUrl, u.AvatarUrl) AS ImageUrl
        FROM Employees e
        INNER JOIN Users u ON e.UserId = u.UserId
        INNER JOIN EmployeeServices es ON e.EmployeeId = es.EmployeeId
        WHERE es.ServiceId = @ServiceId
          AND e.EmployeeId <> @PrefEmployeeId
          AND e.Status = 'ACTIVE'
      `);

    const techs = otherTechsResult.recordset;

    // 1. Same day, other technicians
    for (const tech of techs) {
      if (alternatives.length >= limit) break;
      try {
        const techSlots = await calculateSlotsInternal({
          employeeId: tech.EmployeeId,
          serviceId,
          appointmentDate,
        });
        for (const slot of techSlots) {
          if (alternatives.length >= limit) break;
          if (slot.available !== false) {
            alternatives.push({
              type: 1,
              label: `Hôm nay với KTV ${tech.FullName}`,
              employeeId: tech.EmployeeId,
              employeeName: tech.FullName,
              imageUrl: tech.ImageUrl,
              date: appointmentDate,
              startTime: slot.startTime,
              endTime: slot.endTime,
            });
          }
        }
      } catch (err) {
        // Skip errors
      }
    }

    // 2. Future days (next 7 days), preferred technician
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      if (alternatives.length >= limit) break;
      const futureDate = new Date(appointmentDate);
      futureDate.setDate(futureDate.getDate() + dayOffset);
      const futureDateString = futureDate.toISOString().slice(0, 10);

      try {
        const slots = await calculateSlotsInternal({
          employeeId,
          serviceId,
          appointmentDate: futureDateString,
        });

        for (const slot of slots) {
          if (alternatives.length >= limit) break;
          if (slot.available !== false) {
            alternatives.push({
              type: 2,
              label: `${futureDate.toLocaleDateString("vi-VN", { weekday: 'short', day: 'numeric', month: 'numeric' })} với KTV ${preferredEmployee.FullName}`,
              employeeId,
              employeeName: preferredEmployee.FullName,
              imageUrl: preferredEmployee.ImageUrl,
              date: futureDateString,
              startTime: slot.startTime,
              endTime: slot.endTime,
            });
          }
        }
      } catch (err) {
        // Skip errors
      }
    }

    // 3. Future days (next 7 days), other technicians
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      if (alternatives.length >= limit) break;
      const futureDate = new Date(appointmentDate);
      futureDate.setDate(futureDate.getDate() + dayOffset);
      const futureDateString = futureDate.toISOString().slice(0, 10);

      for (const tech of techs) {
        if (alternatives.length >= limit) break;
        try {
          const slots = await calculateSlotsInternal({
            employeeId: tech.EmployeeId,
            serviceId,
            appointmentDate: futureDateString,
          });

          for (const slot of slots) {
            if (alternatives.length >= limit) break;
            if (slot.available !== false) {
              alternatives.push({
                type: 3,
                label: `${futureDate.toLocaleDateString("vi-VN", { weekday: 'short', day: 'numeric', month: 'numeric' })} với KTV ${tech.FullName}`,
                employeeId: tech.EmployeeId,
                employeeName: tech.FullName,
                imageUrl: tech.ImageUrl,
                date: futureDateString,
                startTime: slot.startTime,
                endTime: slot.endTime,
              });
            }
          }
        } catch (err) {
          // Skip errors
        }
      }
    }
  } catch (err) {
    console.error("[availability] Failed to get slot alternatives:", err.message);
  }

  return alternatives;
}

/**
 * Returns available slots for a day (production-grade query handling).
 */
async function getAvailableSlots(query) {
  const { employeeId, serviceId, appointmentDate, excludeAppointmentId, includeAlternatives, includeAllSlots } = query || {};
  if (!employeeId) throw new Error("Vui lòng chọn kỹ thuật viên");
  if (!serviceId) throw new Error("Vui lòng chọn dịch vụ");
  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");

  const slots = await calculateSlotsInternal({
    employeeId: Number(employeeId),
    serviceId: Number(serviceId),
    appointmentDate,
    excludeAppointmentId: excludeAppointmentId ? Number(excludeAppointmentId) : null,
    includeAllSlots: String(includeAllSlots) === "true",
  });

  const shouldIncludeAlternatives = String(includeAlternatives) === "true";

  if (shouldIncludeAlternatives || slots.length === 0) {
    const alternatives = await getSlotAlternatives(
      Number(employeeId),
      Number(serviceId),
      appointmentDate,
    );
    return { slots, alternatives };
  }

  return slots;
}

module.exports = {
  checkAvailability,
  validateAvailability,
  getAvailableSlots,
  calculateSlotsInternal,
  getSlotAlternatives,
};
