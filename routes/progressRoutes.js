const express = require('express');
const router = express.Router();
const ReadingProgress = require('../models/ReadingProgress');
const User = require('../models/User');
const Book = require('../models/Book');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/progress/save
// @desc    Update reader position and completion percentage
router.post('/save', protect, async (req, res) => {
  try {
    const { bookId, currentChapter, totalChapters } = req.body;

    if (!bookId) {
      return res.status(400).json({ success: false, message: 'Book ID is required' });
    }

    const cur = parseInt(currentChapter) || 0;
    const tot = Math.max(1, parseInt(totalChapters) || 1);
    const percent = Math.min(100, Math.round(((cur + 1) / tot) * 100));
    const isCompleted = cur + 1 >= tot;

    const progress = await ReadingProgress.findOneAndUpdate(
      { user: req.user._id, book: bookId },
      {
        currentChapter: cur,
        totalChapters: tot,
        percentComplete: percent,
        isCompleted,
        lastReadAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, progress });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to update reading progress' });
  }
});

// @route   GET /api/progress/:bookId
// @desc    Get progress for a specific book
router.get('/:bookId', protect, async (req, res) => {
  try {
    const progress = await ReadingProgress.findOne({
      user: req.user._id,
      book: req.params.bookId,
    });

    res.status(200).json({
      success: true,
      progress: progress || { currentChapter: 0, totalChapters: 1, percentComplete: 0, isCompleted: false },
    });
  } catch (error) {
    console.error('Fetch book progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch progress' });
  }
});

// @route   GET /api/progress/stats/my-stats
// @desc    Get reading dashboard stats and streaks for current user
router.get('/stats/my-stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const totalOwned = user.purchasedBooks ? user.purchasedBooks.length : 0;

    const progressRecords = await ReadingProgress.find({ user: req.user._id }).populate(
      'book',
      'title coverImage author pages'
    );

    const completedCount = progressRecords.filter((p) => p.isCompleted).length;
    const inProgressCount = progressRecords.filter((p) => !p.isCompleted && p.percentComplete > 0).length;

    // Calculate reading streak based on lastReadAt days
    let streakDays = 0;
    if (progressRecords.length > 0) {
      const dates = progressRecords
        .map((p) => new Date(p.lastReadAt).toDateString())
        .filter((v, i, a) => a.indexOf(v) === i);
      streakDays = Math.max(1, dates.length);
    }

    res.status(200).json({
      success: true,
      stats: {
        totalOwned,
        completedCount,
        inProgressCount,
        streakDays,
      },
      progressRecords,
    });
  } catch (error) {
    console.error('Fetch reading stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reading stats' });
  }
});

module.exports = router;
