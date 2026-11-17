// Automated test suite for new features:
// 1. Search Autocomplete
// 2. Curated Value Bundles
// 3. Gift eBook purchase & Gift Code generation
// 4. Gift Code redemption by friend & library unlock
// 5. Reading progress tracker & reading stats
// 6. Admin gifts overview log

require('dotenv').config();
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000';

async function runTestSuite() {
  console.log('🚀 Starting Verification Test Suite for New Advanced Features...\n');

  try {
    // -------------------------------------------------------------
    // Test 1: Search Autocomplete Endpoint
    // -------------------------------------------------------------
    console.log('--- Test 1: Testing Search Autocomplete ---');
    const autoRes = await fetch(`${BASE_URL}/api/books/autocomplete?q=script`);
    const autoData = await autoRes.json();
    if (!autoData.success || !Array.isArray(autoData.suggestions)) {
      throw new Error(`Autocomplete failed: ${JSON.stringify(autoData)}`);
    }
    console.log(`✓ Autocomplete returned ${autoData.suggestions.length} matching suggestion(s).`);

    // -------------------------------------------------------------
    // Test 2: Curated Value Bundles Endpoint
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Testing Curated Value Bundles ---');
    const bundleRes = await fetch(`${BASE_URL}/api/books/bundles`);
    const bundleData = await bundleRes.json();
    if (!bundleData.success || !Array.isArray(bundleData.bundles)) {
      throw new Error(`Bundles fetch failed: ${JSON.stringify(bundleData)}`);
    }
    console.log(`✓ Curated bundles returned ${bundleData.bundles.length} package(s):`);
    bundleData.bundles.forEach((b) => {
      console.log(`  - ${b.title}: ₹${b.bundlePrice} (Orig ₹${b.originalPrice}, Savings: ₹${b.savings}) [${b.badge}]`);
    });

    // -------------------------------------------------------------
    // Test 3: Sender Account Registration & Gift Order Creation
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Sender Account & Gift Order Creation ---');
    const senderEmail = `gift_sender_${Date.now()}@example.com`;
    const regSenderRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Amit Sharma',
        email: senderEmail,
        password: 'password123',
      }),
    });
    const senderAuth = await regSenderRes.json();
    if (!senderAuth.success) {
      throw new Error(`Sender registration failed: ${senderAuth.message}`);
    }
    const senderToken = senderAuth.token;
    console.log(`✓ Sender registered: ${senderEmail}`);

    // Get a book to gift
    const booksRes = await fetch(`${BASE_URL}/api/books`);
    const booksData = await booksRes.json();
    const bookToGift = booksData.books[0];
    console.log(`✓ Selected book to gift: "${bookToGift.title}" (ID: ${bookToGift._id})`);

    // Create Gift Order
    const recipientEmail = `friend_${Date.now()}@example.com`;
    const giftOrderRes = await fetch(`${BASE_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${senderToken}`,
      },
      body: JSON.stringify({
        bookId: bookToGift._id,
        isGift: true,
        recipientName: 'Vikram Verma',
        recipientEmail: recipientEmail,
        giftMessage: 'Happy Birthday Vikram! Enjoy this technical guide.',
      }),
    });
    const giftOrderData = await giftOrderRes.json();
    if (!giftOrderData.success || !giftOrderData.orderId) {
      throw new Error(`Gift order creation failed: ${JSON.stringify(giftOrderData)}`);
    }
    console.log(`✓ Gift order initiated: ${giftOrderData.orderId} (Mode: ${giftOrderData.mode})`);

    // Verify Gift Payment
    const secret = process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_sampleKeySecret456';
    const fakePaymentId = `pay_sim_${Date.now()}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${giftOrderData.orderId}|${fakePaymentId}`)
      .digest('hex');

    const verifyGiftRes = await fetch(`${BASE_URL}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${senderToken}`,
      },
      body: JSON.stringify({
        razorpay_order_id: giftOrderData.orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: signature,
        bookId: bookToGift._id,
      }),
    });

    const verifyGiftData = await verifyGiftRes.json();
    if (!verifyGiftData.success || !verifyGiftData.isGift || !verifyGiftData.giftCode) {
      throw new Error(`Gift payment verification failed: ${JSON.stringify(verifyGiftData)}`);
    }
    const generatedGiftCode = verifyGiftData.giftCode;
    console.log(`✓ Gift payment verified! Generated Gift Code: ${generatedGiftCode} for ${verifyGiftData.recipientName}`);

    // Verify that sender does NOT have the book (since it was bought as a gift)
    const senderMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${senderToken}` },
    });
    const senderMe = await senderMeRes.json();
    const senderOwnsBook = (senderMe.user.purchasedBooks || []).some(
      (b) => b._id.toString() === bookToGift._id.toString()
    );
    if (senderOwnsBook) {
      throw new Error('Sender should not automatically own gifted eBook!');
    }
    console.log('✓ Verified: Sender does not own the gifted book in their personal library.');

    // Verify sender can view sent gifts
    const sentGiftsRes = await fetch(`${BASE_URL}/api/gifts/my-sent-gifts`, {
      headers: { Authorization: `Bearer ${senderToken}` },
    });
    const sentGiftsData = await sentGiftsRes.json();
    if (!sentGiftsData.success || sentGiftsData.gifts.length === 0) {
      throw new Error(`My Sent Gifts failed: ${JSON.stringify(sentGiftsData)}`);
    }
    console.log(`✓ Verified: Sender dashboard lists ${sentGiftsData.gifts.length} sent gift(s).`);

    // -------------------------------------------------------------
    // Test 4: Recipient Registration & Gift Code Redemption
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Recipient Registration & Gift Code Redemption ---');
    const regRecipientRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Verma',
        email: recipientEmail,
        password: 'password123',
      }),
    });
    const recipientAuth = await regRecipientRes.json();
    const recipientToken = recipientAuth.token;
    console.log(`✓ Recipient registered: ${recipientEmail}`);

    // Redeem gift code
    const redeemRes = await fetch(`${BASE_URL}/api/gifts/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recipientToken}`,
      },
      body: JSON.stringify({ code: generatedGiftCode }),
    });
    const redeemData = await redeemRes.json();
    if (!redeemData.success) {
      throw new Error(`Gift redemption failed: ${redeemData.message}`);
    }
    console.log(`✓ Gift redeemed successfully: "${redeemData.message}"`);

    // Verify that attempting to redeem the same code twice fails
    const doubleRedeemRes = await fetch(`${BASE_URL}/api/gifts/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recipientToken}`,
      },
      body: JSON.stringify({ code: generatedGiftCode }),
    });
    const doubleRedeemData = await doubleRedeemRes.json();
    if (doubleRedeemData.success) {
      throw new Error('Double redemption security check failed!');
    }
    console.log(`✓ Guard verified: Cannot redeem the same gift code twice ("${doubleRedeemData.message}")`);

    // Verify recipient can read the gifted book online
    const readerRes = await fetch(`${BASE_URL}/api/download/reader-content/${bookToGift._id}`, {
      headers: { Authorization: `Bearer ${recipientToken}` },
    });
    const readerData = await readerRes.json();
    if (!readerData.success || !readerData.chapters) {
      throw new Error(`Recipient cannot access gifted book: ${JSON.stringify(readerData)}`);
    }
    console.log(`✓ Recipient verified access: Unlocked online reader with ${readerData.chapters.length} chapters.`);

    // -------------------------------------------------------------
    // Test 5: Reading Progress Tracking
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Testing Reading Progress Tracker ---');
    const saveProgRes = await fetch(`${BASE_URL}/api/progress/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${recipientToken}`,
      },
      body: JSON.stringify({
        bookId: bookToGift._id,
        currentChapter: 1, // Chapter 2
        totalChapters: 4,
      }),
    });
    const saveProgData = await saveProgRes.json();
    if (!saveProgData.success || saveProgData.progress.percentComplete !== 50) {
      throw new Error(`Save reading progress failed: ${JSON.stringify(saveProgData)}`);
    }
    console.log(`✓ Reading progress saved: Chapter 2 of 4 (50% complete)`);

    // Fetch Reading Stats
    const statsRes = await fetch(`${BASE_URL}/api/progress/stats/my-stats`, {
      headers: { Authorization: `Bearer ${recipientToken}` },
    });
    const statsData = await statsRes.json();
    if (!statsData.success || !statsData.stats) {
      throw new Error(`Fetch reading stats failed: ${JSON.stringify(statsData)}`);
    }
    console.log(`✓ Recipient reading stats: ${statsData.stats.totalOwned} owned, ${statsData.stats.inProgressCount} in progress, streak ${statsData.stats.streakDays} day(s).`);

    // -------------------------------------------------------------
    // Test 6: Admin Gifts Log & Platform Stats
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Testing Admin Gifts Log & Stats ---');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookvault.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const adminAuth = await adminLoginRes.json();
    const adminToken = adminAuth.token;

    const adminGiftsRes = await fetch(`${BASE_URL}/api/admin/gifts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGiftsData = await adminGiftsRes.json();
    if (!adminGiftsData.success || !Array.isArray(adminGiftsData.gifts)) {
      throw new Error(`Admin gifts log failed: ${JSON.stringify(adminGiftsData)}`);
    }
    console.log(`✓ Admin gifts log verified: Found ${adminGiftsData.gifts.length} gift voucher(s) in system.`);

    const adminStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminStatsData = await adminStatsRes.json();
    console.log(`✓ Admin overview stats verified: ${adminStatsData.stats.totalGifts} gifts, ${adminStatsData.stats.totalOrders} paid orders, ₹${adminStatsData.stats.totalRevenue} revenue.`);

    console.log('\n🎉 ALL ADVANCED FEATURE TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test suite failed with error:', err);
    process.exit(1);
  }
}

runTestSuite();
