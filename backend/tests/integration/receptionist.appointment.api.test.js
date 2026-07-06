const express = require("express");
const request = require("supertest");
const receptionistRoutes = require("../../src/modules/receptionist/receptionist.routes");
const { verifyToken } = require("../../src/utils/jwt");
const receptionistService = require("../../src/modules/receptionist/receptionist.service");

// Mock the JWT verifyToken helper
jest.mock("../../src/utils/jwt", () => ({
  verifyToken: jest.fn(),
  signToken: jest.fn(),
}));

// Mock the Receptionist service
jest.mock("../../src/modules/receptionist/receptionist.service", () => ({
  getAppointments: jest.fn(),
  confirmAppointment: jest.fn(),
  checkInAppointment: jest.fn(),
  startAppointment: jest.fn(),
  completeAppointment: jest.fn(),
  createAppointment: jest.fn(),
  getAppointmentById: jest.fn(),
  cancelAppointment: jest.fn(),
  noShowAppointment: jest.fn(),
  rescheduleAppointment: jest.fn(),
  getAvailableTechnicians: jest.fn(),
  getAvailableSlots: jest.fn(),
  getDashboard: jest.fn(),
  getReceptionistNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  getCustomers: jest.fn(),
  getCustomersSearch: jest.fn(),
  getCustomerById: jest.fn(),
  updateCustomer: jest.fn(),
  createCustomer: jest.fn(),
  getServices: jest.fn(),
  getTechniciansForService: jest.fn(),
  getInvoices: jest.fn(),
  getInvoiceById: jest.fn(),
  markInvoicePaid: jest.fn(),
  requestRefund: jest.fn(),
  createInvoiceManually: jest.fn(),
  updateInvoiceDetails: jest.fn(),
  sendInvoiceEmail: jest.fn(),
  getWaitingList: jest.fn(),
  createWaitingList: jest.fn(),
  updateWaitingList: jest.fn(),
  deleteWaitingList: jest.fn(),
  getWaitingAvailableSlots: jest.fn(),
  convertWaitingListToAppointment: jest.fn(),
  getReceptionistReviews: jest.fn(),
  getReceptionistProfile: jest.fn(),
  updateReceptionistProfile: jest.fn(),
  updateReceptionistAvatar: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/receptionist", receptionistRoutes);

describe("Member 3 - Receptionist Appointment API Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("getAppointments_ShouldReturn401_WhenTokenIsMissing", async () => {
    // Arrange
    verifyToken.mockImplementation(() => {
      throw new Error("Token missing");
    });

    // Act
    const response = await request(app)
      .get("/api/receptionist/appointments");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Missing token",
    });
  });

  it("getAppointments_ShouldReturn403_WhenUserRoleIsNotReceptionist", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 2, role: "Customer" });

    // Act
    const response = await request(app)
      .get("/api/receptionist/appointments")
      .set("Authorization", "Bearer customer-token");

    // Assert
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: "Bạn không có quyền truy cập chức năng này",
    });
  });

  it("getAppointments_ShouldReturn200_WhenReceptionistTokenIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.getAppointments.mockResolvedValue([]);

    // Act
    const response = await request(app)
      .get("/api/receptionist/appointments")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
      message: "Success",
    });
  });

  it("confirmAppointment_ShouldReturn200_WhenAppointmentIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.confirmAppointment.mockResolvedValue({ message: "Confirmed successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/confirm")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Confirmed successfully" },
      message: "Success",
    });
  });

  it("checkInAppointment_ShouldReturn200_WhenAppointmentIsConfirmed", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.checkInAppointment.mockResolvedValue({ message: "Checked in successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/check-in")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Checked in successfully" },
      message: "Success",
    });
    expect(receptionistService.checkInAppointment).toHaveBeenCalledWith("123", 1);
  });

  it("startAppointment_ShouldReturn200_WhenCustomerCheckedIn", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.startAppointment.mockResolvedValue({ message: "Started successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/start")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Started successfully" },
      message: "Success",
    });
    expect(receptionistService.startAppointment).toHaveBeenCalledWith("123", 1);
  });

  it("completeAppointment_ShouldReturn200_WhenServiceIsFinished", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.completeAppointment.mockResolvedValue({ message: "Completed successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/complete")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Completed successfully" },
      message: "Success",
    });
    expect(receptionistService.completeAppointment).toHaveBeenCalledWith("123", 1);
  });

  it("createAppointment_ShouldReturn201_WhenDataIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.createAppointment.mockResolvedValue({ AppointmentId: 100 });
    const payload = { customerId: 1, serviceId: 2 };

    // Act
    const response = await request(app)
      .post("/api/receptionist/appointments")
      .set("Authorization", "Bearer receptionist-token")
      .send(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { AppointmentId: 100 },
      message: "Created",
    });
  });

  it("createWalkInAppointment_ShouldReturn201_WhenDataIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.createAppointment.mockResolvedValue({ AppointmentId: 101 });
    const payload = { customerId: 1, serviceId: 2 };

    // Act
    const response = await request(app)
      .post("/api/receptionist/walk-ins")
      .set("Authorization", "Bearer receptionist-token")
      .send(payload);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { AppointmentId: 101 },
      message: "Walk-in created",
    });
  });

  it("getAppointmentById_ShouldReturn200_WhenIdIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.getAppointmentById.mockResolvedValue({ AppointmentId: 123 });

    // Act
    const response = await request(app)
      .get("/api/receptionist/appointments/123")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { AppointmentId: 123 },
      message: "Success",
    });
  });

  it("getAppointmentById_ShouldReturn404_WhenIdDoesNotExist", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.getAppointmentById.mockResolvedValue(null);

    // Act
    const response = await request(app)
      .get("/api/receptionist/appointments/999")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "Không tìm thấy lịch hẹn",
    });
  });

  it("cancelAppointment_ShouldReturn200_WhenAppointmentIsCancelled", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.cancelAppointment.mockResolvedValue({ message: "Cancelled successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/cancel")
      .set("Authorization", "Bearer receptionist-token")
      .send({ reason: "Customer requested" });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Cancelled successfully" },
      message: "Success",
    });
  });

  it("noShowAppointment_ShouldReturn200_WhenAppointmentIsNoShow", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.noShowAppointment.mockResolvedValue({ message: "No-show status set" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/no-show")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "No-show status set" },
      message: "Success",
    });
  });

  it("rescheduleAppointment_ShouldReturn200_WhenAppointmentIsRescheduled", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.rescheduleAppointment.mockResolvedValue({ message: "Rescheduled successfully" });

    // Act
    const response = await request(app)
      .put("/api/receptionist/appointments/123/reschedule")
      .set("Authorization", "Bearer receptionist-token")
      .send({ newDate: "2026-06-24", slotId: 4 });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Rescheduled successfully" },
      message: "Success",
    });
  });

  it("getAvailableTechnicians_ShouldReturn200_WhenQueryIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.getAvailableTechnicians.mockResolvedValue([{ TechId: 1 }]);

    // Act
    const response = await request(app)
      .get("/api/receptionist/available-technicians?date=2026-06-24")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ TechId: 1 }],
      message: "Success",
    });
  });

  it("getAvailableSlots_ShouldReturn200_WhenQueryIsValid", async () => {
    // Arrange
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.getAvailableSlots.mockResolvedValue([{ SlotId: 2 }]);

    // Act
    const response = await request(app)
      .get("/api/receptionist/available-slots?date=2026-06-24")
      .set("Authorization", "Bearer receptionist-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ SlotId: 2 }],
      message: "Success",
    });
  });

  it("createInvoiceManually_ShouldReturn200_WhenAppointmentIdIsValid", async () => {
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.createInvoiceManually.mockResolvedValue({ InvoiceId: 10 });

    const response = await request(app)
      .post("/api/receptionist/appointments/123/create-invoice")
      .set("Authorization", "Bearer receptionist-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { InvoiceId: 10 },
      message: "Success",
    });
    expect(receptionistService.createInvoiceManually).toHaveBeenCalledWith("123");
  });

  it("updateInvoiceDetails_ShouldReturn200_WhenDataIsValid", async () => {
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.updateInvoiceDetails.mockResolvedValue({ InvoiceId: 10, Total: 100 });

    const response = await request(app)
      .put("/api/receptionist/invoices/10/update-details")
      .set("Authorization", "Bearer receptionist-token")
      .send({ serviceIds: [1, 2], voucherCode: "PROMO", manualDiscount: 10, surcharge: 5 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { InvoiceId: 10, Total: 100 },
      message: "Success",
    });
    expect(receptionistService.updateInvoiceDetails).toHaveBeenCalledWith("10", {
      serviceIds: [1, 2],
      voucherCode: "PROMO",
      manualDiscount: 10,
      surcharge: 5,
    });
  });

  it("sendInvoiceEmail_ShouldReturn200_WhenInvoiceIdIsValid", async () => {
    verifyToken.mockReturnValue({ userId: 1, role: "Receptionist" });
    receptionistService.sendInvoiceEmail.mockResolvedValue({ message: "Gửi hóa đơn email thành công" });

    const response = await request(app)
      .post("/api/receptionist/invoices/10/send-email")
      .set("Authorization", "Bearer receptionist-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { message: "Gửi hóa đơn email thành công" },
      message: "Success",
    });
    expect(receptionistService.sendInvoiceEmail).toHaveBeenCalledWith("10");
  });
});
