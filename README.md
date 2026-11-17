<<<<<<< HEAD
# 📚 BookVault - World-Class Digital eBook Publishing Platform

A full-stack, production-grade eBook publishing and selling platform built using **HTML5, Modern CSS3, Vanilla JavaScript, Node.js, Express.js, and MongoDB**, powered by **Razorpay Payment Gateway** with **strict post-purchase download and reading protection**.

---

## 🚀 Key Features

### 1. 🛍️ Multi-Item Shopping Cart & Instant Buy
- **Unified Multi-Book Checkout**: Users can add multiple eBooks to their cart (`🛒`) and buy them all in a single Razorpay payment transaction.
- **Cart Slide-over Drawer**: View items, calculate live subtotal, apply promo coupons, and complete checkout.
- **"Buy Now" Fast-Track**: Single-click checkout directly for individual books.

### 2. 📖 Distraction-Free In-Browser eBook Reader
- **Read Online Without Downloading**: In addition to downloading the PDF, customers can read their unlocked eBooks directly in their browser at `/reader.html?bookId=...`.
- **Chapter Navigation Sidebar**: Interactive Table of Contents.
- **Reading Themes**:
  - 📄 **White / Light**
  - 📜 **Sepia (Warm Book Paper)**
  - 🌙 **Dark (Night Reader)**
- **Typography Controls**: `A-` and `A+` font size scaling.
- **Personal Chapter Notes & Bookmarks**: Save private chapter insights and bookmarks that persist across devices in MongoDB (`/api/notes`).
- **Strict Guard**: Access is strictly blocked for unpurchased books (`403 Forbidden`).

### 3. 🔒 Strict Access Control & Dynamic DRM Anti-Piracy Watermarking
- **No Direct PDF URL Access**: Private PDF files are securely quarantined in `storage/books/` outside the web root.
- **Ownership Verification**: Backend verifies that `req.user.purchasedBooks` contains that specific `bookId` and a confirmed `paid` order exists.
- **Personalized Anti-Piracy DRM Stamp**:
  - Downloaded PDFs include dynamic buyer licensing tags:
    `"Licensed exclusively to: [Buyer Name] ([Buyer Email]) • Order Ref: [Payment ID]"`.

### 4. 🏷️ Promo Coupons & Discount System
- **Checkout Promo Field**: Users can enter promo codes (e.g. `WELCOME20`, `FLAT50`) to receive instant percentage or flat INR discounts.
- **Admin Coupon Management**: In the Admin Dashboard under **"🏷️ Promo Coupons"**, admins can create percentage or fixed-amount discount coupons, set minimum purchase requirements, and view usage counts.
- **Default Starter Codes**:
  - `WELCOME20`: 20% discount (up to ₹150 off)
  - `FLAT50`: ₹50 flat discount

### 5. 🧾 Downloadable Official PDF Tax Invoices
- Dynamically generated with **PDFKit**: Features official BookVault branding, invoice number, Razorpay transaction ID, customer billing info, and GST confirmation seal.
- Direct **"🧾 Receipt"** download buttons in customer library and admin sales log.

### 6. ⭐ Customer Star Ratings & Verified Buyer Reviews
- Readers can submit 1 to 5 star ratings and written reviews.
- **Verified Buyer Badge**: Automatically awards a **`✓ Verified Buyer`** badge to customers who purchased the book.
- Real-time rating recalculation updates star ratings across the storefront.

### 7. 📖 Free Sample / Chapter Preview Reader
- Buyers can click **"📖 Preview"** on any eBook to read a sample excerpt, table of contents, and introductory chapter directly in an in-browser reading modal before paying.

### 8. ❤️ Personal Wishlist
- One-click heart icon (`🤍`/`❤️`) on any eBook card to save books for later.
- Storefront filter tab: **"Wishlist ❤️"**.

### 9. 🛡️ Admin Dashboard & Multi-Admin Access
- **Admin Dashboard**: Accessible at **`/admin`** (protected by `adminOnly` middleware).
- **Credentials in `.env`**:
  ```env
  ADMIN_EMAIL=admin@bookvault.com
  ADMIN_PASSWORD=admin123
  ```
  Auto-synced into MongoDB on every server startup.
- **Upload Real eBooks**: Form to upload genuine `.pdf` files and cover images via `multer`.
- **Manage Catalog**: Real-time table to edit pricing, descriptions, or delete eBooks.
- **User Management**: Admins can promote any user to Admin, revoke admin access, or delete user accounts.
- **CSV Sales Export**: Export all customer transactions into an Excel/CSV spreadsheet.

### 10. 🌙 Dark Mode / Light Mode Theme Toggle
- Moon/Sun switch in the navigation bar with persistent preference saved in `localStorage`.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Modern CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript (ES6+).
- **Backend**: Node.js & Express.js.
- **Database**: MongoDB & Mongoose.
- **Payment Gateway**: Razorpay (Orders API & HMAC-SHA256 signature verification).
- **Document Engine**: PDFKit (for generating authentic eBooks & Tax Invoices).
- **File Uploads**: Multer.

---

## 📁 Project Structure

```text
├── models/
│   ├── User.js              # User schema with roles, wishlist & password hashing
│   ├── Book.js              # eBook schema (title, price, cover, pages, rating)
│   ├── Order.js             # Order schema supporting single or multi-book cart
│   ├── Coupon.js            # Promo codes & discount rules
│   ├── Review.js            # Customer star ratings & verified reviews
│   └── Note.js              # In-reader personal notes & bookmarks
├── routes/
│   ├── authRoutes.js        # Auth, profile editing, password changing
│   ├── bookRoutes.js        # Catalog search, filter, free sample preview
│   ├── paymentRoutes.js     # Single & cart orders, Razorpay verify, PDF invoices
│   ├── downloadRoutes.js    # Protected download with DRM, reader content
│   ├── adminRoutes.js       # Admin stats, book CRUD, user CRUD, order logs
│   ├── couponRoutes.js      # Promo coupon validation & CRUD
│   ├── reviewRoutes.js      # Book reviews & ratings
│   └── noteRoutes.js        # Personal reading notes & bookmarks
├── public/
│   ├── css/
│   │   └── style.css        # Responsive styling, reader & dark theme
│   ├── js/
│   │   ├── auth.js          # Client auth, dark mode toggle
│   │   ├── payment.js       # Razorpay checkout, promo validation
│   │   ├── cart.js          # Shopping cart drawer & multi-item checkout
│   │   ├── main.js          # Catalog, search, filters, reviews, preview
│   │   ├── library.js       # Customer library & account settings
│   │   ├── reader.js        # In-browser reader, themes, notes
│   │   └── admin.js         # Admin panel, coupons, users, CSV export
│   ├── index.html           # Storefront homepage
│   ├── login.html           # Login & Registration page
│   ├── dashboard.html       # My Library, Receipts & Account Settings
│   ├── reader.html          # In-Browser Online eBook Reader
│   └── admin.html           # Administrator Console
├── storage/books/           # SECURE private directory for eBook PDFs
├── .env                     # Configuration file (Razorpay Keys, MongoDB URI)
└── server.js                # Main Express server
```

---

## 🧪 Testing & Verification

Four comprehensive automated test suites are included:
```bash
node test-flow.js                   # Tests core Razorpay checkout & guarded PDF download
node test-admin-user-management.js  # Tests admin roles, user deletion & delegation
node test-all-pro-features.js       # Tests reviews, preview reader, coupons & invoices
node test-super-features.js         # Tests cart checkout, online reader & DRM
```
=======
# ebook
>>>>>>> 54b8c5e5d8d1a62aa7406a69c200e33ed7adaf28
