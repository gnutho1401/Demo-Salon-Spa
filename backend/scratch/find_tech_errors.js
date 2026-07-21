const fs = require('fs');
const content = fs.readFileSync('h:\\a_SWP\\beauty-salon-customer-fixed\\beauty-salon (14)\\beauty-salon\\frontend\\src\\pages\\technician\\TreatmentNotesV2.jsx', 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('toast$') || line.includes('alert') || line.includes('catch')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
