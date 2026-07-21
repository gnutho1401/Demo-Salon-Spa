const axios = require('axios');

async function main() {
  try {
    const res = await axios.get('http://localhost:5000/api/packages');
    console.log('✅ Packages API response:', res.status, res.data?.data?.length || 0, 'packages found.');
  } catch (err) {
    console.error('❌ API error:', err.message);
  }
}

main();
