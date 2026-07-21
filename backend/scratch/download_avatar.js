const axios = require('axios');

async function main() {
  const url = 'https://lh3.googleusercontent.com/a/ACg8ocKzB646RadW6lRKmaCTbom3Y20mTNgMgp8fZuYyUhXPKRnutm4=s96-c';
  console.log('Downloading URL:', url);
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Length:', res.headers['content-length']);
    console.log('✅ Success downloading the Google avatar!');
  } catch (err) {
    console.error('❌ Failed downloading the Google avatar:', err.message);
    if (err.response) {
      console.error('Response Status:', err.response.status);
      console.error('Response Headers:', err.response.headers);
    }
  }
}

main();
