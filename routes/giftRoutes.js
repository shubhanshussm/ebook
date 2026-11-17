const express = require('express');
const router = express.Router();
const Gift = require('../models/Gift');
const Book = require('../models/Book');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/gifts/redeem
// @desc    Redeem a Gift Code to claim an eBook for free
router.post('/redeem', protect, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a gift code.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const gift = await Gift.findOne({ code: cleanCode }).populate('book');

    if (!gift) {
      return res.status(404).json({ success: false, message: 'Invalid gift code. Please double-check and try again.' });
    }

    if (gift.isRedeemed) {
      return res.status(400).json({ success: false, message: 'This gift code has already been redeemed.' });
    }

    // Add book to the user's library
    const user = await User.findById(req.user._id);
    if (!user.purchasedBooks.some((id) => id.toString() === gift.book._id.toString())) {
      user.purchasedBooks.push(gift.book._id);
      await user.save();
    }

    gift.isRedeemed = true;
    gift.redeemedBy = req.user._id;
    await gift.save();

    res.status(200).json({
      success: true,
      message: `Congratulations! "${gift.book.title}" was gifted by ${gift.senderName} and has been unlocked in your library!`,
      book: gift.book,
      senderName: gift.senderName,
      personalMessage: gift.message,
    });
  } catch (error) {
    console.error('Redeem gift error:', error);
    res.status(500).json({ success: false, message: 'Failed to redeem gift code.' });
  }
});

// @route   GET /api/gifts/my-sent-gifts
// @desc    Get all gifts purchased and sent by current user
router.get('/my-sent-gifts', protect, async (req, res) => {
  try {
    const gifts = await Gift.find({ sender: req.user._id })
      .populate('book', 'title coverImage price')
      .populate('redeemedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: gifts.length, gifts });
  } catch (error) {
    console.error('Fetch sent gifts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch gifts.' });
  }
});

module.exports = router;
