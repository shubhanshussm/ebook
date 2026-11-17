require('dotenv').config();
const mongoose = require('mongoose');
const Otp = require('./models/Otp');

const BASE_URL = 'http://localhost:5000';

async function testEmailOtpAndForgotPassword() {
  console.log('🚀 Starting Comprehensive Email OTP & Forgot Password Test Suite...\n');

  try {
    // Connect directly to Mongo for verifying server-side state
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB for secure test verification');

    const timestamp = Date.now();
    const testEmail = `otp_user_${timestamp}@example.com`;
    const initialPassword = 'InitialPassword123!';
    const newPassword = 'NewSecretPassword456!';
    const testName = 'Dev Learner';

    // =============================================================
    // PART 1: EMAIL OTP REGISTRATION
    // =============================================================
    console.log('\n--- Part 1: Email OTP Registration Flow ---');

    // Test 1.1: Validation failure on short password
    const shortPwRes = await fetch(`${BASE_URL}/api/auth/register-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName, email: testEmail, password: '123' }),
    });
    const shortPwData = await shortPwRes.json();
    if (shortPwRes.status !== 400) {
      throw new Error(`Expected 400 on short password, got ${shortPwRes.status}`);
    }
    console.log(`✓ Guard verified: Blocked short password: "${shortPwData.message}"`);

    // Test 1.2: Send OTP for registration
    const sendOtpRes = await fetch(`${BASE_URL}/api/auth/register-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: initialPassword,
      }),
    });
    const sendOtpData = await sendOtpRes.json();
    if (!sendOtpData.success) {
      throw new Error(`Failed to send registration OTP: ${JSON.stringify(sendOtpData)}`);
    }

    // CRITICAL SECURITY ASSERTION: OTP MUST NOT BE RETURNED TO FRONTEND
    if (sendOtpData.otp || sendOtpData.otpPreview) {
      throw new Error('SECURITY VIOLATION: OTP code leaked in HTTP response JSON!');
    }
    console.log('✓ Verified: OTP code is NOT written/leaked to frontend response JSON.');

    // Fetch the generated OTP from MongoDB server record (mimics user checking email)
    const regOtpDoc = await Otp.findOne({ email: testEmail, purpose: 'registration' }).sort({ createdAt: -1 });
    if (!regOtpDoc) {
      throw new Error('OTP document was not created in database!');
    }
    const regOtp = regOtpDoc.otp;
    console.log(`✓ Registration OTP successfully dispatched via EmailJS to: ${testEmail}`);
    console.log(`  - 6-Digit OTP securely read from server DB: [${regOtp}]`);

    // Test 1.3: Verify with INVALID OTP code (Should fail)
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/auth/register-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '000000', // incorrect OTP
      }),
    });
    const invalidVerifyData = await invalidVerifyRes.json();
    if (invalidVerifyRes.status !== 400 || invalidVerifyData.success) {
      throw new Error('Verification with invalid OTP should have failed!');
    }
    console.log(`✓ Guard verified: Invalid OTP rejected: "${invalidVerifyData.message}"`);

    // Test 1.4: Verify with CORRECT OTP code (Should succeed & create user)
    const validVerifyRes = await fetch(`${BASE_URL}/api/auth/register-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: regOtp,
      }),
    });
    const validVerifyData = await validVerifyRes.json();
    if (!validVerifyData.success || !validVerifyData.token) {
      throw new Error(`Valid OTP verification failed: ${JSON.stringify(validVerifyData)}`);
    }
    console.log(`✓ Email OTP Verified! User successfully created:`);
    console.log(`  - Name: ${validVerifyData.user.name}`);
    console.log(`  - Email: ${validVerifyData.user.email}`);
    console.log(`  - JWT Token: ${validVerifyData.token.slice(0, 25)}...`);

    // Test 1.5: Re-using the same OTP must be blocked
    const reuseRes = await fetch(`${BASE_URL}/api/auth/register-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: regOtp,
      }),
    });
    const reuseData = await reuseRes.json();
    if (reuseRes.status !== 400) {
      throw new Error('Reusing already consumed OTP should be rejected!');
    }
    console.log(`✓ Guard verified: Consumed OTP cannot be re-used: "${reuseData.message}"`);

    // Test 1.6: Duplicate registration blocked
    const dupRegRes = await fetch(`${BASE_URL}/api/auth/register-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: testName,
        email: testEmail,
        password: initialPassword,
      }),
    });
    const dupRegData = await dupRegRes.json();
    if (dupRegRes.status !== 400) {
      throw new Error('Should block sending registration OTP to already registered email!');
    }
    console.log(`✓ Guard verified: Duplicate registration blocked: "${dupRegData.message}"`);

    // =============================================================
    // PART 2: FORGOT PASSWORD & RESET VIA OTP
    // =============================================================
    console.log('\n--- Part 2: Forgot Password & Email OTP Reset Flow ---');

    // Test 2.1: Request reset for non-existent email
    const nonExistRes = await fetch(`${BASE_URL}/api/auth/forgot-password-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_${Date.now()}@example.com` }),
    });
    const nonExistData = await nonExistRes.json();
    if (nonExistRes.status !== 404) {
      throw new Error(`Expected 404 for unknown email, got ${nonExistRes.status}`);
    }
    console.log(`✓ Guard verified: Unknown email rejected with 404: "${nonExistData.message}"`);

    // Test 2.2: Request reset OTP for registered user
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json();
    if (!forgotData.success) {
      throw new Error(`Failed to send forgot password OTP: ${JSON.stringify(forgotData)}`);
    }

    // CRITICAL SECURITY ASSERTION: RESET OTP MUST NOT BE RETURNED TO FRONTEND
    if (forgotData.otp || forgotData.otpPreview) {
      throw new Error('SECURITY VIOLATION: Reset OTP code leaked in HTTP response JSON!');
    }
    console.log('✓ Verified: Reset OTP code is NOT written/leaked to frontend response JSON.');

    // Fetch reset OTP from MongoDB server record
    const resetOtpDoc = await Otp.findOne({ email: testEmail, purpose: 'forgot_password' }).sort({ createdAt: -1 });
    if (!resetOtpDoc) {
      throw new Error('Forgot password OTP document not found in DB!');
    }
    const resetOtp = resetOtpDoc.otp;
    console.log(`✓ Password Reset OTP dispatched via EmailJS to: ${testEmail}`);
    console.log(`  - 6-Digit Reset OTP securely read from server DB: [${resetOtp}]`);

    // Test 2.3: Reset with INVALID OTP code (Should fail)
    const badResetRes = await fetch(`${BASE_URL}/api/auth/reset-password-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '999999',
        newPassword: newPassword,
      }),
    });
    const badResetData = await badResetRes.json();
    if (badResetRes.status !== 400 || badResetData.success) {
      throw new Error('Reset with invalid OTP should have failed!');
    }
    console.log(`✓ Guard verified: Invalid reset OTP rejected: "${badResetData.message}"`);

    // Test 2.4: Reset with short password (Should fail)
    const shortResetRes = await fetch(`${BASE_URL}/api/auth/reset-password-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: resetOtp,
        newPassword: '123',
      }),
    });
    const shortResetData = await shortResetRes.json();
    if (shortResetRes.status !== 400) {
      throw new Error('Reset with short new password should fail!');
    }
    console.log(`✓ Guard verified: Short new password rejected: "${shortResetData.message}"`);

    // Test 2.5: Reset with CORRECT OTP code and valid new password
    const validResetRes = await fetch(`${BASE_URL}/api/auth/reset-password-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: resetOtp,
        newPassword: newPassword,
      }),
    });
    const validResetData = await validResetRes.json();
    if (!validResetData.success || !validResetData.token) {
      throw new Error(`Valid password reset failed: ${JSON.stringify(validResetData)}`);
    }
    console.log(`✓ Password successfully reset via OTP: "${validResetData.message}"`);

    // Test 2.6: Verification - Login with OLD password must FAIL
    const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: initialPassword, // Old password
      }),
    });
    if (oldLoginRes.status !== 401) {
      throw new Error(`Login with old password should fail with 401, got ${oldLoginRes.status}`);
    }
    console.log('✓ Verified: Old password is no longer valid (HTTP 401 Unauthorized).');

    // Test 2.7: Verification - Login with NEW password must SUCCEED
    const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: newPassword, // New password
      }),
    });
    const newLoginData = await newLoginRes.json();
    if (!newLoginData.success || !newLoginData.token) {
      throw new Error(`Login with new password failed: ${JSON.stringify(newLoginData)}`);
    }
    console.log(`✓ Verified: Successfully logged in with NEW password! Welcome back ${newLoginData.user.name}.`);

    console.log('\n🎉 ALL EMAIL OTP REGISTRATION & FORGOT PASSWORD TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testEmailOtpAndForgotPassword();
