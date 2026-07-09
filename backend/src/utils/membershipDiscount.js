const { sql, connectDB } = require("../config/db");

const POINT_VALUE = 1000;
const MAX_POINT_DISCOUNT_RATE = 0.5;
const EARN_RATE = 10000;

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
        WHERE x.MinPoints <= ISNULL(c.LoyaltyPoints, 0)
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE c.CustomerId = @CustomerId
    `);

  return Number(result.recordset[0]?.DiscountPercent || 0);
}

function calcMembershipDiscount(totalAmount, discountPercent) {
  const total = Number(totalAmount || 0);
  const percent = Number(discountPercent || 0);

  const membershipDiscountAmount = Math.min(
    Math.round((total * percent) / 100),
    total,
  );

  return {
    membershipDiscountAmount,
    afterMembership: Math.max(total - membershipDiscountAmount, 0),
  };
}

function calcRewardPointUsage(totalAmount, availablePoints, requestedPoints) {
  const total = Number(totalAmount || 0);
  const available = Math.max(Number(availablePoints || 0), 0);
  const requested = Math.max(Number(requestedPoints || 0), 0);

  const maxDiscountAmount = Math.floor(total * MAX_POINT_DISCOUNT_RATE);
  const maxPointsByMoney = Math.floor(maxDiscountAmount / POINT_VALUE);

  const rewardPointsUsed = Math.min(requested, available, maxPointsByMoney);
  const rewardDiscountAmount = rewardPointsUsed * POINT_VALUE;

  return {
    rewardPointsUsed,
    rewardDiscountAmount,
    maxUsablePoints: Math.min(available, maxPointsByMoney),
    pointValue: POINT_VALUE,
  };
}

async function useLoyaltyPoints(
  transaction,
  customerId,
  paymentId,
  appointmentId,
  points,
  amount,
) {
  const usedPoints = Number(points || 0);

  if (!customerId || usedPoints <= 0) return 0;

  const updateResult = await new sql.Request(transaction)
    .input("CustomerId", sql.Int, customerId)
    .input("Points", sql.Int, usedPoints).query(`
      UPDATE Customers
      SET LoyaltyPoints = ISNULL(LoyaltyPoints, 0) - @Points
      WHERE CustomerId = @CustomerId
        AND ISNULL(LoyaltyPoints, 0) >= @Points
    `);

  if (updateResult.rowsAffected[0] === 0) {
    throw new Error("Điểm thưởng không đủ để áp dụng");
  }

  await new sql.Request(transaction)
    .input("CustomerId", sql.Int, customerId)
    .input("AppointmentId", sql.Int, appointmentId)
    .input("PaymentId", sql.Int, paymentId)
    .input("Points", sql.Int, -usedPoints)
    .input("Amount", sql.Decimal(18, 2), amount || 0).query(`
      INSERT INTO LoyaltyPointTransactions
        (CustomerId, AppointmentId, PaymentId, Type, Points, Amount, Note)
      VALUES
        (@CustomerId, @AppointmentId, @PaymentId, 'USE', @Points, @Amount, N'Sử dụng điểm giảm giá khi thanh toán')
    `);

  return usedPoints;
}

async function addLoyaltyPoints(
  transaction,
  customerId,
  paymentId,
  appointmentId,
  paidAmount,
) {
  const points = Math.floor(Number(paidAmount || 0) / EARN_RATE);

  if (!customerId || points <= 0) return 0;

  await new sql.Request(transaction)
    .input("CustomerId", sql.Int, customerId)
    .input("Points", sql.Int, points).query(`
      UPDATE Customers
      SET LoyaltyPoints = ISNULL(LoyaltyPoints, 0) + @Points
      WHERE CustomerId = @CustomerId
    `);

  await new sql.Request(transaction)
    .input("CustomerId", sql.Int, customerId)
    .input("AppointmentId", sql.Int, appointmentId)
    .input("PaymentId", sql.Int, paymentId)
    .input("Points", sql.Int, points)
    .input("Amount", sql.Decimal(18, 2), paidAmount || 0).query(`
      INSERT INTO LoyaltyPointTransactions
        (CustomerId, AppointmentId, PaymentId, Type, Points, Amount, Note)
      VALUES
        (@CustomerId, @AppointmentId, @PaymentId, 'EARN', @Points, @Amount, N'Cộng điểm sau thanh toán thành công')
    `);

  return points;
}

async function updateCustomerMembershipLevel(transaction, customerId) {
  if (!customerId) return;

  await new sql.Request(transaction).input("CustomerId", sql.Int, customerId)
    .query(`
      UPDATE c
      SET MembershipLevelId = lv.MembershipLevelId
      FROM Customers c
      LEFT JOIN MembershipLevels cur ON c.MembershipLevelId = cur.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 MembershipLevelId, MinPoints
        FROM MembershipLevels
        WHERE MinPoints <= ISNULL(c.LoyaltyPoints, 0)
        ORDER BY MinPoints DESC
      ) lv
      WHERE c.CustomerId = @CustomerId
        AND lv.MembershipLevelId IS NOT NULL
        AND (cur.MinPoints IS NULL OR lv.MinPoints >= cur.MinPoints)
    `);
}

module.exports = {
  POINT_VALUE,
  EARN_RATE,
  getCustomerDiscountPercent,
  calcMembershipDiscount,
  calcRewardPointUsage,
  useLoyaltyPoints,
  addLoyaltyPoints,
  updateCustomerMembershipLevel,
};
