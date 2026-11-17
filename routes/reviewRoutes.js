const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Book = require('../models/Book');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// @route   GET /api/reviews/:bookId
// @desc    Get all reviews for an eBook
router.get('/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const reviews = await Review.find({ book: bookId })
      .populate('user', 'name role')
      .sort({ createdAt: -1 });

    const total = reviews.length;
    const avgRating =
      total > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1)
        : 5.0;

    res.status(200).json({
      success: true,
      count: total,
      averageRating: parseFloat(avgRating),
      reviews,
    });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews.' });
  }
});

// @route   POST /api/reviews/:bookId
// @desc    Submit a review & star rating for an eBook
router.post('/:bookId', protect, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Rating (1-5 stars) and review comment are required.',
      });
    }

    const numRating = parseFloat(rating);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'eBook not found.' });
    }

    // Check if user is a verified buyer
    const user = await User.findById(req.user._id);
    const isVerified = user.purchasedBooks.some(
      (id) => id.toString() === bookId.toString()
    );

    // Check if user already reviewed
    let review = await Review.findOne({ book: bookId, user: req.user._id });

    if (review) {
      // Update existing review
      review.rating = numRating;
      review.comment = comment.trim();
      review.verifiedPurchase = isVerified;
      await review.save();
    } else {
      // Create new review
      review = await Review.create({
        book: bookId,
        user: req.user._id,
        rating: numRating,
        comment: comment.trim(),
        verifiedPurchase: isVerified,
      });
    }

    // Recalculate book average rating & numReviews
    const allReviews = await Review.find({ book: bookId });
    const avg =
      allReviews.reduce((sum, item) => sum + item.rating, 0) / allReviews.length;

    book.rating = parseFloat(avg.toFixed(1));
    book.numReviews = allReviews.length;
    await book.save();

    res.status(201).json({
      success: true,
      message: 'Thank you! Your review has been published.',
      review,
      bookRating: book.rating,
      numReviews: book.numReviews,
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit review.',
    });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete review (Author or Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this review.' });
    }

    const bookId = review.book;
    await Review.findByIdAndDelete(req.params.id);

    // Recalculate
    const allReviews = await Review.find({ book: bookId });
    const book = await Book.findById(bookId);
    if (book) {
      if (allReviews.length > 0) {
        const avg = allReviews.reduce((sum, item) => sum + item.rating, 0) / allReviews.length;
        book.rating = parseFloat(avg.toFixed(1));
        book.numReviews = allReviews.length;
      } else {
        book.rating = 5.0;
        book.numReviews = 0;
      }
      await book.save();
    }

    res.status(200).json({ success: true, message: 'Review removed successfully.' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete review.' });
  }
});

module.exports = router;
