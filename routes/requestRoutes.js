const express = require('express');
const router = express.Router();
const BookRequest = require('../models/BookRequest');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to check user ID if token present
const getOptionalUserId = async (req) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
      return decoded.id;
    }
  } catch (err) {}
  return null;
};

// @route   POST /api/requests
// @desc    Customer submits a request for a new eBook or topic
router.post('/', async (req, res) => {
  try {
    const { bookTitle, category, notes, userName, userEmail } = req.body;

    if (!bookTitle || !bookTitle.trim()) {
      return res.status(400).json({ success: false, message: 'Please specify the eBook topic or title you want.' });
    }

    const userId = await getOptionalUserId(req);
    let resolvedName = userName || 'Anonymous Reader';
    let resolvedEmail = userEmail || 'reader@example.com';

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        resolvedName = user.name;
        resolvedEmail = user.email;
      }
    }

    const request = await BookRequest.create({
      user: userId || undefined,
      userName: resolvedName,
      userEmail: resolvedEmail,
      bookTitle: bookTitle.trim(),
      category: category ? category.trim() : 'General Tech',
      notes: notes ? notes.trim() : '',
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: `Thank you! Your request for "${request.bookTitle}" has been received. Our editorial team will review it.`,
      request,
    });
  } catch (error) {
    console.error('Book request error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit request.' });
  }
});

// @route   GET /api/requests
// @desc    Admin reviews all customer book requests
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const requests = await BookRequest.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (error) {
    console.error('Fetch requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch book requests.' });
  }
});

// @route   PUT /api/requests/:id/status
// @desc    Admin updates status of a request
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const request = await BookRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    request.status = status || request.status;
    await request.save();

    res.status(200).json({
      success: true,
      message: `Request status updated to "${request.status}".`,
      request,
    });
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

module.exports = router;
