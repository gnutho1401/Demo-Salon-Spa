const fs = require("fs");
const filePath =
  "h:/a_SWP/beauty-salon-customer-fixed/beauty-salon (14)/beauty-salon/backend/src/modules/receptionist/receptionist.service.js";
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");

console.log("Searching in receptionist.service.js...");
lines.forEach((line, index) => {
  if (line.includes("getAvailableSlots")) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
