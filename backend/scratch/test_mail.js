require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing email configuration...');
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '********' : 'Not Set');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.error('Error: EMAIL_USER or EMAIL_PASS is not configured in .env file!');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: `Beauty Salon Test <${process.env.EMAIL_USER}>`,
  to: process.env.EMAIL_USER,
  subject: 'Test Email from Beauty Salon',
  text: 'If you receive this, your email configuration is working perfectly!',
  html: '<b>If you receive this, your email configuration is working perfectly!</b>',
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Failed to send email. Error details:');
    console.error(error);
  } else {
    console.log('Email sent successfully!');
    console.log('Response:', info.response);
  }
});
