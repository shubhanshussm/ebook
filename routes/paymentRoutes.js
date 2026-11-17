const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const PDFDocument = require('pdfkit');
const { protect } = require('../middleware/authMiddleware');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Gift = require('../models/Gift');

// Helper to initialize Razorpay instance
const getRazorpayInstance = () => {
  if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_YOUR_KEY_ID' &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_sampleKey123'
  ) {
    return new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return null;
};

// @route   GET /api/payment/config
// @desc    Get Razorpay Public Key and mode
router.get('/config', (req, res) => {
  const hasRealKey =
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_YOUR_KEY_ID' &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_sampleKey123';

  res.status(200).json({
    success: true,
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_sampleKey123',
    isSimulationAllowed: process.env.ENABLE_PAYMENT_SIMULATION === 'true',
    isRealKeyConfigured: Boolean(hasRealKey),
  });
});

// @route   POST /api/payment/create-order
// @desc    Create Razorpay Order for an eBook (with optional coupon discount or gift mode)
router.post('/create-order', protect, async (req, res) => {
  try {
    const { bookId, couponCode, isGift, recipientName, recipientEmail, giftMessage } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: 'Book ID is required.',
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'eBook not found.',
      });
    }

    // Check if user already owns this book (only if not gifting)
    const user = await User.findById(req.user._id);
    if (!isGift && user.purchasedBooks.includes(book._id)) {
      return res.status(400).json({
        success: false,
        alreadyPurchased: true,
        message: 'You have already purchased this eBook! Check your library.',
        downloadUrl: `/api/download/${book._id}`,
      });
    }

    let payablePrice = book.price;
    let couponDetails = null;

    // Apply coupon if provided
    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.toUpperCase().trim();
      const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });

      if (coupon) {
        let discount = 0;
        if (coupon.discountType === 'percentage') {
          discount = Math.round((book.price * coupon.discountValue) / 100);
          if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else {
          discount = coupon.discountValue;
        }

        if (discount >= book.price) {
          discount = book.price - 1; // Minimum ₹1 for gateway processing
        }

        payablePrice = Math.max(1, book.price - discount);
        couponDetails = {
          code: coupon.code,
          discountAmount: discount,
        };
      }
    }

    const receipt = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const amountInPaise = Math.round(payablePrice * 100);

    const razorpay = getRazorpayInstance();

    if (razorpay) {
      // Create real Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt,
        notes: {
          bookId: book._id.toString(),
          userId: user._id.toString(),
          bookTitle: book.title,
          couponCode: couponDetails ? couponDetails.code : '',
        },
      });

      // Save order in database
      const order = await Order.create({
        user: user._id,
        book: book._id,
        razorpayOrderId: razorpayOrder.id,
        amount: payablePrice,
        currency: 'INR',
        status: 'created',
        paymentMode: 'razorpay',
        receipt: receipt,
        couponUsed: couponDetails,
        isGift: Boolean(isGift),
        giftRecipient: isGift
          ? {
              name: recipientName || 'Friend',
              email: recipientEmail || '',
              message: giftMessage || 'Enjoy this eBook!',
            }
          : undefined,
      });

      return res.status(200).json({
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        book: {
          id: book._id,
          title: book.title,
          originalPrice: book.price,
          price: payablePrice,
          couponDiscount: couponDetails ? couponDetails.discountAmount : 0,
        },
        user: {
          name: user.name,
          email: user.email,
        },
        keyId: process.env.RAZORPAY_KEY_ID,
        mode: 'razorpay',
      });
    } else {
      // If real keys are not configured and simulation is enabled
      if (process.env.ENABLE_PAYMENT_SIMULATION === 'true') {
        const simulatedOrderId = `order_sim_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        const order = await Order.create({
          user: user._id,
          book: book._id,
          razorpayOrderId: simulatedOrderId,
          amount: payablePrice,
          currency: 'INR',
          status: 'created',
          paymentMode: 'simulator',
          receipt: receipt,
          couponUsed: couponDetails,
          isGift: Boolean(isGift),
          giftRecipient: isGift
            ? {
                name: recipientName || 'Friend',
                email: recipientEmail || '',
                message: giftMessage || 'Enjoy this eBook!',
              }
            : undefined,
        });

        return res.status(200).json({
          success: true,
          orderId: simulatedOrderId,
          amount: amountInPaise,
          currency: 'INR',
          book: {
            id: book._id,
            title: book.title,
            originalPrice: book.price,
            price: payablePrice,
            couponDiscount: couponDetails ? couponDetails.discountAmount : 0,
          },
          user: {
            name: user.name,
            email: user.email,
          },
          keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_sampleKey123',
          mode: 'simulator',
          notice: 'Running in Test/Simulator mode because valid Razorpay API keys are not provided in .env',
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Razorpay keys not configured. Please add valid keys in .env.',
        });
      }
    }
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate payment order.',
    });
  }
});

// @route   POST /api/payment/create-cart-order
// @desc    Create Razorpay Order for multiple books in shopping cart
router.post('/create-cart-order', protect, async (req, res) => {
  try {
    const { bookIds, couponCode } = req.body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid list of book IDs.' });
    }

    const user = await User.findById(req.user._id);
    const books = await Book.find({ _id: { $in: bookIds } });

    if (books.length === 0) {
      return res.status(404).json({ success: false, message: 'None of the selected eBooks were found.' });
    }

    // Filter out already purchased books
    const unpurchasedBooks = books.filter(
      (b) => !user.purchasedBooks.some((id) => id.toString() === b._id.toString())
    );

    if (unpurchasedBooks.length === 0) {
      return res.status(400).json({
        success: false,
        allPurchased: true,
        message: 'You already own all the eBooks in your cart! Check your library.',
      });
    }

    const subtotal = unpurchasedBooks.reduce((sum, b) => sum + b.price, 0);
    let payablePrice = subtotal;
    let couponDetails = null;

    if (couponCode && couponCode.trim()) {
      const cleanCode = couponCode.toUpperCase().trim();
      const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });

      if (coupon && subtotal >= coupon.minPurchase) {
        let discount = 0;
        if (coupon.discountType === 'percentage') {
          discount = Math.round((subtotal * coupon.discountValue) / 100);
          if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        } else {
          discount = coupon.discountValue;
        }

        if (discount >= subtotal) {
          discount = subtotal - 1;
        }

        payablePrice = Math.max(1, subtotal - discount);
        couponDetails = {
          code: coupon.code,
          discountAmount: discount,
        };
      }
    }

    const receipt = `cart_rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const amountInPaise = Math.round(payablePrice * 100);
    const razorpay = getRazorpayInstance();

    if (razorpay) {
      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: {
          bookCount: unpurchasedBooks.length.toString(),
          userId: user._id.toString(),
          couponCode: couponDetails ? couponDetails.code : '',
        },
      });

      await Order.create({
        user: user._id,
        books: unpurchasedBooks.map((b) => b._id),
        book: unpurchasedBooks[0]._id, // First book fallback
        razorpayOrderId: razorpayOrder.id,
        amount: payablePrice,
        currency: 'INR',
        status: 'created',
        paymentMode: 'razorpay',
        receipt,
        couponUsed: couponDetails,
      });

      return res.status(200).json({
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        bookCount: unpurchasedBooks.length,
        books: unpurchasedBooks.map((b) => ({ id: b._id, title: b.title, price: b.price })),
        subtotal,
        discount: couponDetails ? couponDetails.discountAmount : 0,
        totalPayable: payablePrice,
        user: { name: user.name, email: user.email },
        keyId: process.env.RAZORPAY_KEY_ID,
        mode: 'razorpay',
      });
    } else {
      if (process.env.ENABLE_PAYMENT_SIMULATION === 'true') {
        const simulatedOrderId = `order_sim_cart_${Date.now()}`;

        await Order.create({
          user: user._id,
          books: unpurchasedBooks.map((b) => b._id),
          book: unpurchasedBooks[0]._id,
          razorpayOrderId: simulatedOrderId,
          amount: payablePrice,
          currency: 'INR',
          status: 'created',
          paymentMode: 'simulator',
          receipt,
          couponUsed: couponDetails,
        });

        return res.status(200).json({
          success: true,
          orderId: simulatedOrderId,
          amount: amountInPaise,
          currency: 'INR',
          bookCount: unpurchasedBooks.length,
          books: unpurchasedBooks.map((b) => ({ id: b._id, title: b.title, price: b.price })),
          subtotal,
          discount: couponDetails ? couponDetails.discountAmount : 0,
          totalPayable: payablePrice,
          user: { name: user.name, email: user.email },
          keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_sampleKey123',
          mode: 'simulator',
        });
      } else {
        return res.status(500).json({ success: false, message: 'Payment gateway unconfigured.' });
      }
    }
  } catch (error) {
    console.error('Cart order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create cart order.' });
  }
});

