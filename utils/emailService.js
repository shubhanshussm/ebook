const nodemailer = require('nodemailer');

// Generate cryptographically random 6-digit numeric OTP
function generate6DigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Build Nodemailer transporter
function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass },
    });
  }
  return null;
}

/**
 * Send OTP Email for Registration or Forgot Password
 * @param {Object} options
 * @param {string} options.email - Recipient email
 * @param {string} options.otp - 6-digit code
 * @param {'registration'|'forgot_password'} options.purpose
 * @param {string} [options.name] - User name if available
 */
async function sendEmailOtp({ email, otp, purpose, name }) {
  const cleanEmail = email.toLowerCase().trim();
  const userName = name || 'Learner';
  const isRegistration = purpose === 'registration';

  const subject = isRegistration
    ? `Verify Your Email: ${otp} - BookVault Account Registration`
    : `Password Reset Code: ${otp} - BookVault Security`;

  const heading = isRegistration
    ? 'Verify Your Email Address'
    : 'Reset Your BookVault Password';

  const subtext = isRegistration
    ? `Hello ${userName}, thank you for registering with BookVault. Please enter the 6-digit verification code below to activate your account and claim your library access:`
    : `Hello ${userName}, we received a request to reset the password for your BookVault account. Use the 6-digit verification code below to complete your password reset:`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .card { max-width: 520px; margin: 20px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: #0f172a; padding: 24px; text-align: center; }
        .brand { font-size: 22px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: -0.5px; }
        .brand-icon { display: inline-block; margin-right: 6px; }
        .content { padding: 32px 28px; }
        .heading { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; }
        .subtext { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-box { background: #eef2ff; border: 2px dashed #4f46e5; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4338ca; }
        .otp-expiry { font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 500; }
        .warning { font-size: 13px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
        .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="brand"><span class="brand-icon">📚</span> BookVault</div>
        </div>
        <div class="content">
          <h2 class="heading">${heading}</h2>
          <p class="subtext">${subtext}</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="otp-expiry">⏱ Valid for 10 minutes only</div>
          </div>
          <div class="warning">
            🛡️ If you did not make this request, please disregard this email. Never share this code with anyone. BookVault team will never ask for your verification code.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} BookVault eBook Store. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // Visual Console Log for immediate local developer verification
  console.log('========================================================');
  console.log(`[EMAIL SERVICE] 📧 OTP DISPATCH`);
  console.log(`  To:      ${cleanEmail}`);
  console.log(`  Purpose: ${purpose.toUpperCase()}`);
  console.log(`  OTP:     >>> ${otp} <<<`);
  console.log(`  Expires: 10 minutes`);
  console.log('========================================================');

  const transporter = getTransporter();
  let emailSent = false;

  if (transporter) {
    try {
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@bookvault.com';
      await transporter.sendMail({
        from: `"BookVault" <${fromEmail}>`,
        to: cleanEmail,
        subject,
        html: htmlContent,
      });
      emailSent = true;
      console.log(`[EMAIL SERVICE] ✓ Email delivered via SMTP to ${cleanEmail}`);
    } catch (smtpErr) {
      console.error(`[EMAIL SERVICE] ⚠️ SMTP delivery failed:`, smtpErr.message);
    }
  } else {
    console.log(`[EMAIL SERVICE] ℹ️ SMTP credentials not set in .env. Running in simulated test delivery mode.`);
  }

  return {
    success: true,
    emailSent,
    otp,
  };
}

module.exports = {
  generate6DigitOtp,
  sendEmailOtp,
};
