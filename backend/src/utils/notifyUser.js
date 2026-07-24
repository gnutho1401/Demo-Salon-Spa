const { sql, connectDB } = require("../config/db");

async function notifyUser(userId, { title, content, type = "SYSTEM" }) {
  if (!userId || !title) return null;

  const pool = await connectDB();
  const result = await pool
    .request()
    .input("UserId", sql.Int, userId)
    .input("Title", sql.NVarChar, title)
    .input("Content", sql.NVarChar, content || null)
    .input("Type", sql.NVarChar, type).query(`
      INSERT INTO Notifications (UserId, Title, Content, Type)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Title, @Content, @Type)
    `);

  return result.recordset[0];
}

async function getUserIdByCustomerId(customerId) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .query(`SELECT UserId FROM Customers WHERE CustomerId = @CustomerId`);
  return result.recordset[0]?.UserId || null;
}

async function notifyCustomer(customerId, payload) {
  const userId = await getUserIdByCustomerId(customerId);
  if (!userId) return null;
  return notifyUser(userId, payload);
}

module.exports = { notifyUser, notifyCustomer, getUserIdByCustomerId };
