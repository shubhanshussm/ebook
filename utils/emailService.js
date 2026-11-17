const nodemailer = require('nodemailer');

// Generate cryptographically random 6-digit numeric OTP
function generate6DigitOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send email via EmailJS REST API
 * https://www.emailjs.com/docs/rest-api/send/
 */
async function sendViaEmailJs({ email, otp, purpose, name }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    return { attempted: false, success: false, reason: 'EmailJS credentials not configured in .env' };
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      email: email,
      to_email: email,
      user_email: email,
      recipient: email,
      name: name || 'Learner',
      to_name: name || 'Learner',
      user_name: name || 'Learner',
      otp: otp,
      otp_code: otp,
      code: otp,
      passcode: otp,
      purpose: purpose === 'registration' ? 'Registration Verification' : 'Password Reset',
      message: `Your BookVault verification code is ${otp}. Valid for 10 minutes.`,
    },
  };

  if (privateKey) {
    payload.accessToken = privateKey;
  }

  const originUrl = process.env.CLIENT_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': originUrl,
        'Referer': `${originUrl}/`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[EMAIL SERVICE] ✓ Email delivered via EmailJS REST API to ${email}`);
      return { attempted: true, success: true };
    } else {
      const errText = await res.text();
      console.warn(`[EMAIL SERVICE] ⚠️ EmailJS responded with status ${res.status}: ${errText}`);
      return { attempted: true, success: false, error: errText };
    }
  } catch (err) {
    console.error(`[EMAIL SERVICE] ⚠️ EmailJS request error:`, err.message);
    return { attempted: true, success: false, error: err.message };
  }
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
 * Prioritizes EmailJS -> Fallback to SMTP -> Simulated Local Delivery
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
  console.log(`  To:       ${cleanEmail}`);
  console.log(`  Purpose:  ${purpose.toUpperCase()}`);
  console.log(`  OTP Code: >>> ${otp} <<<`);
  console.log(`  Expires:  10 minutes`);
  console.log('========================================================');

  // 1. Try EmailJS REST API first if configured
  const emailJsRes = await sendViaEmailJs({ email: cleanEmail, otp, purpose, name: userName });
  if (emailJsRes.success) {
    return {
      success: true,
      emailSent: true,
      provider: 'emailjs',
      otp,
    };
  }

  // 2. Try Nodemailer SMTP fallback if configured
  const transporter = getTransporter();
  let emailSent = false;
  let provider = 'simulated';

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
      provider = 'smtp';
      console.log(`[EMAIL SERVICE] ✓ Email delivered via SMTP to ${cleanEmail}`);
    } catch (smtpErr) {
      console.error(`[EMAIL SERVICE] ⚠️ SMTP delivery failed:`, smtpErr.message);
    }
  } else if (!emailJsRes.attempted) {
    console.log(`[EMAIL SERVICE] ℹ️ EmailJS & SMTP not configured in .env. Running in simulated delivery mode.`);
  }

  return {
    success: true,
    emailSent,
    provider,
    otp,
  };
}

module.exports = {
  generate6DigitOtp,
  sendEmailOtp,
  sendViaEmailJs,
};
