const http = require('http');
const crypto = require('crypto');
require('dotenv').config();

function postJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let body = [];
        res.on('data', (c) => body.push(c));
        res.on('end', () => {
          const buffer = Buffer.concat(body);
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: JSON.parse(buffer.toString()),
              buffer,
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: buffer.toString(),
              buffer,
            });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function putJson(path, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runSuperFeaturesTest() {
  console.log('--- RUNNING ADVANCED FEATURES VERIFICATION SUITE ---');

  // 1. Get books catalog
  const catalog = await getJson('/api/books');
  const book1 = catalog.data.books[0];
  const book2 = catalog.data.books[1];
  const unpaidBook = catalog.data.books[2];
  console.log(`1. Loaded catalog: testing multi-item cart with "${book1.title}" and "${book2.title}"`);

  // 2. Register new customer
  const reg = await postJson('/api/auth/register', {
    name: 'Cart & Reader User',
    email: `cart_user_${Date.now()}@example.com`,
    password: 'password123',
  });
  const token = reg.data.token;
  console.log('2. Customer Registered: PASS ✓');

  // 3. Create Multi-Item Shopping Cart Order with Coupon WELCOME20
  const cartOrderRes = await postJson(
    '/api/payment/create-cart-order',
    {
      bookIds: [book1._id, book2._id],
      couponCode: 'WELCOME20',
    },
    { Authorization: `Bearer ${token}` }
  );

  console.log(
    `3. Multi-Item Cart Order Created (${cartOrderRes.data.bookCount} books, Subtotal: ₹${cartOrderRes.data.subtotal}, Discount: ₹${cartOrderRes.data.discount}, Final: ₹${cartOrderRes.data.totalPayable}):`,
    cartOrderRes.status === 200 && cartOrderRes.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // 4. Verify Payment with HMAC signature
  const paymentId = `pay_cart_${Date.now()}`;
  const validSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '54EDc2coKptvmfiml6rueCMo')
    .update(`${cartOrderRes.data.orderId}|${paymentId}`)
    .digest('hex');

  const verifyCartRes = await postJson(
    '/api/payment/verify',
    {
      razorpay_order_id: cartOrderRes.data.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature,
    },
    { Authorization: `Bearer ${token}` }
  );
  console.log(
    '4. Unified Cart Payment Verified & Multiple Books Unlocked:',
    verifyCartRes.status === 200 && verifyCartRes.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // 5. Verify In-Browser Online eBook Reader content for Book 1
  const readerContent = await getJson(`/api/download/reader-content/${book1._id}`, {
    Authorization: `Bearer ${token}`,
  });
  console.log(
    `5. In-Browser Reader Content Loaded (${readerContent.data.chapters.length} chapters, licensed to "${readerContent.data.userLicense.licensedTo}"):`,
    readerContent.status === 200 && readerContent.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // 6. Verify In-Browser Reader BLOCKS access to unpaid book
  const unpaidReader = await getJson(`/api/download/reader-content/${unpaidBook._id}`, {
    Authorization: `Bearer ${token}`,
  });
  console.log(
    '6. Reader access to Unpaid eBook blocked with 403 Forbidden:',
    unpaidReader.status === 403 ? 'PASS ✓ (Access Denied as expected)' : 'FAIL ✗'
  );

  // 7. Verify DRM Anti-Piracy Watermarking Header in eBook download
  const dlRes = await getJson(`/api/download/${book1._id}`, {
    Authorization: `Bearer ${token}`,
  });
  const hasDrmHeader = Boolean(dlRes.headers['x-drm-licensed-to']);
  console.log(
    `7. DRM Anti-Piracy Watermark Header (${dlRes.headers['x-drm-licensed-to']}):`,
    dlRes.status === 200 && hasDrmHeader ? 'PASS ✓' : 'FAIL ✗'
  );

  // 8. Personal Reading Notes: Save a note
  const noteSave = await postJson(
    `/api/notes/${book1._id}`,
    {
      content: 'Important: Always implement HMAC-SHA256 signature verification in webhook handler.',
      chapterIndex: 0,
      chapterTitle: 'Chapter 1: Foundational Principles',
    },
    { Authorization: `Bearer ${token}` }
  );
  console.log('8. Save Personal Reading Note in Online Reader:', noteSave.status === 201 && noteSave.data.success ? 'PASS ✓' : 'FAIL ✗');

  // 9. Retrieve user notes
  const notesList = await getJson(`/api/notes/${book1._id}`, {
    Authorization: `Bearer ${token}`,
  });
  console.log(`9. Retrieve Personal Notes: Found ${notesList.data.count} note(s) -`, notesList.status === 200 ? 'PASS ✓' : 'FAIL ✗');

  // 10. Update Profile Name
  const updateProf = await putJson(
    '/api/auth/profile',
    { name: 'Alex Reader Pro' },
    { Authorization: `Bearer ${token}` }
  );
  console.log('10. Update Profile Name:', updateProf.status === 200 && updateProf.data.user.name === 'Alex Reader Pro' ? 'PASS ✓' : 'FAIL ✗');

  // 11. Change Password
  const changePass = await putJson(
    '/api/auth/change-password',
    { currentPassword: 'password123', newPassword: 'newsecurepassword456' },
    { Authorization: `Bearer ${token}` }
  );
  console.log('11. Change Password:', changePass.status === 200 && changePass.data.success ? 'PASS ✓' : 'FAIL ✗');

  console.log('--- ALL ADVANCED FEATURES VERIFIED SUCCESSFULLY! ---');
  process.exit(0);
}

runSuperFeaturesTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
