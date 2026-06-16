const { sql, connectDB } = require("../config/db");

async function getCustomerDiscountPercent(customerId) {
  if (!customerId) return 0;

  const pool = await connectDB();
  const result = await pool.request().input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent
      FROM Customers c
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 x.DiscountPercent
        FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE c.CustomerId = @CustomerId
    `);

  return Number(result.recordset[0]?.DiscountPercent || 0);
}

function calcMembershipDiscount(totalAmount, discountPercent) {
  const total = Number(totalAmount || 0);
  const percent = Number(discountPercent || 0);
  const amount = Math.min((total * percent) / 100, total);
  return {
    membershipDiscountAmount: amount,
    afterMembership: Math.max(total - amount, 0),
  };
}

async function addLoyaltyPoints(customerId, paidAmount) {
  const points = Math.floor(Number(paidAmount || 0) / 10000);
  if (!customerId || points <= 0) return 0;

  const pool = await connectDB();
  await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .input("Points", sql.Int, points).query(`
      UPDATE Customers
      SET LoyaltyPoints = LoyaltyPoints + @Points
      WHERE CustomerId = @CustomerId
    `);

  return points;
}

module.exports = {
  getCustomerDiscountPercent,
  calcMembershipDiscount,
  addLoyaltyPoints,
};
