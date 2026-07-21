const fs = require('fs');
const content = fs.readFileSync('h:\\a_SWP\\beauty-salon-customer-fixed\\beauty-salon (14)\\beauty-salon\\frontend\\src\\pages\\customer\\PaymentPage.jsx', 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('setError') || line.includes('alert') || line.includes('toast') || line.includes('catch')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