// @route   POST /api/payment/verify
// @desc    Verify Razorpay payment signature & grant access to download
router.post('/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookId } = req.body;

    if (!razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required for verification.',
      });
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order record not found.',
      });
    }

    // Verify based on payment mode
    if (order.paymentMode === 'razorpay') {
      const isSimulatedTest =
        process.env.ENABLE_PAYMENT_SIMULATION === 'true' &&
        razorpay_payment_id &&
        razorpay_payment_id.startsWith('pay_sim_');

      if (!isSimulatedTest) {
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(body.toString())
          .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (!isAuthentic) {
          order.status = 'failed';
          await order.save();
          return res.status(400).json({
            success: false,
            message: 'Payment verification failed: Invalid signature!',
          });
        }
      }
    }

    // Payment is valid! Update order
    order.status = 'paid';
    order.razorpayPaymentId = razorpay_payment_id || `pay_sim_${Date.now()}`;
    order.razorpaySignature = razorpay_signature || 'simulated_signature';
    await order.save();

    const user = await User.findById(req.user._id);

    // If order was a gift purchase, generate a unique redeemable Gift Code
    if (order.isGift) {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const giftCode = `GIFT-${part1}-${part2}`;

      const giftBookId = order.book || (order.books && order.books[0]) || bookId;
      const targetBook = await Book.findById(giftBookId);

      const gift = await Gift.create({
        code: giftCode,
        book: giftBookId,
        sender: user._id,
        senderName: user.name,
        recipientName: order.giftRecipient && order.giftRecipient.name ? order.giftRecipient.name : 'A Special Friend',
        recipientEmail: order.giftRecipient && order.giftRecipient.email ? order.giftRecipient.email : '',
        message: order.giftRecipient && order.giftRecipient.message ? order.giftRecipient.message : 'Enjoy this eBook gift!',
        orderRef: order.razorpayOrderId,
      });

      order.giftCode = giftCode;
      await order.save();

      return res.status(200).json({
        success: true,
        isGift: true,
        giftCode: giftCode,
        recipientName: gift.recipientName,
        recipientEmail: gift.recipientEmail,
        personalMessage: gift.message,
        bookTitle: targetBook ? targetBook.title : 'eBook',
        message: `Gift payment successful! Share the gift code ${giftCode} with ${gift.recipientName}.`,
        paymentId: order.razorpayPaymentId,
      });
    }

    // Standard personal purchase: Add books to user's purchasedBooks array
    const booksToGrant = [];

    if (order.books && order.books.length > 0) {
      booksToGrant.push(...order.books.map((id) => id.toString()));
    }
    if (order.book) {
      booksToGrant.push(order.book.toString());
    }
    if (bookId) {
      booksToGrant.push(bookId.toString());
    }

    let newlyUnlocked = 0;
    for (const bId of booksToGrant) {
      if (!user.purchasedBooks.some((id) => id.toString() === bId)) {
        user.purchasedBooks.push(bId);
        newlyUnlocked++;
      }
    }

    // Add order notification to user
    if (!user.notifications) user.notifications = [];
    user.notifications.push({
      title: 'Payment Confirmed! 🎉',
      message: `Unlocked ${booksToGrant.length} eBook(s) in your library. Order ID: ${order.razorpayOrderId}`,
      type: 'order',
    });

    // Reward referrer if user was referred by someone
    if (user.referredBy) {
      try {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
          referrer.walletCredits = (referrer.walletCredits || 0) + 100;
          if (!referrer.notifications) referrer.notifications = [];
          referrer.notifications.push({
            title: 'Referral Reward Earned! 💰',
            message: `Your friend ${user.name} completed a purchase! You earned ₹100 wallet credits.`,
            type: 'reward',
          });
          await referrer.save();
        }
      } catch (refErr) {
        console.warn('Referral reward processing error:', refErr);
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Payment successful! Unlocked ${booksToGrant.length} eBook(s) in your library.`,
      bookId: bookId || (order.book ? order.book.toString() : ''),
      paymentId: order.razorpayPaymentId,
      downloadUrl: bookId ? `/api/download/${bookId}` : '/dashboard.html',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed.',
    });
  }
});

// @route   GET /api/payment/my-orders
// @desc    Get user's purchased orders
router.get('/my-orders', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id, status: 'paid' })
      .populate('book')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase history.',
    });
  }
});

// @route   GET /api/payment/invoice/:orderId
// @desc    Generate and download official PDF tax invoice / purchase receipt
router.get('/invoice/:orderId', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('book');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Access check: only buyer or admin can download invoice
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Build PDF invoice with PDFKit
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Invoice-${order._id.toString().slice(-6).toUpperCase()}.pdf"`
    );

    doc.pipe(res);

    // Header & Company Branding
    doc.rect(0, 0, doc.page.width, 100).fill('#0f172a');
    doc.fillColor('#38bdf8').fontSize(22).text('BOOKVAULT DIGITAL STORE', 50, 35);
    doc.fillColor('#94a3b8').fontSize(10).text('Official Purchase Receipt & Tax Invoice', 50, 65);

    doc.fillColor('#ffffff').fontSize(12).text('TAX INVOICE', 450, 35, { align: 'right' });
    doc.fillColor('#38bdf8').fontSize(10).text(`INV-${order._id.toString().slice(-8).toUpperCase()}`, 450, 52, { align: 'right' });
    doc.fillColor('#94a3b8').fontSize(9).text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 450, 68, { align: 'right' });

    doc.moveDown(4);

    // Bill To & Order Info Box
    const topY = 130;
    doc.fillColor('#1e293b').fontSize(11).text('BILLED TO (CUSTOMER):', 50, topY, { underline: true });
    doc.moveDown(0.3);
    doc.fillColor('#0f172a').fontSize(11).text(order.user.name);
    doc.fillColor('#64748b').fontSize(10).text(order.user.email);
    doc.moveDown(0.2);
    doc.fillColor('#059669').fontSize(10).text('Status: PAID & VERIFIED ✓');

    doc.fillColor('#1e293b').fontSize(11).text('PAYMENT DETAILS:', 350, topY, { underline: true });
    doc.moveDown(0.3);
    doc.fillColor('#475569').fontSize(10).text(`Gateway: Razorpay (India)`);
    doc.fillColor('#475569').fontSize(9).text(`Payment ID: ${order.razorpayPaymentId || order.razorpayOrderId}`);
    doc.fillColor('#475569').fontSize(9).text(`Order Ref: ${order.razorpayOrderId}`);

    // Table Header
    const tableTop = 220;
    doc.rect(50, tableTop, 500, 25).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(10).text('ITEM DESCRIPTION', 60, tableTop + 7);
    doc.text('FORMAT', 320, tableTop + 7);
    doc.text('QTY', 420, tableTop + 7);
    doc.text('AMOUNT (INR)', 470, tableTop + 7, { align: 'right' });

    // Table Row
    const rowY = tableTop + 35;
    const bookTitle = order.book ? order.book.title : 'eBook Title';
    doc.fillColor('#0f172a').fontSize(10).text(bookTitle, 60, rowY, { width: 250 });
    doc.fillColor('#64748b').fontSize(9).text('Digital PDF (DRM-Free)', 320, rowY);
    doc.text('1', 425, rowY);
    doc.fillColor('#0f172a').fontSize(10).text(`₹${order.amount}`, 470, rowY, { align: 'right' });

    // Divider
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, rowY + 30).lineTo(550, rowY + 30).stroke();

    // Summary calculation
    const summaryY = rowY + 45;
    doc.fillColor('#475569').fontSize(10).text('Subtotal:', 350, summaryY);
    doc.fillColor('#0f172a').text(`₹${order.amount}`, 470, summaryY, { align: 'right' });

    doc.fillColor('#475569').fontSize(10).text('Taxes (GST 0% Digital Goods):', 350, summaryY + 18);
    doc.fillColor('#0f172a').text('₹0.00', 470, summaryY + 18, { align: 'right' });

    doc.rect(345, summaryY + 35, 205, 28).fill('#eef2ff');
    doc.fillColor('#1e1b4b').fontSize(11).text('TOTAL PAID:', 355, summaryY + 43);
    doc.fillColor('#4338ca').fontSize(13).text(`₹${order.amount}`, 470, summaryY + 41, { align: 'right' });

    // Footer notice & Seal
    doc.rect(50, 680, 500, 70).fill('#f8fafc');
    doc.strokeColor('#e2e8f0').lineWidth(1).rect(50, 680, 500, 70).stroke();
    doc.fillColor('#0f172a').fontSize(10).text('AUTHENTIC PURCHASE CONFIRMATION', 65, 692);
    doc.fillColor('#64748b').fontSize(8.5).text(
      'This invoice confirms genuine ownership of the digital eBook. The customer has permanent download rights from their personal library.',
      65,
      708,
      { width: 470 }
    );

    doc.end();
  } catch (error) {
    console.error('Invoice generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate invoice.' });
  }
});

module.exports = router;
