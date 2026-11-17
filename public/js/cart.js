// Multi-Item Shopping Cart Logic & Unified Razorpay Checkout

const CART_STORAGE_KEY = 'bookvault_cart';

function getCartItems() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCartItems(items) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  updateCartBadge();
}

function updateCartBadge() {
  const items = getCartItems();
  const badge = document.getElementById('nav-cart-count');
  if (badge) {
    badge.textContent = items.length;
    badge.style.display = items.length > 0 ? 'inline-flex' : 'none';
  }
}

// Add an eBook to cart
function addToCart(bookId) {
  const book = (window.booksCache || []).find((b) => b._id === bookId);
  if (!book) {
    showToast('Book details not found.', 'error');
    return;
  }

  if (book.isPurchased) {
    showToast('You already own this eBook in your library.', 'info');
    return;
  }

  const items = getCartItems();
  if (items.some((i) => i.id === bookId)) {
    showToast(`"${book.title}" is already in your cart.`, 'info');
    openCartDrawer();
    return;
  }

  items.push({
    id: book._id,
    title: book.title,
    author: book.author,
    price: book.price,
    coverImage: book.coverImage,
    category: book.category,
  });

  saveCartItems(items);
  showToast(`Added "${book.title}" to cart! 🛒`, 'success');
  openCartDrawer();
}

// Remove item from cart
function removeFromCart(bookId) {
  let items = getCartItems();
  items = items.filter((i) => i.id !== bookId);
  saveCartItems(items);
  renderCartDrawer();
}

// Clear cart
function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  updateCartBadge();
  renderCartDrawer();
}

