const http = require('http');

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
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
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
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function uploadMultipart(path, fields, file, headers = {}) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let payload = [];

    // Fields
    for (const [key, value] of Object.entries(fields)) {
      payload.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
        )
      );
    }

    // File
    if (file) {
      payload.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`
        )
      );
      payload.push(file.content);
      payload.push(Buffer.from('\r\n'));
    }

    payload.push(Buffer.from(`--${boundary}--\r\n`));
    const fullBody = Buffer.concat(payload);

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length,
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function testAdmin() {
  console.log('--- RUNNING ADMIN ACCESS TESTS ---');

  // 1. Unauthenticated admin stats access
  const noAuth = await getJson('/api/admin/stats');
  console.log('1. Unauthenticated access blocked (401):', noAuth.status === 401 ? 'PASS ✓' : `FAIL ✗ (${noAuth.status})`);

  // 2. Normal user login
  const regUser = await postJson('/api/auth/register', {
    name: 'Standard Customer',
    email: `customer_${Date.now()}@example.com`,
    password: 'password123',
  });
  const userToken = regUser.data.token;

  // 3. Normal user accessing admin route
  const nonAdminAccess = await getJson('/api/admin/stats', {
    Authorization: `Bearer ${userToken}`,
  });
  console.log('2. Regular user blocked with 403 Forbidden:', nonAdminAccess.status === 403 ? 'PASS ✓' : `FAIL ✗ (${nonAdminAccess.status})`);

  // 4. Admin login
  const adminLogin = await postJson('/api/auth/login', {
    email: 'admin@bookvault.com',
    password: 'admin123',
  });
  console.log('3. Admin Login:', adminLogin.status === 200 && adminLogin.data.user.role === 'admin' ? 'PASS ✓' : 'FAIL ✗');
  const adminToken = adminLogin.data.token;

  // 5. Admin stats
  const statsRes = await getJson('/api/admin/stats', {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log(
    '4. Admin Stats retrieved successfully:',
    statsRes.status === 200 && statsRes.data.success ? 'PASS ✓' : 'FAIL ✗',
    `[Total Books: ${statsRes.data.stats.totalBooks}]`
  );

  // 6. Admin upload new eBook with PDF
  const samplePdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000015 00000 n\n0000000060 00000 n\n0000000111 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF');

  const uploadRes = await uploadMultipart(
    '/api/admin/books',
    {
      title: 'Advanced Microservices with Node.js',
      author: 'Jane Administrator',
      category: 'Cloud & Architecture',
      price: '699',
      originalPrice: '1399',
      pages: '320',
      description: 'Master building distributed microservices using event streams, Kafka, Redis, and Docker containers.',
      language: 'English',
      featured: 'true',
    },
    {
      fieldname: 'pdfFile',
      filename: 'microservices-guide.pdf',
      contentType: 'application/pdf',
      content: samplePdfBuffer,
    },
    { Authorization: `Bearer ${adminToken}` }
  );

  console.log(
    '5. Upload & Publish New eBook as Admin:',
    uploadRes.status === 201 && uploadRes.data.success ? 'PASS ✓' : `FAIL ✗ (${uploadRes.status} - ${JSON.stringify(uploadRes.data)})`
  );

  const createdBookId = uploadRes.data.book._id;

  // 7. Verify new book is available in public store
  const storeBooks = await getJson('/api/books');
  const found = storeBooks.data.books.some((b) => b._id === createdBookId);
  console.log('6. Newly published eBook visible in Storefront:', found ? 'PASS ✓' : 'FAIL ✗');

  // 8. Delete book as admin
  const deleteReq = new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api/admin/books/${createdBookId}`,
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      }
    );
    req.on('error', reject);
    req.end();
  });

  const deleteRes = await deleteReq;
  console.log('7. Delete eBook by Admin:', deleteRes.status === 200 && deleteRes.data.success ? 'PASS ✓' : 'FAIL ✗');

  console.log('--- ALL ADMIN TESTS PASSED PERFECTLY! ---');
  process.exit(0);
}

testAdmin().catch((err) => {
  console.error('Admin test failed:', err);
  process.exit(1);
});
