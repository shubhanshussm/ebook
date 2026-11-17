const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    currentChapter: {
      type: Number,
      default: 0,
    },
    totalChapters: {
      type: Number,
      default: 1,
    },
    percentComplete: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Ensure one record per user per book
readingProgressSchema.index({ user: 1, book: 1 }, { unique: true });

module.exports = mongoose.model('ReadingProgress', readingProgressSchema);
