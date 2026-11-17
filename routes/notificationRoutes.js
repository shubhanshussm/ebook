const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/notifications
// @desc    Get user notifications and unread count
router.get('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    const notifications = (user.notifications || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// @route   PUT /api/notifications/mark-read
// @desc    Mark all user notifications as read
router.put('/mark-read', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.notifications) {
      user.notifications.forEach((n) => {
        n.isRead = true;
      });
      await user.save();
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
});

// @route   DELETE /api/notifications
// @desc    Clear notifications
router.delete('/', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.notifications = [];
    await user.save();

    res.status(200).json({ success: true, message: 'Notifications cleared.' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ success: false, message: 'Failed to clear notifications.' });
  }
});

module.exports = router;
