const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Book = require('../models/Book');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/wishlist
// @desc    Get current user's wishlist items
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist');
    res.status(200).json({
      success: true,
      count: (user.wishlist || []).length,
      wishlist: user.wishlist || [],
    });
  } catch (error) {
    console.error('Fetch wishlist error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve wishlist.' });
  }
});

// @route   POST /api/wishlist/toggle/:bookId
// @desc    Add or remove an eBook from wishlist
router.post('/toggle/:bookId', protect, async (req, res) => {
  try {
    const { bookId } = req.params;
    const user = await User.findById(req.user._id);

    const index = user.wishlist.findIndex((id) => id.toString() === bookId.toString());
    let inWishlist = false;

    if (index > -1) {
      user.wishlist.splice(index, 1);
      inWishlist = false;
    } else {
      user.wishlist.push(bookId);
      inWishlist = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      inWishlist,
      message: inWishlist ? 'Added to your wishlist ❤️' : 'Removed from your wishlist',
      wishlistCount: user.wishlist.length,
    });
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    res.status(500).json({ success: false, message: 'Failed to update wishlist.' });
  }
});

module.exports = router;
