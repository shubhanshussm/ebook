// Razorpay Payment Integration, Promo Coupons & Download Handler

let activeCoupon = null;

// Opens interactive checkout modal with Promo Code support
async function initiateBookPurchase(bookId) {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to purchase eBooks.', 'warning');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1000);
    return;
  }

  // Fetch book details
  try {
    const res = await fetch(`/api/books/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success || !data.book) {
      showToast('Could not retrieve book details.', 'error');
      return;
    }

    if (data.book.isPurchased) {
      showToast('You already own this eBook! Starting download...', 'success');
      triggerEbookDownload(bookId);
      return;
    }

    activeCoupon = null;
    openCheckoutDialog(data.book);
  } catch (err) {
    console.error('Error initiating checkout:', err);
    showToast('Failed to start checkout process.', 'error');
  }
}

// Interactive Pre-Payment Checkout Dialog
function openCheckoutDialog(book) {
  let modal = document.getElementById('checkout-dialog-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'checkout-dialog-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px;">
      <div class="modal-header" style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.4rem;">🛍️</span>
          <h3 class="modal-title" style="color: white; font-size: 1.15rem;">Checkout & Secure Payment</h3>
        </div>
        <button class="modal-close" style="color: white;" onclick="closeCheckoutDialog()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 1.75rem;">
        <div style="display: flex; gap: 1rem; margin-bottom: 1.25rem; align-items: center;">
          <img src="${book.coverImage}" alt="${book.title}" style="width: 65px; height: 90px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
          <div style="flex: 1;">
            <div style="font-size: 0.8rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">${book.category}</div>
            <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0.2rem 0; line-height: 1.3;">${book.title}</h4>
            <div style="font-size: 0.85rem; color: #64748b;">By ${book.author}</div>
          </div>
        </div>

        <!-- Pricing Breakdown -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.95rem; margin-bottom: 0.4rem;">
            <span>eBook Price:</span>
            <span style="font-weight: 600;">₹${book.price}</span>
          </div>
          <div id="checkout-discount-row" style="display: none; justify-content: space-between; font-size: 0.95rem; color: #059669; margin-bottom: 0.4rem;">
            <span>Promo Discount:</span>
            <span id="checkout-discount-amount" style="font-weight: 700;">-₹0</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.4rem;">
            <span>Total Payable:</span>
            <span id="checkout-final-amount" style="color: var(--primary);">₹${book.price}</span>
          </div>
        </div>

        <!-- Promo Code Input -->
        <div class="promo-box">
          <label style="font-size: 0.82rem; font-weight: 700; color: #475569; text-transform: uppercase;">Have a Promo Code?</label>
          <div class="promo-input-row">
            <input type="text" id="input-coupon-code" class="form-input" placeholder="e.g. WELCOME20, FLAT50" style="text-transform: uppercase; font-weight: 600;" />
            <button class="btn btn-secondary btn-sm" id="btn-apply-coupon" onclick="applyCoupon('${book._id}', ${book.price})">
              Apply
            </button>
          </div>
          <div id="coupon-status-msg" style="margin-top: 0.4rem; font-size: 0.82rem;"></div>
        </div>

        <button class="btn btn-primary btn-block" id="btn-proceed-pay" onclick="executeOrderCreation('${book._id}')" style="margin-top: 1.5rem; padding: 0.85rem; font-size: 1.05rem;">
          🔒 Pay with Razorpay
        </button>

        <div style="text-align: center; margin-top: 0.8rem; font-size: 0.8rem; color: #64748b;">
          🛡️ Secured with 256-bit SSL • Instant DRM-Free PDF Download
        </div>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function closeCheckoutDialog() {
  const modal = document.getElementById('checkout-dialog-modal');
  if (modal) modal.classList.remove('open');
}

// Apply Promo Coupon
async function applyCoupon(bookId, originalPrice) {
  const token = getAuthToken();
  const input = document.getElementById('input-coupon-code');
  const code = input ? input.value.trim() : '';
  const msgElem = document.getElementById('coupon-status-msg');
  const btn = document.getElementById('btn-apply-coupon');

  if (!code) {
    if (msgElem) msgElem.innerHTML = '<span style="color: #ef4444;">Please enter a promo code.</span>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Verifying...';

  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, bookId }),
    });

    const data = await res.json();

    if (data.success) {
      activeCoupon = data.coupon.code;
      if (msgElem) {
        msgElem.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ ${data.message}</span>`;
      }
      document.getElementById('checkout-discount-row').style.display = 'flex';
      document.getElementById('checkout-discount-amount').textContent = `-₹${data.discountAmount}`;
      document.getElementById('checkout-final-amount').textContent = `₹${data.finalAmount}`;
      document.getElementById('btn-proceed-pay').textContent = `🔒 Pay ₹${data.finalAmount} via Razorpay`;
      showToast(`Coupon applied! Saved ₹${data.discountAmount}`, 'success');
    } else {
      activeCoupon = null;
      if (msgElem) msgElem.innerHTML = `<span style="color: #ef4444;">${data.message}</span>`;
      document.getElementById('checkout-discount-row').style.display = 'none';
      document.getElementById('checkout-final-amount').textContent = `₹${originalPrice}`;
      document.getElementById('btn-proceed-pay').textContent = `🔒 Pay with Razorpay`;
    }
  } catch (err) {
    console.error('Coupon validation error:', err);
    if (msgElem) msgElem.innerHTML = '<span style="color: #ef4444;">Error applying coupon.</span>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Apply';
  }
}