// Open Cart Drawer
function openCartDrawer() {
  let modal = document.getElementById('cart-drawer-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cart-drawer-modal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.classList.add('open');
  renderCartDrawer();
}

function closeCartDrawer() {
  const modal = document.getElementById('cart-drawer-modal');
  if (modal) modal.classList.remove('open');
}

// Render Cart Drawer Content
function renderCartDrawer() {
  const modal = document.getElementById('cart-drawer-modal');
  if (!modal) return;

  const items = getCartItems();
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  modal.innerHTML = `
    <div class="modal-content" style="max-width: 520px;">
      <div class="modal-header" style="background: linear-gradient(135deg, #1e1b4b, #312e81); color: white;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 1.3rem;">🛒</span>
          <h3 class="modal-title" style="color: white; font-size: 1.15rem;">Shopping Cart (${items.length})</h3>
        </div>
        <button class="modal-close" style="color: white;" onclick="closeCartDrawer()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;">
        ${
          items.length === 0
            ? `
          <div style="text-align: center; padding: 2.5rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.4;">🛒</div>
            <h4 style="font-size: 1.1rem; margin-bottom: 0.3rem;">Your cart is empty</h4>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">Browse our collection and add eBooks to read.</p>
            <button class="btn btn-primary btn-sm" onclick="closeCartDrawer()">Continue Browsing</button>
          </div>
        `
            : `
          <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
            ${items
              .map(
                (item) => `
              <div style="display: flex; gap: 0.75rem; align-items: center; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem;">
                <img src="${item.coverImage}" alt="${item.title}" style="width: 48px; height: 65px; object-fit: cover; border-radius: 4px;" />
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 0.75rem; color: var(--secondary); font-weight: 700; text-transform: uppercase;">${item.category}</div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">By ${item.author}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 800; color: var(--text-main);">₹${item.price}</div>
                  <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer; text-decoration: underline; margin-top: 0.2rem;">
                    Remove
                  </button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <!-- Promo Code Box -->
          <div class="promo-box" style="margin-bottom: 1.25rem;">
            <label style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Have a Coupon?</label>
            <div class="promo-input-row">
              <input type="text" id="cart-coupon-input" class="form-input" placeholder="e.g. WELCOME20" style="text-transform: uppercase; font-weight: 600;" />
              <button class="btn btn-secondary btn-sm" id="btn-cart-apply-coupon" onclick="applyCartCoupon(${subtotal})">
                Apply
              </button>
            </div>
            <div id="cart-coupon-status" style="margin-top: 0.35rem; font-size: 0.82rem;"></div>
          </div>

          <!-- Total Calculation -->
          <div style="background: var(--bg-surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; margin-bottom: 0.35rem;">
              <span>Subtotal:</span>
              <span style="font-weight: 600;">₹${subtotal}</span>
            </div>
            <div id="cart-discount-row" style="display: none; justify-content: space-between; font-size: 0.95rem; color: #059669; margin-bottom: 0.35rem;">
              <span>Promo Savings:</span>
              <span id="cart-discount-val" style="font-weight: 700;">-₹0</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800; border-top: 1px solid var(--border); padding-top: 0.5rem; margin-top: 0.5rem;">
              <span>Total Payable:</span>
              <span id="cart-final-val" style="color: var(--primary);">₹${subtotal}</span>
            </div>
          </div>

          <button class="btn btn-primary btn-block" id="btn-cart-checkout" onclick="checkoutEntireCart()" style="margin-top: 1.5rem; padding: 0.85rem; font-size: 1.05rem;">
            💳 Checkout Cart via Razorpay (₹${subtotal})
          </button>
        `
        }
      </div>
    </div>
  `;
}

let activeCartCoupon = null;

// Validate Coupon in Cart
async function applyCartCoupon(subtotal) {
  const token = getAuthToken();
  const input = document.getElementById('cart-coupon-input');
  const code = input ? input.value.trim().toUpperCase() : '';
  const statusElem = document.getElementById('cart-coupon-status');
  const btn = document.getElementById('btn-cart-apply-coupon');

  if (!code) {
    if (statusElem) statusElem.innerHTML = '<span style="color: #ef4444;">Please enter coupon code.</span>';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Checking...';

  // Check coupon validity against first item
  const items = getCartItems();
  try {
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, bookId: items[0].id }),
    });

    const data = await res.json();

    if (data.success) {
      activeCartCoupon = data.coupon.code;
      let discount = data.discountAmount;
      if (data.coupon.discountType === 'percentage') {
        discount = Math.round((subtotal * data.coupon.discountValue) / 100);
      }
      const finalAmt = Math.max(1, subtotal - discount);

      if (statusElem) statusElem.innerHTML = `<span style="color: #059669; font-weight: 600;">✓ Coupon ${data.coupon.code} applied! Saved ₹${discount}</span>`;
      document.getElementById('cart-discount-row').style.display = 'flex';
      document.getElementById('cart-discount-val').textContent = `-₹${discount}`;
      document.getElementById('cart-final-val').textContent = `₹${finalAmt}`;
      document.getElementById('btn-cart-checkout').textContent = `💳 Checkout Cart via Razorpay (₹${finalAmt})`;
      showToast(`Coupon applied! Saved ₹${discount}`, 'success');
    } else {
      activeCartCoupon = null;
      if (statusElem) statusElem.innerHTML = `<span style="color: #ef4444;">${data.message}</span>`;
      document.getElementById('cart-discount-row').style.display = 'none';
      document.getElementById('cart-final-val').textContent = `₹${subtotal}`;
      document.getElementById('btn-cart-checkout').textContent = `💳 Checkout Cart via Razorpay (₹${subtotal})`;
    }
  } catch (err) {
    console.error('Coupon error:', err);
    if (statusElem) statusElem.innerHTML = '<span style="color: #ef4444;">Failed to apply coupon.</span>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Apply';
  }
}

// Checkout All Items in Cart via Razorpay
async function checkoutEntireCart() {
  const token = getAuthToken();
  if (!token) {
    showToast('Please login to complete your purchase.', 'warning');
    setTimeout(() => {
      window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 900);
    return;
  }

  const items = getCartItems();
  if (items.length === 0) return;

  const btn = document.getElementById('btn-cart-checkout');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Initializing Checkout...';
  }

  try {
    const res = await fetch('/api/payment/create-cart-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bookIds: items.map((i) => i.id),
        couponCode: activeCartCoupon,
      }),
    });

    const data = await res.json();
    closeCartDrawer();

    if (!data.success) {
      showToast(data.message || 'Failed to start payment.', 'error');
      return;
    }

    if (data.mode === 'simulator') {
      openCartSimulatorModal(data);
    } else {
      openCartRazorpayCheckout(data);
    }
  } catch (err) {
    console.error('Cart checkout error:', err);
    showToast('Checkout failed.', 'error');
  }
}

// Cart Razorpay Pop-up
function openCartRazorpayCheckout(orderData) {
  if (typeof Razorpay === 'undefined') {
    showToast('Razorpay failed to load.', 'error');
    return;
  }

  const options = {
    key: orderData.keyId,
    amount: orderData.amount,
    currency: orderData.currency || 'INR',
    name: 'BookVault eBook Store',
    description: `Bundle Purchase (${orderData.bookCount} eBooks)`,
    order_id: orderData.orderId,
    prefill: {
      name: orderData.user.name,
      email: orderData.user.email,
    },
    theme: { color: '#4f46e5' },
    handler: async function (response) {
      showToast('Payment received! Verifying...', 'info');
      await verifyCartPaymentSignature({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
  };

  try {
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (e) {
    openCartSimulatorModal(orderData);
  }
}

// Cart Simulator Modal
function openCartSimulatorModal(orderData) {
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
        <h3 class="modal-title" style="color: white; font-size: 1.15rem;">💳 Razorpay Cart Checkout</h3>
        <button class="modal-close" style="color: white;" onclick="closeSimulatorModal()">&times;</button>
      </div>
      <div class="modal-body" style="padding: 1.75rem;">
        <div style="background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.85rem; color: #4338ca; font-weight: 700;">Cart Order Summary</div>
          <div style="font-size: 1.1rem; font-weight: bold; margin: 0.3rem 0;">${orderData.bookCount} eBooks Selected</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a;">Total: ₹${orderData.totalPayable}</div>
        </div>
        <button class="btn btn-primary btn-block" id="btn-confirm-cart-sim-payment" style="padding: 0.85rem; font-size: 1rem;">
          ✓ Confirm & Pay ₹${orderData.totalPayable}
        </button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  document.getElementById('btn-confirm-cart-sim-payment').onclick = async function () {
    closeSimulatorModal();
    await verifyCartPaymentSignature({
      razorpay_order_id: orderData.orderId,
      razorpay_payment_id: `pay_sim_${Date.now()}`,
      razorpay_signature: `sim_sig_${Date.now()}`,
    });
  };
}

async function verifyCartPaymentSignature(paymentDetails) {
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
      clearCart();
      showToast('Payment successful! All eBooks unlocked in your library.', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } else {
      showToast(data.message || 'Payment verification failed.', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Failed to verify payment.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', updateCartBadge);

window.getCartItems = getCartItems;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.openCartDrawer = openCartDrawer;
window.closeCartDrawer = closeCartDrawer;
window.applyCartCoupon = applyCartCoupon;
window.checkoutEntireCart = checkoutEntireCart;
