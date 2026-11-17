const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/notes/:bookId
// @desc    Get user's personal reading notes for an eBook
router.get('/:bookId', protect, async (req, res) => {
  try {
    const notes = await Note.find({
      user: req.user._id,
      book: req.params.bookId,
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: notes.length, notes });
  } catch (error) {
    console.error('Fetch notes error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notes.' });
  }
});

// @route   POST /api/notes/:bookId
// @desc    Create a new reading note
router.post('/:bookId', protect, async (req, res) => {
  try {
    const { content, chapterIndex, chapterTitle } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note text is required.' });
    }

    const note = await Note.create({
      user: req.user._id,
      book: req.params.bookId,
      content: content.trim(),
      chapterIndex: chapterIndex || 0,
      chapterTitle: chapterTitle || 'General Takeaway',
    });

    res.status(201).json({ success: true, message: 'Note saved!', note });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ success: false, message: 'Failed to save note.' });
  }
});

// @route   DELETE /api/notes/:id
// @desc    Delete a personal note
router.delete('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found or unauthorized.' });
    }

    res.status(200).json({ success: true, message: 'Note deleted.' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete note.' });
  }
});

module.exports = router;
