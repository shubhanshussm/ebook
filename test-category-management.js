require('dotenv').config();
const BASE_URL = 'http://localhost:5000';

async function testCategoryManagement() {
  console.log('🚀 Starting Category Management Verification Test Suite...\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Fetch Categories (Public Endpoint)
    // -------------------------------------------------------------
    console.log('--- Test 1: Fetch Categories & Auto-Seeding ---');
    const getRes = await fetch(`${BASE_URL}/api/categories`);
    const getData = await getRes.json();
    if (!getData.success || !Array.isArray(getData.categories)) {
      throw new Error(`Failed to fetch categories: ${JSON.stringify(getData)}`);
    }
    console.log(`✓ Fetched ${getData.categories.length} categories:`);
    getData.categories.forEach((c) => {
      console.log(`  - [${c.icon}] ${c.name} (${c.bookCount} books)`);
    });

    // -------------------------------------------------------------
    // Test 2: Admin Login
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Admin Authentication ---');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookvault.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const authData = await loginRes.json();
    if (!authData.success || !authData.token) {
      throw new Error(`Admin login failed: ${authData.message}`);
    }
    const adminToken = authData.token;
    console.log(`✓ Admin logged in: ${adminEmail}`);

    // -------------------------------------------------------------
    // Test 3: Unauthorized Customer cannot create category
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Security Guard - Regular User Access Check ---');
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Regular Customer',
        email: `cust_${Date.now()}@test.com`,
        password: 'password123',
      }),
    });
    const custAuth = await regRes.json();
    const custToken = custAuth.token;

    const unauthRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        name: 'Hacked Category',
      }),
    });

    if (unauthRes.status !== 403) {
      throw new Error(`Customer should receive 403 Forbidden! Received: ${unauthRes.status}`);
    }
    console.log('✓ Guard verified: Regular users blocked from adding categories (HTTP 403 Forbidden).');

    // -------------------------------------------------------------
    // Test 4: Admin creates a new category
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Admin Creates New Category ---');
    const testCatName = `DevOps & SRE Excellence ${Date.now().toString().slice(-4)}`;
    const createRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: testCatName,
        icon: '⚡',
        description: 'Site Reliability Engineering, CI/CD and automation',
      }),
    });

    const createData = await createRes.json();
    if (!createData.success || !createData.category) {
      throw new Error(`Category creation failed: ${JSON.stringify(createData)}`);
    }
    const newCatId = createData.category._id;
    console.log(`✓ Admin created category: "${createData.category.name}" (ID: ${newCatId})`);

    // -------------------------------------------------------------
    // Test 5: Duplicate Category Prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Duplicate Category Name Prevention ---');
    const dupRes = await fetch(`${BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: testCatName.toLowerCase(), // Case-insensitive check
        icon: '⚡',
      }),
    });
    const dupData = await dupRes.json();
    if (dupData.success) {
      throw new Error('Duplicate category creation should have been blocked!');
    }
    console.log(`✓ Duplicate check verified: "${dupData.message}"`);

    // -------------------------------------------------------------
    // Test 6: Delete Category with 0 Books
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Delete Empty Category ---');
    const delRes = await fetch(`${BASE_URL}/api/categories/${newCatId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const delData = await delRes.json();
    if (!delData.success) {
      throw new Error(`Delete category failed: ${JSON.stringify(delData)}`);
    }
    console.log(`✓ Category successfully deleted: "${delData.message}"`);

    // -------------------------------------------------------------
    // Test 7: Safety Guard - Cannot delete category with assigned eBooks
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Safety Guard - Prevent Deletion of Category with Assigned Books ---');
    // "Programming" category has existing books
    const allCatsRes = await fetch(`${BASE_URL}/api/categories`);
    const allCats = await allCatsRes.json();
    const programmingCat = allCats.categories.find((c) => c.name === 'Programming' && c.bookCount > 0);

    if (programmingCat) {
      const blockedDelRes = await fetch(`${BASE_URL}/api/categories/${programmingCat._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const blockedDelData = await blockedDelRes.json();
      if (blockedDelData.success) {
        throw new Error('Should NOT allow deleting category with assigned books!');
      }
      console.log(`✓ Safety Guard verified: Blocked deletion of category with books: "${blockedDelData.message}"`);
    }

    // -------------------------------------------------------------
    // Test 8: Restore Default Predefined Categories
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Admin Restores Default Predefined Categories ---');
    const resetRes = await fetch(`${BASE_URL}/api/categories/reset-defaults`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resetData = await resetRes.json();
    if (!resetData.success) {
      throw new Error(`Reset defaults failed: ${JSON.stringify(resetData)}`);
    }
    console.log(`✓ Predefined categories restored: "${resetData.message}"`);

    // Verify all 7 predefined categories exist
    const finalCatsRes = await fetch(`${BASE_URL}/api/categories`);
    const finalCats = await finalCatsRes.json();
    const expected = [
      'Programming',
      'Artificial Intelligence',
      'Cloud & Architecture',
      'Career & Self-Help',
      'Design & Frontend',
      'Business & Finance',
      'Fiction & Novels',
    ];
    for (const exp of expected) {
      const found = finalCats.categories.find((c) => c.name.toLowerCase() === exp.toLowerCase());
      if (!found) {
        throw new Error(`Expected predefined category "${exp}" not found in database!`);
      }
    }
    console.log(`✓ Verified all 7 predefined categories are active: ${expected.join(', ')}`);

    console.log('\n🎉 ALL CATEGORY MANAGEMENT TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testCategoryManagement();
