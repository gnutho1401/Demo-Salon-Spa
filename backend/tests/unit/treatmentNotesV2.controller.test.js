jest.mock("../../src/modules/treatment-notes-v2/treatment-notes-v2.service", () => ({
  getAnalytics: jest.fn(),
}));

const service = require("../../src/modules/treatment-notes-v2/treatment-notes-v2.service");
const controller = require("../../src/modules/treatment-notes-v2/treatment-notes-v2.controller");

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe("Treatment Notes V2 controller authorization", () => {
  beforeEach(() => {
    service.getAnalytics.mockResolvedValue({ totalNotes: 12 });
  });

  it.each(["ADMIN", "MANAGER", "admin", "manager"])(
    "allows JWT role %s to read analytics",
    async (role) => {
      const req = { user: { role } };
      const res = createResponse();

      await controller.getAnalytics(req, res);

      expect(service.getAnalytics).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Success",
        data: { totalNotes: 12 },
      });
    },
  );

  it("rejects a non-admin JWT role", async () => {
    const req = { user: { role: "TECHNICIAN" } };
    const res = createResponse();

    await controller.getAnalytics(req, res);

    expect(service.getAnalytics).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: expect.any(String),
    });
  });
});
