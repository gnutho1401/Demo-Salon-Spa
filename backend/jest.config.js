module.exports = {
  testEnvironment: "node", 
  testMatch: [
    "**/tests/**/*.test.js",
    "**/**tests**/**/*.test.js"
  ],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  collectCoverageFrom: [
    "src/modules/auth/auth.service.js",
    "src/utils/membershipDiscount.js",
    "src/modules/receptionist/receptionist.routes.js",
    "src/modules/receptionist/receptionist.controller.js",
    "!src/**/*.test.js",
    "!src/**/__tests__/**",
    "!tests/**",
    "!coverage/**",
    "!src/server.js",
    "!src/app.js",
    "!src/config/**"
  ],
  clearMocks: true,
  restoreMocks: true
};
