require('dotenv').config();
const mongoose = require('mongoose');
const Otp = require('./models/Otp');

const BASE_URL = 'http://localhost:5000';

async function testEmailJsIntegration() {
  console.log('🚀 Starting EmailJS Specific Integration Test Suite...\n');

  try {
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Fetch EmailJS Config
    console.log('--- Test 1: Fetch EmailJS Configuration ---');
    const configRes = await fetch(`${BASE_URL}/api/auth/emailjs-config`);
    const configData = await configRes.json();
    if (!configData.success || !configData.config) {
      throw new Error(`Failed to fetch EmailJS config: ${JSON.stringify(configData)}`);
    }
    console.log(`✓ EmailJS Config Endpoint Active:`, configData.config);

    // 2. Registration OTP Response - OTP must NOT be leaked to frontend
    console.log('\n--- Test 2: Registration OTP Request ---');
    const testEmail = `emailjs_test_${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'EmailJS Tester',
        email: testEmail,
        password: 'Password123!',
      }),
    });
    const regData = await regRes.json();
    if (!regData.success) {
      throw new Error(`Registration OTP request failed: ${JSON.stringify(regData)}`);
    }

    if (regData.otp || regData.otpPreview) {
      throw new Error('SECURITY VIOLATION: OTP code leaked to frontend in register-send-otp response!');
    }
    console.log(`✓ Registration OTP dispatched via EmailJS REST API without frontend leakage:`);
    console.log(`  - Target Email: ${regData.email}`);

    // Read OTP from server DB
    const regOtpDoc = await Otp.findOne({ email: testEmail, purpose: 'registration' }).sort({ createdAt: -1 });
    const regOtp = regOtpDoc.otp;

    // Complete registration
    const verifyRes = await fetch(`${BASE_URL}/api/auth/register-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: regOtp,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      throw new Error(`Registration verification failed: ${JSON.stringify(verifyData)}`);
    }
    console.log(`✓ Registration verified successfully with code [${regOtp}]`);

    // 3. Forgot Password OTP Response - OTP must NOT be leaked to frontend
    console.log('\n--- Test 3: Forgot Password OTP Request ---');
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json();
    if (!forgotData.success) {
      throw new Error(`Forgot password OTP request failed: ${JSON.stringify(forgotData)}`);
    }

    if (forgotData.otp || forgotData.otpPreview) {
      throw new Error('SECURITY VIOLATION: OTP code leaked to frontend in forgot-password-send-otp response!');
    }
    console.log(`✓ Forgot Password OTP dispatched via EmailJS without frontend leakage:`);
    console.log(`  - Target Email: ${forgotData.email}`);

    // Read OTP from server DB
    const forgotOtpDoc = await Otp.findOne({ email: testEmail, purpose: 'forgot_password' }).sort({ createdAt: -1 });
    const forgotOtp = forgotOtpDoc.otp;

    // Reset password
    const resetRes = await fetch(`${BASE_URL}/api/auth/reset-password-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: forgotOtp,
        newPassword: 'NewPassword789!',
      }),
    });
    const resetData = await resetRes.json();
    if (!resetData.success) {
      throw new Error(`Password reset failed: ${JSON.stringify(resetData)}`);
    }
    console.log(`✓ Password reset successfully with code [${forgotOtp}]`);

    console.log('\n🎉 ALL EMAILJS INTEGRATION TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testEmailJsIntegration();
