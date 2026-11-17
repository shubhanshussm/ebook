const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to check user ID from token if present without throwing 401
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
  } catch (err) {
    // Ignore invalid token
  }
  return null;
};

// @route   GET /api/books
// @desc    Get all books with optional search, category filter, and purchase status
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const books = await Book.find(query).sort({ createdAt: -1 });

    // Check if user is logged in to check purchased status
    const userId = await getOptionalUserId(req);
    let purchasedBookIds = [];
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        purchasedBookIds = user.purchasedBooks.map((id) => id.toString());
      }
    }

    const enrichedBooks = books.map((b) => {
      const obj = b.toObject();
      obj.isPurchased = purchasedBookIds.includes(b._id.toString());
      delete obj.pdfFileName; // Keep server file name private
      return obj;
    });

    res.status(200).json({
      success: true,
      count: enrichedBooks.length,
      books: enrichedBooks,
    });
  } catch (error) {
    console.error('Fetch books error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch eBooks.',
    });
  }
});

// @route   GET /api/books/autocomplete
// @desc    Fast search suggestions as user types
router.get('/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const regex = new RegExp(q.trim(), 'i');
    const matches = await Book.find(
      {
        $or: [{ title: regex }, { author: regex }, { category: regex }],
      },
      'title author category price coverImage rating'
    ).limit(6);

    res.status(200).json({ success: true, suggestions: matches });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ success: false, suggestions: [] });
  }
});

// @route   GET /api/books/bundles
// @desc    Get curated multi-book value bundles with package discounts
router.get('/bundles', async (req, res) => {
  try {
    const allBooks = await Book.find().sort({ rating: -1 });
    if (allBooks.length < 2) {
      return res.status(200).json({ success: true, bundles: [] });
    }

    const bundles = [];

    // Bundle 1: Top 2-3 Tech/Programming Books
    const techBooks = allBooks.filter((b) =>
      ['Programming', 'Web Development', 'Technology'].includes(b.category)
    );
    const techSelection = techBooks.length >= 2 ? techBooks.slice(0, 3) : allBooks.slice(0, 2);
    const techOriginal = techSelection.reduce((acc, b) => acc + b.price, 0);
    const techPrice = Math.round(techOriginal * 0.7); // 30% off

    bundles.push({
      id: 'bundle-tech-master',
      title: 'Full-Stack Developer Power Bundle',
      subtitle: 'Everything you need to master modern coding & architectures',
      badge: '30% OFF',
      discountPercent: 30,
      books: techSelection,
      originalPrice: techOriginal,
      bundlePrice: techPrice,
      savings: techOriginal - techPrice,
      bookIds: techSelection.map((b) => b._id),
    });

    // Bundle 2: Career, Finance & Mindset Bundle
    const lifeBooks = allBooks.filter((b) =>
      ['Finance', 'Self-Help', 'Business', 'Productivity'].includes(b.category)
    );
    const lifeSelection = lifeBooks.length >= 2 ? lifeBooks.slice(0, 2) : allBooks.slice(-2);
    const lifeOriginal = lifeSelection.reduce((acc, b) => acc + b.price, 0);
    const lifePrice = Math.round(lifeOriginal * 0.75); // 25% off

    bundles.push({
      id: 'bundle-growth-wealth',
      title: 'Wealth & Career Acceleration Pack',
      subtitle: 'Essential guides on mindset, financial freedom, and leadership',
      badge: '25% OFF',
      discountPercent: 25,
      books: lifeSelection,
      originalPrice: lifeOriginal,
      bundlePrice: lifePrice,
      savings: lifeOriginal - lifePrice,
      bookIds: lifeSelection.map((b) => b._id),
    });

    res.status(200).json({ success: true, bundles });
  } catch (error) {
    console.error('Fetch bundles error:', error);
    res.status(500).json({ success: false, message: 'Failed to load bundles' });
  }
});

// @route   GET /api/books/:id
// @desc    Get single book details
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'eBook not found.',
      });
    }

    const userId = await getOptionalUserId(req);
    let isPurchased = false;
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        isPurchased = user.purchasedBooks.map((id) => id.toString()).includes(book._id.toString());
      }
    }

    const bookObj = book.toObject();
    bookObj.isPurchased = isPurchased;
    delete bookObj.pdfFileName;

    res.status(200).json({
      success: true,
      book: bookObj,
    });
  } catch (error) {
    console.error('Fetch single book error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve eBook details.',
    });
  }
});

// @route   GET /api/books/:id/preview
// @desc    Get free sample chapter and preview extract for an eBook
router.get('/:id/preview', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'eBook not found.' });
    }

    const defaultSample = `
### Chapter 1: Introduction & Foundations
Welcome to **${book.title}** by *${book.author}*.

> "${book.description}"

#### Key Highlights & What You Will Learn:
1. **Core Architectural Principles**: Deconstructing the fundamental mechanics and industry best practices.
2. **Hands-on Implementation**: Real-world blueprints, code snippets, and deployment strategies.
3. **Advanced Optimization**: Scaling beyond baseline limits, diagnosing common bottlenecks, and building resilience.

---
*Notice: This is a complimentary free sample preview. To access the complete ${book.pages}-page DRM-free PDF guide with full chapters, code appendices, and permanent library updates, please purchase the eBook.*
    `;

    res.status(200).json({
      success: true,
      title: book.title,
      author: book.author,
      category: book.category,
      coverImage: book.coverImage,
      pages: book.pages,
      price: book.price,
      preview: book.previewSample || defaultSample.trim(),
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate preview.' });
  }
});

module.exports = router;
