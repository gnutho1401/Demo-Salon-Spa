const { sql, connectDB } = require('../../config/db');

const REMINDER_TYPES = {
  H24: 'APPOINTMENT_REMINDER_24H',
  H2: 'APPOINTMENT_REMINDER_2H',
};

async function getAll() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT n.*, u.FullName
    FROM Notifications n
    JOIN Users u ON n.UserId = u.UserId
    ORDER BY n.CreatedAt DESC
  `);
  return result.recordset;
}

async function getMine(userId) {
  const pool = await connectDB();
  const result = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT NotificationId, Title, Content, Type, IsRead, CreatedAt
    FROM Notifications
    WHERE UserId = @UserId
    ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

async function markRead(userId, id) {
  const pool = await connectDB();
  await pool.request().input('UserId', sql.Int, userId).input('NotificationId', sql.Int, id).query(`
    UPDATE Notifications SET IsRead = 1 WHERE NotificationId = @NotificationId AND UserId = @UserId
  `);
  return getById(id);
}

async function markAllRead(userId) {
  const pool = await connectDB();
  await pool.request().input('UserId', sql.Int, userId).query(`UPDATE Notifications SET IsRead = 1 WHERE UserId = @UserId`);
  return { success: true };
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool.request().input('NotificationId', sql.Int, id).query(`SELECT * FROM Notifications WHERE NotificationId = @NotificationId`);
  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();
  const result = await pool.request()
    .input('UserId', sql.Int, data.userId || data.UserId)
    .input('Title', sql.NVarChar, data.title || data.Title)
    .input('Content', sql.NVarChar, data.content || data.Content || null)
    .input('Type', sql.NVarChar, data.type || data.Type || 'SYSTEM')
    .query(`
      INSERT INTO Notifications (UserId, Title, Content, Type)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Title, @Content, @Type)
    `);
  return result.recordset[0];
}

function getReminderWindowBounds(windowType) {
  return windowType === '2H'
    ? { minMinutes: 110, maxMinutes: 130, type: REMINDER_TYPES.H2 }
    : { minMinutes: 23 * 60, maxMinutes: 25 * 60, type: REMINDER_TYPES.H24 };
}

function toAppointmentDateTime(row) {
  const dateText = row.AppointmentDate instanceof Date
    ? row.AppointmentDate.toISOString().slice(0, 10)
    : String(row.AppointmentDate).slice(0, 10);
  const timeText = String(row.StartTime || '').slice(0, 8) || '00:00:00';
  return new Date(`${dateText}T${timeText}`);
}

async function createAppointmentReminderForWindow(windowType) {
  const { minMinutes, maxMinutes, type: reminderType } = getReminderWindowBounds(windowType);
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      a.AppointmentId,
      a.CustomerId,
      a.AppointmentDate,
      a.StartTime,
      eu.FullName AS EmployeeName,
      STRING_AGG(s.ServiceName, N', ') AS ServiceNames
    FROM Appointments a
    JOIN Customers c ON a.CustomerId = c.CustomerId
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.Status = 'CONFIRMED'
    GROUP BY a.AppointmentId, a.CustomerId, a.AppointmentDate, a.StartTime, eu.FullName
    ORDER BY a.AppointmentDate ASC, a.StartTime ASC
  `);

  const now = Date.now();
  const rows = (result.recordset || []).filter((row) => {
    const diffMinutes = Math.round((toAppointmentDateTime(row).getTime() - now) / 60000);
    return diffMinutes >= minMinutes && diffMinutes <= maxMinutes;
  });

  const created = [];

  for (const row of rows) {
    const exists = await pool.request()
      .input('UserId', sql.Int, row.CustomerId)
      .input('Type', sql.NVarChar, reminderType)
      .input('AppointmentId', sql.Int, row.AppointmentId)
      .query(`
        SELECT TOP 1 NotificationId
        FROM Notifications
        WHERE UserId = @UserId
          AND Type = @Type
          AND Content LIKE '%' + CAST(@AppointmentId AS NVARCHAR(20)) + '%'
      `);

    if (exists.recordset[0]) continue;

    const title = reminderType === REMINDER_TYPES.H2
      ? 'Nhắc lịch hẹn sắp diễn ra trong 2 giờ'
      : 'Nhắc lịch hẹn sắp diễn ra trong 24 giờ';
    const content = `Lịch hẹn #${row.AppointmentId} với ${row.EmployeeName || 'kỹ thuật viên'} và dịch vụ ${row.ServiceNames || 'dịch vụ'} sẽ diễn ra vào ${String(row.AppointmentDate).slice(0, 10)} ${String(row.StartTime || '').slice(0, 5)}.`;

    const inserted = await create({
      userId: row.CustomerId,
      title,
      content,
      type: reminderType,
    });
    created.push(inserted);
  }

  return created;
}

async function runAppointmentReminderJobs() {
  const [reminders24h, reminders2h] = await Promise.all([
    createAppointmentReminderForWindow('24H'),
    createAppointmentReminderForWindow('2H'),
  ]);

  return {
    created24h: reminders24h.length,
    created2h: reminders2h.length,
    totalCreated: reminders24h.length + reminders2h.length,
  };
}

function startAppointmentReminderScheduler(intervalMs = 15 * 60 * 1000) {
  const run = async () => {
    try {
      const result = await runAppointmentReminderJobs();
      console.log(
        `[reminder] created ${result.totalCreated} notifications ` +
          `(24h: ${result.created24h}, 2h: ${result.created2h})`,
      );
    } catch (err) {
      console.error('Appointment reminder job failed:', err.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  return timer;
}

async function update(id, data) {
  const pool = await connectDB();
  await pool.request()
    .input('NotificationId', sql.Int, id)
    .input('IsRead', sql.Bit, data.isRead ?? data.IsRead ?? null)
    .query(`UPDATE Notifications SET IsRead = COALESCE(@IsRead, IsRead) WHERE NotificationId = @NotificationId`);
  return getById(id);
}

async function remove(id) {
  const pool = await connectDB();
  await pool.request().input('NotificationId', sql.Int, id).query('DELETE FROM Notifications WHERE NotificationId = @NotificationId');
  return { NotificationId: Number(id) };
}

module.exports = {
  getAll,
  getMine,
  markRead,
  markAllRead,
  getById,
  create,
  createAppointmentReminderForWindow,
  runAppointmentReminderJobs,
  startAppointmentReminderScheduler,
  update,
  remove,
};
