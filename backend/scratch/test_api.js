const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('http://localhost:5000/api/services');
    console.log('API call succeeded! Status:', res.status);
    console.log('Data count:', res.data?.data?.length || res.data?.length);
  } catch (err) {
    console.error('API call failed!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Response data:', err.response.data);
    } else {
      console.error('Error message:', err.message);
    }
  }
}

testApi();
