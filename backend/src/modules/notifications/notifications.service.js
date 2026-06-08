const { sql, connectDB } = require('../../config/db');

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

module.exports = { getAll, getMine, markRead, markAllRead, getById, create, update, remove };
