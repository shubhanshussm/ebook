const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
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
    chapterIndex: {
      type: Number,
      default: 0,
    },
    chapterTitle: {
      type: String,
      default: 'General Note',
    },
    content: {
      type: String,
      required: [true, 'Note content cannot be empty'],
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