// Executes order creation on backend & opens Razorpay popup
async function executeOrderCreation(bookId) {
  const token = getAuthToken();
  const btn = document.getElementById('btn-proceed-pay');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Starting Razorpay...';
  }

  try {
    const response = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ bookId, couponCode: activeCoupon }),
    });

    const data = await response.json();
    closeCheckoutDialog();

    if (!data.success) {
      if (data.alreadyPurchased) {
        showToast('You already own this eBook! Starting download...', 'success');
        triggerEbookDownload(bookId, data.downloadUrl);
        return;
      }
      showToast(data.message || 'Failed to start payment.', 'error');
      return;
    }

    if (data.mode === 'simulator') {
      openSimulatorPaymentModal(data);
    } else {
      openRazorpayCheckout(data);
    }
  } catch (error) {
    console.error('Purchase error:', error);
    showToast('Network error during checkout.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔒 Pay with Razorpay';
    }
  }
}

// Official Razorpay Checkout Pop-up
function openRazorpayCheckout(orderData) {
  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay SDK failed to load. Please check your internet connection.', 'error');
    return;
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency || 'INR',
    name: 'BookVault eBook Store',
    description: `Purchase: ${orderData.book.title}`,
    order_id: orderData.orderId,
    prefill: {
      name: orderData.user.name,
      email: orderData.user.email,
    },
    notes: {
      bookId: orderData.book.id,
    },
    theme: {
      color: '#4f46e5',
    },
    handler: async function (response) {
      showToast('Payment received! Verifying transaction signature...', 'info');
      await verifyPaymentSignature({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        bookId: orderData.book.id,
      });
    },
    modal: {
      ondismiss: function () {
        showToast('Payment window closed.', 'warning');
      },
    },
  };

  try {
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response.error);
      showToast(`Payment failed: ${response.error.description}`, 'error');
    });
    rzp.open();
  } catch (err) {
    console.error('Error opening Razorpay modal:', err);
    openSimulatorPaymentModal(orderData);
  }
}

