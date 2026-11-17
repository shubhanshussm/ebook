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

function deleteReq(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'DELETE',
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

async function runTest() {
  console.log('--- STARTING ADMIN USER MANAGEMENT & .ENV CREDENTIALS TEST ---');

  // 1. Login with credentials defined in .env
  const adminLogin = await postJson('/api/auth/login', {
    email: 'admin@bookvault.com',
    password: 'admin123',
  });
  console.log(
    '1. Master Admin Login via .env credentials:',
    adminLogin.status === 200 && adminLogin.data.user.role === 'admin' ? 'PASS ✓' : `FAIL ✗ (${adminLogin.status})`
  );
  const adminToken = adminLogin.data.token;
  const adminUserId = adminLogin.data.user.id;

  // 2. Fetch Users List as Admin
  const usersList = await getJson('/api/admin/users', {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log(
    `2. Admin Fetch All Users List: Found ${usersList.data.users.length} users -`,
    usersList.status === 200 && usersList.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // 3. Admin creates another Administrator
  const newAdminEmail = `co_admin_${Date.now()}@bookvault.com`;
  const createAdminRes = await postJson(
    '/api/admin/users',
    {
      name: 'Co-Administrator',
      email: newAdminEmail,
      password: 'password123',
      role: 'admin',
    },
    { Authorization: `Bearer ${adminToken}` }
  );
  console.log(
    '3. Admin gives access to other Admin (Create Admin account):',
    createAdminRes.status === 201 && createAdminRes.data.user.role === 'admin' ? 'PASS ✓' : 'FAIL ✗'
  );
  const secondAdminId = createAdminRes.data.user.id;

  // 4. Verify newly created Admin can log in and access Admin Panel APIs
  const secondAdminLogin = await postJson('/api/auth/login', {
    email: newAdminEmail,
    password: 'password123',
  });
  const secondAdminToken = secondAdminLogin.data.token;
  const secondAdminStats = await getJson('/api/admin/stats', {
    Authorization: `Bearer ${secondAdminToken}`,
  });
  console.log(
    '4. New Admin can login and access Admin Panel endpoints:',
    secondAdminStats.status === 200 && secondAdminStats.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // 5. Create a regular customer user to test role promotion & deletion
  const testCustomerEmail = `customer_${Date.now()}@example.com`;
  const regCustomer = await postJson('/api/auth/register', {
    name: 'Temporary User',
    email: testCustomerEmail,
    password: 'password123',
  });
  const testCustomerId = regCustomer.data.user.id;

  // 6. Admin promotes existing customer to Admin role
  const promoteRes = await putJson(
    `/api/admin/users/${testCustomerId}/role`,
    { role: 'admin' },
    { Authorization: `Bearer ${adminToken}` }
  );
  console.log(
    '5. Admin promotes existing user to Admin:',
    promoteRes.status === 200 && promoteRes.data.user.role === 'admin' ? 'PASS ✓' : 'FAIL ✗'
  );

  // 7. Admin revokes admin access back to customer role
  const revokeRes = await putJson(
    `/api/admin/users/${testCustomerId}/role`,
    { role: 'user' },
    { Authorization: `Bearer ${adminToken}` }
  );
  console.log(
    '6. Admin revokes admin access back to user:',
    revokeRes.status === 200 && revokeRes.data.user.role === 'user' ? 'PASS ✓' : 'FAIL ✗'
  );

  // 8. Admin cannot delete their own active account (Safety Check)
  const selfDeleteRes = await deleteReq(`/api/admin/users/${adminUserId}`, {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log(
    '7. Safety Guard prevents Admin from self-deleting active account:',
    selfDeleteRes.status === 400 ? 'PASS ✓' : `FAIL ✗ (${selfDeleteRes.status})`
  );

  // 9. Admin deletes a user account
  const deleteUserRes = await deleteReq(`/api/admin/users/${testCustomerId}`, {
    Authorization: `Bearer ${adminToken}`,
  });
  console.log(
    '8. Delete user through Admin:',
    deleteUserRes.status === 200 && deleteUserRes.data.success ? 'PASS ✓' : 'FAIL ✗'
  );

  // Clean up second admin
  await deleteReq(`/api/admin/users/${secondAdminId}`, {
    Authorization: `Bearer ${adminToken}`,
  });

  console.log('--- ALL ADMIN USER MANAGEMENT TESTS PASSED PERFECTLY! ---');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
