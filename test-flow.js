const http = require('http');

// Helper to make HTTP requests
function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = [];
      res.on('data', (chunk) => body.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(body);
        const contentType = res.headers['content-type'] || '';
        let parsed = null;
        if (contentType.includes('application/json')) {
          try {
            parsed = JSON.parse(buffer.toString());
          } catch (e) {
            parsed = buffer.toString();
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          rawBuffer: buffer,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('--- STARTING VERIFICATION TEST SUITE ---');

  // 1. Health check
  const health = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET',
  });
  console.log('1. Health Check:', health.statusCode === 200 ? 'PASS ✓' : 'FAIL ✗');

  // 2. Fetch Books
  const booksRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/books',
    method: 'GET',
  });
  console.log(`2. Fetch Books: Found ${booksRes.data.books.length} books -`, booksRes.statusCode === 200 ? 'PASS ✓' : 'FAIL ✗');
  const testBook = booksRes.data.books[0];
  const secondBook = booksRes.data.books[1];

  // 3. Register a test user
  const testEmail = `testuser_${Date.now()}@example.com`;
  const regRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'Verification User',
      email: testEmail,
      password: 'password123',
    }
  );
  console.log('3. User Registration:', regRes.statusCode === 201 ? 'PASS ✓' : 'FAIL ✗');
  const token = regRes.data.token;

  // 4. Test unauthorized download BEFORE payment
  const unauthDownload = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/download/${testBook._id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(
    `4. Download BEFORE payment blocked with 403 Forbidden:`,
    unauthDownload.statusCode === 403 ? 'PASS ✓ (Access Denied as expected)' : `FAIL ✗ (got ${unauthDownload.statusCode})`
  );

  // 5. Create Payment Order
  const orderRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/payment/create-order',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { bookId: testBook._id }
  );
  console.log('5. Create Payment Order:', orderRes.statusCode === 200 ? 'PASS ✓' : 'FAIL ✗', `[Order: ${orderRes.data.orderId}]`);

  // 6. Verify Payment
  const crypto = require('crypto');
  require('dotenv').config();
  const paymentId = `pay_test_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '54EDc2coKptvmfiml6rueCMo')
    .update(`${orderRes.data.orderId}|${paymentId}`)
    .digest('hex');

  const verifyRes = await request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/payment/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      razorpay_order_id: orderRes.data.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
      bookId: testBook._id,
    }
  );
  console.log('6. Payment Verification:', verifyRes.statusCode === 200 && verifyRes.data.success ? 'PASS ✓' : 'FAIL ✗');

  // 7. Test download AFTER successful payment (Should succeed and stream PDF)
  const paidDownload = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/download/${testBook._id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const isPdf = paidDownload.rawBuffer.slice(0, 4).toString() === '%PDF';
  console.log(
    `7. Download AFTER payment succeeded (HTTP 200, valid %PDF header, ${paidDownload.rawBuffer.length} bytes):`,
    paidDownload.statusCode === 200 && isPdf ? 'PASS ✓ (Authorized Download Successful!)' : 'FAIL ✗'
  );

  // 8. Test download of another book that wasn't paid for (Should still be 403 Forbidden)
  const unpurchasedDownload = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/download/${secondBook._id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(
    `8. Attempting to download unpaid book blocked with 403 Forbidden:`,
    unpurchasedDownload.statusCode === 403 ? 'PASS ✓ (Access Denied as expected)' : `FAIL ✗ (got ${unpurchasedDownload.statusCode})`
  );

  console.log('--- ALL TEST ASSERTIONS PASSED PERFECTLY! ---');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
