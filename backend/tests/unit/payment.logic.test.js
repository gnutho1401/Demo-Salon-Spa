// Mock DB configuration to mock connection pool and requests with safe hoisting
jest.mock("../../src/config/db", () => {
  const mockInput = jest.fn().mockReturnThis();
  const mockQuery = jest.fn();
  const mockRequest = {
    input: mockInput,
    query: mockQuery,
  };
  const mockPool = {
    request: jest.fn().mockReturnValue(mockRequest),
  };
  const mockConnectDB = jest.fn().mockResolvedValue(mockPool);

  class MockRequest {
    input = mockInput;
    query = mockQuery;
  }

  return {
    sql: {
      Int: "Int",
      Decimal: () => "Decimal",
      Request: MockRequest,
    },
    connectDB: mockConnectDB,
    _mockQuery: mockQuery,
    _mockInput: mockInput,
  };
});

const {
  calcMembershipDiscount,
  calcRewardPointUsage,
  getCustomerDiscountPercent,
  useLoyaltyPoints,
  addLoyaltyPoints,
  updateCustomerMembershipLevel,
} = require("../../src/utils/membershipDiscount");

const dbMock = require("../../src/config/db");
const mockQuery = dbMock._mockQuery;
const mockInput = dbMock._mockInput;

describe("Member 2 - Payment Discount and Reward Point Unit Tests", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockInput.mockReset();
    mockInput.mockReturnThis();
  });

  it("calcMembershipDiscount_ShouldCalculateDiscount_WhenPercentIsValid", () => {
    // Arrange
    const totalAmount = 1000000;
    const discountPercent = 10;

    // Act
    const result = calcMembershipDiscount(totalAmount, discountPercent);

    // Assert
    expect(result.membershipDiscountAmount).toBe(100000);
    expect(result.afterMembership).toBe(900000);
  });

  it("calcMembershipDiscount_ShouldReturnZeroDiscount_WhenPercentIsZero", () => {
    // Arrange
    const totalAmount = 1000000;
    const discountPercent = 0;

    // Act
    const result = calcMembershipDiscount(totalAmount, discountPercent);

    // Assert
    expect(result.membershipDiscountAmount).toBe(0);
    expect(result.afterMembership).toBe(1000000);
  });

  it("calcMembershipDiscount_ShouldNotExceedTotalAmount_WhenPercentIsGreaterThan100", () => {
    // Arrange
    const totalAmount = 500000;
    const discountPercent = 200;

    // Act
    const result = calcMembershipDiscount(totalAmount, discountPercent);

    // Assert
    expect(result.membershipDiscountAmount).toBe(500000);
    expect(result.afterMembership).toBe(0);
  });

  it("calcRewardPointUsage_ShouldUseRequestedPoints_WhenRequestedIsValid", () => {
    // Arrange
    const totalAmount = 1000000;
    const availablePoints = 300;
    const requestedPoints = 200;

    // Act
    const result = calcRewardPointUsage(totalAmount, availablePoints, requestedPoints);

    // Assert
    expect(result.rewardPointsUsed).toBe(200);
    expect(result.rewardDiscountAmount).toBe(200000);
  });

  it("calcRewardPointUsage_ShouldLimitByAvailablePoints_WhenRequestedExceedsAvailable", () => {
    // Arrange
    const totalAmount = 1000000;
    const availablePoints = 100;
    const requestedPoints = 300;

    // Act
    const result = calcRewardPointUsage(totalAmount, availablePoints, requestedPoints);

    // Assert
    expect(result.rewardPointsUsed).toBe(100);
    expect(result.rewardDiscountAmount).toBe(100000);
  });

  it("calcRewardPointUsage_ShouldLimitByMaxDiscountRate_WhenRequestedExceedsAllowedOrderValue", () => {
    // Arrange
    const totalAmount = 1000000;
    const availablePoints = 1000;
    const requestedPoints = 1000;

    // Act
    const result = calcRewardPointUsage(totalAmount, availablePoints, requestedPoints);

    // Assert
    expect(result.rewardPointsUsed).toBe(500);
    expect(result.rewardDiscountAmount).toBe(500000);
  });

  it("calcRewardPointUsage_ShouldReturnZero_WhenRequestedPointsAreNegative", () => {
    // Arrange
    const totalAmount = 1000000;
    const availablePoints = 500;
    const requestedPoints = -100;

    // Act
    const result = calcRewardPointUsage(totalAmount, availablePoints, requestedPoints);

    // Assert
    expect(result.rewardPointsUsed).toBe(0);
    expect(result.rewardDiscountAmount).toBe(0);
  });

  it("getCustomerDiscountPercent_ShouldReturnDiscountPercent_WhenCustomerIdIsValid", async () => {
    // Arrange
    const customerId = 1;
    mockQuery.mockResolvedValueOnce({
      recordset: [{ DiscountPercent: 15 }],
    });

    // Act
    const percent = await getCustomerDiscountPercent(customerId);

    // Assert
    expect(percent).toBe(15);
  });

  it("getCustomerDiscountPercent_ShouldReturnZero_WhenCustomerIdIsNull", async () => {
    // Arrange
    const customerId = null;

    // Act
    const percent = await getCustomerDiscountPercent(customerId);

    // Assert
    expect(percent).toBe(0);
  });

  it("useLoyaltyPoints_ShouldSuccessfullyDeductPointsAndInsertTransaction_WhenPointsAreAvailable", async () => {
    // Arrange
    const customerId = 1;
    const paymentId = 10;
    const appointmentId = 20;
    const points = 100;
    const amount = 100000;
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    });
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    });

    // Act
    const result = await useLoyaltyPoints({}, customerId, paymentId, appointmentId, points, amount);

    // Assert
    expect(result).toBe(100);
  });

  it("useLoyaltyPoints_ShouldThrowError_WhenPointsAreInsufficient", async () => {
    // Arrange
    const customerId = 1;
    const paymentId = 10;
    const appointmentId = 20;
    const points = 100;
    const amount = 100000;
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [0],
    });

    // Act & Assert
    await expect(
      useLoyaltyPoints({}, customerId, paymentId, appointmentId, points, amount)
    ).rejects.toThrow("Điểm thưởng không đủ để áp dụng");
  });

  it("addLoyaltyPoints_ShouldAddPoints_WhenPaidAmountIsValid", async () => {
    // Arrange
    const customerId = 1;
    const paymentId = 10;
    const appointmentId = 20;
    const paidAmount = 100000;
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    });
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    });

    // Act
    const result = await addLoyaltyPoints({}, customerId, paymentId, appointmentId, paidAmount);

    // Assert
    expect(result).toBe(10);
  });

  it("addLoyaltyPoints_ShouldReturnZero_WhenCustomerIdOrPointsInvalid", async () => {
    // Arrange
    const customerId = null;
    const paymentId = 10;
    const appointmentId = 20;
    const paidAmount = 100000;

    // Act
    const result = await addLoyaltyPoints({}, customerId, paymentId, appointmentId, paidAmount);

    // Assert
    expect(result).toBe(0);
  });

  it("updateCustomerMembershipLevel_ShouldSuccessfullyUpdateLevel_WhenCustomerIdIsValid", async () => {
    // Arrange
    const customerId = 1;
    mockQuery.mockResolvedValueOnce({
      rowsAffected: [1],
    });

    // Act
    const result = await updateCustomerMembershipLevel({}, customerId);

    // Assert
    expect(result).toBeUndefined();
  });
});
