const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/referrals/my-referrals
// @desc    Get user referral dashboard, link, credit balance, and friends referred
router.get('/my-referrals', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Ensure referral code is assigned
    if (!user.referralCode) {
      user.referralCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await user.save();
    }

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const referralLink = `${protocol}://${host}/login.html?tab=register&ref=${user.referralCode}`;

    // Find users who signed up with this user's referral code
    const referredUsers = await User.find({ referredBy: user._id })
      .select('name email createdAt purchasedBooks')
      .sort({ createdAt: -1 });

    const totalReferrals = referredUsers.length;
    const activePurchasers = referredUsers.filter(
      (u) => u.purchasedBooks && u.purchasedBooks.length > 0
    ).length;

    res.status(200).json({
      success: true,
      referralCode: user.referralCode,
      referralLink,
      walletCredits: user.walletCredits || 0,
      totalReferrals,
      activePurchasers,
      referredUsers: referredUsers.map((u) => ({
        name: u.name,
        date: u.createdAt,
        hasPurchased: u.purchasedBooks && u.purchasedBooks.length > 0,
      })),
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch referral data.' });
  }
});

// @route   POST /api/referrals/validate-code
// @desc    Check if a referral code is valid
router.post('/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Referral code required.' });
    }

    const cleanCode = code.toUpperCase().trim();
    const referrer = await User.findOne({ referralCode: cleanCode });

    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    }

    res.status(200).json({
      success: true,
      message: `Valid referral code from ${referrer.name}! You will receive ₹50 welcome discount credits upon registration.`,
      referrerName: referrer.name,
      code: cleanCode,
    });
  } catch (error) {
    console.error('Validate referral error:', error);
    res.status(500).json({ success: false, message: 'Failed to validate referral code.' });
  }
});

module.exports = router;
