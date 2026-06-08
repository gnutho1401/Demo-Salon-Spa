const { sql, connectDB } = require('../../config/db');

async function getCustomer(pool, userId) {
  const res = await pool.request().input('UserId', sql.Int, userId).query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  return res.recordset[0];
}

async function getMine(userId) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  if (!customer) return [];
  const res = await pool.request().input('CustomerId', sql.Int, customer.CustomerId).query(`
    SELECT w.*, s.ServiceName, s.Price, s.DurationMinutes
    FROM WaitingList w
    JOIN Services s ON w.ServiceId = s.ServiceId
    WHERE w.CustomerId = @CustomerId
    ORDER BY w.CreatedAt DESC
  `);
  return res.recordset;
}

async function create(userId, data) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  if (!customer) throw new Error('Không tìm thấy hồ sơ khách hàng');
  const serviceId = Number(data.serviceId || data.ServiceId);
  const preferredDate = data.preferredDate || data.PreferredDate || null;
  const preferredTime = data.preferredTime || data.PreferredTime || null;
  if (!serviceId) throw new Error('Vui lòng chọn dịch vụ cần vào hàng chờ');
  const service = await pool.request().input('ServiceId', sql.Int, serviceId).query("SELECT ServiceId FROM Services WHERE ServiceId = @ServiceId AND Status = 'AVAILABLE'");
  if (!service.recordset[0]) throw new Error('Dịch vụ không tồn tại hoặc đã ngừng bán');
  const res = await pool.request()
    .input('CustomerId', sql.Int, customer.CustomerId)
    .input('ServiceId', sql.Int, serviceId)
    .input('PreferredDate', sql.Date, preferredDate)
    .input('PreferredTime', sql.VarChar, preferredTime ? (String(preferredTime).length === 5 ? `${preferredTime}:00` : preferredTime) : null)
    .query(`
      INSERT INTO WaitingList (CustomerId, ServiceId, PreferredDate, PreferredTime, Status)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @ServiceId, @PreferredDate, CASE WHEN @PreferredTime IS NULL THEN NULL ELSE CAST(@PreferredTime AS TIME) END, 'WAITING')
    `);
  return res.recordset[0];
}

async function cancel(userId, id) {
  const pool = await connectDB();
  const customer = await getCustomer(pool, userId);
  if (!customer) throw new Error('Không tìm thấy hồ sơ khách hàng');
  await pool.request()
    .input('WaitingId', sql.Int, id)
    .input('CustomerId', sql.Int, customer.CustomerId)
    .query(`UPDATE WaitingList SET Status = 'CANCELLED' WHERE WaitingId = @WaitingId AND CustomerId = @CustomerId AND Status = 'WAITING'`);
  return { WaitingId: Number(id), Status: 'CANCELLED' };
}

module.exports = { getMine, create, cancel };
