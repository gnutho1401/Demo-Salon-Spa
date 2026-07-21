const axios = require('axios');

async function testEndpoints() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('1. Đăng nhập với tài khoản customer@salon.com...');
  
  try {
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: 'customer@salon.com',
      password: '123'
    });
    
    // Check if password was wrong (should be 123456)
    console.log('Đăng nhập với password "123" thất bại, thử "123456"...');
  } catch (err) {
    // expected if password was wrong
  }

  let token = '';
  try {
    const loginRes = await axios.post(`${baseUrl}/auth/login`, {
      email: 'customer@salon.com',
      password: '123456'
    });
    console.log('Login Response:', loginRes.data);
    token = loginRes.data.data?.token || loginRes.data.token || loginRes.data.accessToken;
    console.log('✅ Đăng nhập thành công! Token:', token ? 'Có' : 'Không');
  } catch (err) {
    console.error('❌ Đăng nhập thất bại:', err.response?.data || err.message);
    process.exit(1);
  }

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const endpoints = [
    { name: '/services', url: `${baseUrl}/services`, method: 'get', auth: false },
    { name: '/packages/my', url: `${baseUrl}/packages/my`, method: 'get', auth: true },
    { name: '/vouchers/my', url: `${baseUrl}/vouchers/my`, method: 'get', auth: true },
    { name: '/employees/branches', url: `${baseUrl}/employees/branches`, method: 'get', auth: false },
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting ${ep.name}...`);
    try {
      const res = await axios({
        method: ep.method,
        url: ep.url,
        ...(ep.auth ? config : {})
      });
      console.log(`✅ ${ep.name} SUCCESS! Status: ${res.status}. Data count:`, Array.isArray(res.data.data) ? res.data.data.length : 'object');
    } catch (err) {
      console.error(`❌ ${ep.name} FAILED:`, err.response?.status, err.response?.data || err.message);
    }
  }
  
  process.exit(0);
}

testEndpoints();
