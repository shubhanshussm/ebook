const express = require('express');
const router = express.Router();
const Coupon = require('../models/Coupon');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @route   GET /api/coupons
// @desc    Get all coupons (Admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: coupons.length, coupons });
  } catch (error) {
    console.error('Fetch coupons error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons.' });
  }
});

// @route   POST /api/coupons
// @desc    Create new coupon (Admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { code, discountType, discountValue, minPurchase, maxDiscount, expiresAt, usageLimit } = req.body;

    if (!code || !discountValue) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and discount value are required.',
      });
    }

    const cleanCode = code.toUpperCase().trim();
    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A coupon with this code already exists.',
      });
    }

    const coupon = await Coupon.create({
      code: cleanCode,
      discountType: discountType || 'percentage',
      discountValue: parseFloat(discountValue),
      minPurchase: minPurchase ? parseFloat(minPurchase) : 0,
      maxDiscount: maxDiscount ? parseFloat(maxDiscount) : 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      usageLimit: usageLimit ? parseInt(usageLimit) : 1000,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `Coupon "${coupon.code}" created successfully!`,
      coupon,
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create coupon.' });
  }
});

// @route   DELETE /api/coupons/:id
// @desc    Delete coupon (Admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }
    res.status(200).json({
      success: true,
      message: `Coupon "${coupon.code}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete coupon.' });
  }
});

// @route   POST /api/coupons/validate
// @desc    Validate a promo code for an eBook checkout
router.post('/validate', protect, async (req, res) => {
  try {
    const { code, bookId } = req.body;

    if (!code || !bookId) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and Book ID are required.',
      });
    }

    const cleanCode = code.toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: cleanCode, isActive: true });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or inactive promo coupon code.',
      });
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This promo coupon has expired.',
      });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'This promo coupon has reached its maximum usage limit.',
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'eBook not found.',
      });
    }

    if (book.price < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `This coupon requires a minimum purchase of ₹${coupon.minPurchase}.`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.round((book.price * coupon.discountValue) / 100);
      if (coupon.maxDiscount > 0 && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed price (at least ₹1 charge or free if full discount)
    if (discountAmount >= book.price) {
      discountAmount = book.price - 1; // Minimum ₹1 for gateway if desired
    }

    const finalAmount = Math.max(1, book.price - discountAmount);

    res.status(200).json({
      success: true,
      message: `Coupon applied! You saved ₹${discountAmount}.`,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      originalPrice: book.price,
      discountAmount,
      finalAmount,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon code.',
    });
  }
});

module.exports = router;
