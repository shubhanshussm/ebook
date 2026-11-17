const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Book description is required'],
    },
    category: {
      type: String,
      required: [true, 'Book category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
    },
    coverImage: {
      type: String,
      default: '/images/default-cover.png',
    },
    pdfFileName: {
      type: String,
      required: [true, 'PDF file name is required'],
    },
    pages: {
      type: Number,
      default: 150,
    },
    rating: {
      type: Number,
      default: 5.0,
    },
    numReviews: {
      type: Number,
      default: 0,
    },
    previewSample: {
      type: String,
      default: '',
    },
    chapters: [
      {
        title: { type: String, default: '' },
        subtitle: { type: String, default: '' },
        content: { type: String, default: '' },
        keyTakeaways: [{ type: String }],
      },
    ],
    language: {
      type: String,
      default: 'English',
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Book', bookSchema);
