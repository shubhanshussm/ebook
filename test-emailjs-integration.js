require('dotenv').config();

const BASE_URL = 'http://localhost:5000';

async function testEmailJsIntegration() {
  console.log('🚀 Starting EmailJS Specific Integration Test Suite...\n');

  try {
    // 1. Fetch EmailJS Config
    console.log('--- Test 1: Fetch EmailJS Configuration ---');
    const configRes = await fetch(`${BASE_URL}/api/auth/emailjs-config`);
    const configData = await configRes.json();
    if (!configData.success || !configData.config) {
      throw new Error(`Failed to fetch EmailJS config: ${JSON.stringify(configData)}`);
    }
    console.log(`✓ EmailJS Config Endpoint Active:`, configData.config);

    // 2. Registration OTP Response includes EmailJS parameters
    console.log('\n--- Test 2: Registration OTP Response contains EmailJS Metadata ---');
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
    if (!regData.success || !regData.emailJs || !regData.otpPreview) {
      throw new Error(`EmailJS payload missing in register-send-otp: ${JSON.stringify(regData)}`);
    }
    console.log(`✓ Registration OTP Response ready for EmailJS Browser SDK:`);
    console.log(`  - Target Email: ${regData.email}`);
    console.log(`  - OTP Code: ${regData.otpPreview}`);
    console.log(`  - EmailJS Service ID: ${regData.emailJs.serviceId || '(Set in .env or Settings)'}`);

    // Complete registration
    await fetch(`${BASE_URL}/api/auth/register-verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: regData.otpPreview,
      }),
    });

    // 3. Forgot Password OTP Response includes EmailJS parameters
    console.log('\n--- Test 3: Forgot Password OTP Response contains EmailJS Metadata ---');
    const forgotRes = await fetch(`${BASE_URL}/api/auth/forgot-password-send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    const forgotData = await forgotRes.json();
    if (!forgotData.success || !forgotData.emailJs || !forgotData.otpPreview) {
      throw new Error(`EmailJS payload missing in forgot-password-send-otp: ${JSON.stringify(forgotData)}`);
    }
    console.log(`✓ Forgot Password OTP Response ready for EmailJS Browser SDK:`);
    console.log(`  - Target Email: ${forgotData.email}`);
    console.log(`  - Reset OTP: ${forgotData.otpPreview}`);
    console.log(`  - EmailJS Service ID: ${forgotData.emailJs.serviceId || '(Set in .env or Settings)'}`);

    console.log('\n🎉 ALL EMAILJS INTEGRATION TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testEmailJsIntegration();
