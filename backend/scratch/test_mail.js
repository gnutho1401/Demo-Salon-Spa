require('dotenv').config({ path: '.env' });
const { sendMail } = require('../src/utils/sendMail');

async function test() {
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***' : 'not defined');
  try {
    const result = await sendMail({
      to: 'kiennt.se.work@gmail.com', // Let's use a dummy test email
      subject: 'Test email from BeautySalon',
      html: '<h1>Test Email</h1>'
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
