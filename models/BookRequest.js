const mongoose = require('mongoose');

const bookRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    bookTitle: {
      type: String,
      required: [true, 'Book topic or title is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'General Tech',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Pending', 'Under Review', 'Planned', 'Published'],
      default: 'Pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BookRequest', bookRequestSchema);
