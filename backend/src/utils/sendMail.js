const nodemailer = require('nodemailer');

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendMail({ to, subject, html }) {
  const transporter = getTransporter();

  if (!transporter) {
    console.log('EMAIL_USER hoặc EMAIL_PASS chưa được cấu hình. Nội dung email dev:', {
      to,
      subject,
      html,
    });
    return { skipped: true };
  }

  await transporter.sendMail({
    from: `Beauty Salon <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  return { skipped: false };
}

async function sendVerifyEmail(to, code) {
  return sendMail({
    to,
    subject: 'Xác nhận tài khoản Beauty Salon',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Xác nhận tài khoản Beauty Salon</h2>
        <p>Mã xác nhận tài khoản của bạn là:</p>
        <h1 style="color:#ef4f83;letter-spacing:4px">${code}</h1>
        <p>Mã có hiệu lực trong 10 phút.</p>
      </div>
    `,
  });
}

async function sendResetPasswordEmail(to, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  return sendMail({
    to,
    subject: 'Đặt lại mật khẩu Beauty Salon',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Đặt lại mật khẩu</h2>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu.</p>
        <p>Bấm vào liên kết bên dưới để đổi mật khẩu:</p>
        <p><a href="${resetUrl}" style="color:#ef4f83">${resetUrl}</a></p>
        <p>Liên kết có hiệu lực trong 15 phút.</p>
      </div>
    `,
  });
}

module.exports = {
  sendMail,
  sendVerifyEmail,
  sendResetPasswordEmail,
};
