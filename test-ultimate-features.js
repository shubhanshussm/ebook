require('dotenv').config();
const crypto = require('crypto');
const BASE_URL = 'http://localhost:5000';

async function testUltimateFeatures() {
  console.log('🚀 Starting Ultimate Platform Features Verification Test Suite...\n');

  try {
    // -------------------------------------------------------------
    // Test 1: User A (Referrer) Registration & Referral Code Check
    // -------------------------------------------------------------
    console.log('--- Test 1: Referrer Registration & Dashboard ---');
    const userAEmail = `referrer_${Date.now()}@example.com`;
    const regARes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Arjun Mehta',
        email: userAEmail,
        password: 'password123',
      }),
    });
    const authA = await regARes.json();
    if (!authA.success) throw new Error(`User A registration failed: ${authA.message}`);
    const tokenA = authA.token;

    // Fetch User A referral dashboard
    const refDashboardRes = await fetch(`${BASE_URL}/api/referrals/my-referrals`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const refDataA = await refDashboardRes.json();
    if (!refDataA.success || !refDataA.referralCode) {
      throw new Error(`Referral dashboard failed: ${JSON.stringify(refDataA)}`);
    }
    console.log(`✓ User A registered: ${userAEmail}`);
    console.log(`✓ Generated Referral Code: ${refDataA.referralCode}`);
    console.log(`✓ Referral Link: ${refDataA.referralLink}`);

    // -------------------------------------------------------------
    // Test 2: User B Registers using User A's Referral Code
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Referred User B Signup & Welcome Bonus ---');
    const userBEmail = `friend_referred_${Date.now()}@example.com`;
    const regBRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priya Sharma',
        email: userBEmail,
        password: 'password123',
        referralCode: refDataA.referralCode,
      }),
    });
    const authB = await regBRes.json();
    if (!authB.success) throw new Error(`User B registration failed: ${authB.message}`);
    const tokenB = authB.token;
    console.log(`✓ User B registered with referral code: ${refDataA.referralCode}`);

    // Verify User B received ₹50 welcome bonus credits
    const refDashboardB = await fetch(`${BASE_URL}/api/referrals/my-referrals`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const refDataB = await refDashboardB.json();
    if (refDataB.walletCredits !== 50) {
      throw new Error(`Expected ₹50 welcome credits for User B, received: ₹${refDataB.walletCredits}`);
    }
    console.log(`✓ User B received ₹50 welcome bonus credits in wallet!`);

    // -------------------------------------------------------------
    // Test 3: User B Purchases eBook & User A Receives ₹100 Reward
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Purchase Triggers ₹100 Referral Reward for Referrer ---');
    const booksRes = await fetch(`${BASE_URL}/api/books`);
    const booksData = await booksRes.json();
    const bookToBuy = booksData.books[0];

    const orderRes = await fetch(`${BASE_URL}/api/payment/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ bookId: bookToBuy._id }),
    });
    const orderData = await orderRes.json();

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const fakePayId = `pay_sim_ref_${Date.now()}`;
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${orderData.orderId}|${fakePayId}`)
      .digest('hex');

    const verifyRes = await fetch(`${BASE_URL}/api/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: fakePayId,
        razorpay_signature: sig,
        bookId: bookToBuy._id,
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) throw new Error(`Payment verification failed: ${JSON.stringify(verifyData)}`);
    console.log(`✓ User B purchase verified: Unlocked "${bookToBuy.title}"`);

    // Verify User A earned ₹100 wallet credits
    const refDashboardA2 = await fetch(`${BASE_URL}/api/referrals/my-referrals`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const refDataA2 = await refDashboardA2.json();
    if (refDataA2.walletCredits < 100) {
      throw new Error(`User A should have received at least ₹100 referral credits! Received: ₹${refDataA2.walletCredits}`);
    }
    console.log(`✓ Referrer User A reward verified: ₹${refDataA2.walletCredits} wallet credits earned! Active purchasers: ${refDataA2.activePurchasers}`);

    // -------------------------------------------------------------
    // Test 4: Notifications Drawer & Mark as Read
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Notifications Engine ---');
    const notifResA = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const notifDataA = await notifResA.json();
    if (!notifDataA.success || notifDataA.notifications.length === 0) {
      throw new Error(`Notifications fetch failed: ${JSON.stringify(notifDataA)}`);
    }
    console.log(`✓ User A received ${notifDataA.notifications.length} notification(s):`);
    notifDataA.notifications.forEach((n) => {
      console.log(`  - [${n.type.toUpperCase()}] ${n.title}: "${n.message}" (Read: ${n.isRead})`);
    });

    // Mark notifications as read
    const markReadRes = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const markReadData = await markReadRes.json();
    if (!markReadData.success) throw new Error(`Mark read failed: ${JSON.stringify(markReadData)}`);

    const notifCheck = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const notifCheckData = await notifCheck.json();
    if (notifCheckData.unreadCount !== 0) {
      throw new Error(`Expected 0 unread notifications, received: ${notifCheckData.unreadCount}`);
    }
    console.log('✓ All notifications successfully marked as read (0 unread).');

    // -------------------------------------------------------------
    // Test 5: Customer eBook Request & Admin Workflow
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Customer eBook Request & Admin Review ---');
    const reqRes = await fetch(`${BASE_URL}/api/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        bookTitle: 'Rust for High-Performance Networking',
        category: 'Systems Programming',
        notes: 'Please cover Tokio async runtime and memory models.',
      }),
    });
    const reqData = await reqRes.json();
    if (!reqData.success || !reqData.request) {
      throw new Error(`eBook request submission failed: ${JSON.stringify(reqData)}`);
    }
    const requestId = reqData.request._id;
    console.log(`✓ Customer request submitted: "${reqData.request.bookTitle}" (ID: ${requestId})`);

    // Admin fetches requests
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookvault.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const adminAuth = await adminLoginRes.json();
    const adminToken = adminAuth.token;

    const adminRequestsRes = await fetch(`${BASE_URL}/api/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminReqData = await adminRequestsRes.json();
    if (!adminReqData.success || adminReqData.requests.length === 0) {
      throw new Error(`Admin fetch requests failed: ${JSON.stringify(adminReqData)}`);
    }
    console.log(`✓ Admin fetched ${adminReqData.requests.length} customer book request(s).`);

    // Admin updates status to "Planned"
    const updateStatusRes = await fetch(`${BASE_URL}/api/requests/${requestId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: 'Planned' }),
    });
    const updateStatusData = await updateStatusRes.json();
    if (!updateStatusData.success || updateStatusData.request.status !== 'Planned') {
      throw new Error(`Update status failed: ${JSON.stringify(updateStatusData)}`);
    }
    console.log(`✓ Admin updated request status to: "${updateStatusData.request.status}".`);

    console.log('\n🎉 ALL ULTIMATE PLATFORM FEATURES PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testUltimateFeatures();