// Payment Simulator Dialog
function openSimulatorPaymentModal(orderData) {
  let modal = document.getElementById('payment-simulator-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'payment-simulator-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 480px;">
      <div class="modal-header" style="background: #1e1b4b; color: white;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.3rem;">💳</span>
          <h3 class="modal-title" style="color: white; font-size: 1.15rem;">Razorpay Payment Gateway</h3>
        </div>
        <button class="modal-close" style="color: white;" onclick="closeSimulatorModal()">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.75rem;">
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.85rem; color: #4338ca; font-weight: 600; text-transform: uppercase;">Order Summary</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #1e1b4b; margin: 0.3rem 0;">${orderData.book.title}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: #475569; margin-top: 0.5rem;">
            <span>Amount Payable:</span>
            <span style="font-weight: 700; color: #0f172a; font-size: 1.15rem;">₹${orderData.book.price}</span>
          </div>
          ${
            orderData.book.couponDiscount > 0
              ? `<div style="font-size: 0.85rem; color: #059669; font-weight: 600; margin-top: 0.2rem;">✓ Promo discount of ₹${orderData.book.couponDiscount} applied</div>`
              : ''
          }
        </div>

        <div style="font-size: 0.88rem; color: #64748b; line-height: 1.5; margin-bottom: 1.25rem;">
          <p><strong>Razorpay Integration Ready</strong>: You can connect your live or test Razorpay API Key in <code>.env</code>.</p>
          <p style="margin-top: 0.4rem;">In current test environment, you can click below to simulate an instantaneous successful Razorpay payment and unlock your eBook download immediately!</p>
        </div>

        <button class="btn btn-primary btn-block" id="btn-confirm-simulated-payment" style="padding: 0.85rem; font-size: 1rem;">
          ✓ Confirm & Pay ₹${orderData.book.price}
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('btn-confirm-simulated-payment').onclick = async function () {
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = 'Processing Payment...';
    closeSimulatorModal();

    await verifyPaymentSignature({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: `pay_sim_${Date.now()}`,
      razorpay_signature: `sim_sig_${Date.now()}`,
      bookId: orderData.book.id,
    });
  };
}

function closeSimulatorModal() {
  const modal = document.getElementById('payment-simulator-modal');
  if (modal) modal.classList.remove('open');
}

// Verify payment on server & grant download access
async function verifyPaymentSignature(paymentDetails) {
  const token = getAuthToken();

  try {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(paymentDetails),
    });

    const data = await res.json();

    if (data.success) {
      if (data.isGift) {
        showToast(`Gift purchased! Code generated for ${data.recipientName}.`, 'success');
        if (typeof openGiftCelebrationModal === 'function') {
          openGiftCelebrationModal(data);
        }
        return;
      }

      showToast('Payment successful! Access granted.', 'success');
      openSuccessCelebrationModal(data);
      // Trigger download immediately
      triggerEbookDownload(data.bookId, data.downloadUrl);
      if (typeof loadBooks === 'function') {
        loadBooks();
      }
    } else {
      showToast(data.message || 'Payment verification failed.', 'error');
    }
  } catch (err) {
    console.error('Signature verification error:', err);
    showToast('Failed to verify payment on server.', 'error');
  }
}

// Trigger automatic PDF file download
function triggerEbookDownload(bookId, customUrl) {
  const token = getAuthToken();
  const downloadUrl = (customUrl || `/api/download/${bookId}`) + (token ? `?token=${encodeURIComponent(token)}` : '');

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Celebration / Download Prompt Modal with Invoice button
function openSuccessCelebrationModal(paymentData) {
  let modal = document.getElementById('payment-success-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'payment-success-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  const token = getAuthToken();
  const downloadUrl = `/api/download/${paymentData.bookId}?token=${encodeURIComponent(token)}`;

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px; text-align: center;">
      <div class="modal-body" style="padding: 2.5rem 2rem;">
        <div style="width: 70px; height: 70px; background: #ecfdf5; border-radius: 50%; color: #10b981; font-size: 2.2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);">
          ✓
        </div>
        <h3 style="font-size: 1.5rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">
          Payment Successful!
        </h3>
        <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem;">
          Your purchase of <strong>"${paymentData.bookTitle || 'your eBook'}"</strong> is complete. Your PDF download has been initiated automatically!
        </p>

        <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; text-align: left; font-size: 0.85rem; color: #475569;">
          <div><strong>Payment ID:</strong> ${paymentData.paymentId || 'Completed'}</div>
          <div style="margin-top: 0.25rem;"><strong>Access Status:</strong> Verified & Unlocked</div>
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="${downloadUrl}" class="btn btn-success" style="flex: 1; padding: 0.75rem;">
            ⬇ Download eBook
          </a>
          <a href="/dashboard.html" class="btn btn-primary" style="flex: 1; padding: 0.75rem;">
            Go to My Library
          </a>
        </div>
        <button onclick="closeSuccessCelebrationModal()" style="background: none; border: none; color: #94a3b8; font-size: 0.85rem; margin-top: 1rem; cursor: pointer; text-decoration: underline;">
          Close Window
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');
}

function closeSuccessCelebrationModal() {
  const modal = document.getElementById('payment-success-modal');
  if (modal) modal.classList.remove('open');
}

window.initiateBookPurchase = initiateBookPurchase;
window.applyCoupon = applyCoupon;
window.executeOrderCreation = executeOrderCreation;
window.triggerEbookDownload = triggerEbookDownload;
window.closeCheckoutDialog = closeCheckoutDialog;
window.closeSimulatorModal = closeSimulatorModal;
window.closeSuccessCelebrationModal = closeSuccessCelebrationModal;
