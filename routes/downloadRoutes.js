const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');

// @route   GET /api/download/:bookId
// @desc    Download eBook file ONLY if the authenticated user has paid for it
router.get('/:bookId', protect, async (req, res) => {
  try {
    const { bookId } = req.params;

    // 1. Check if the book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'eBook not found.',
      });
    }

    // 2. Strict Access Control Check:
    // Check if the current user has this book in their purchasedBooks list
    // OR if there is a verified 'paid' order in the Order collection
    const user = await User.findById(req.user._id);
    const hasInPurchased = user.purchasedBooks.some(
      (id) => id.toString() === bookId.toString()
    );

    const hasPaidOrder = await Order.exists({
      user: req.user._id,
      book: bookId,
      status: 'paid',
    });

    if (!hasInPurchased && !hasPaidOrder) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You have not purchased this eBook! Please complete payment first.',
      });
    }

    // 3. Resolve the secure file path
    const storageDir = path.join(__dirname, '..', 'storage', 'books');
    const filePath = path.join(storageDir, book.pdfFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'eBook PDF file is temporarily unavailable on the server.',
      });
    }

    // 4. Sanitize file name for download
    const safeTitle = book.title.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '_');
    const downloadFilename = `${safeTitle}.pdf`;

    // 5. Send file with DRM & license headers to initiate download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('X-DRM-Licensed-To', `${user.name} <${user.email}>`);
    res.setHeader('X-DRM-Watermark', `Licensed exclusively to ${user.email}`);

    return res.download(filePath, downloadFilename, (err) => {
      if (err) {
        console.error('File download streaming error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Error streaming the eBook file.',
          });
        }
      }
    });
  } catch (error) {
    console.error('Download route error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing eBook download.',
    });
  }
});

// @route   GET /api/download/reader-content/:bookId
// @desc    Get chapters & content for in-browser online reader (Strictly Protected)
router.get('/reader-content/:bookId', protect, async (req, res) => {
  try {
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ success: false, message: 'eBook not found.' });
    }

    // Access Control: Must be purchased or admin
    const user = await User.findById(req.user._id);
    const hasInPurchased = user.purchasedBooks.some(
      (id) => id.toString() === bookId.toString()
    );
    const hasPaidOrder = await Order.exists({
      user: req.user._id,
      $or: [{ book: bookId }, { books: bookId }],
      status: 'paid',
    });

    if (!hasInPurchased && !hasPaidOrder && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You must purchase this eBook before reading online.',
      });
    }

    // Structured chapters for authentic interactive online reading
    let chapters = [];
    if (book.chapters && Array.isArray(book.chapters) && book.chapters.length > 0) {
      chapters = book.chapters.map((ch, idx) => ({
        title: ch.title || `Chapter ${idx + 1}`,
        subtitle: ch.subtitle || `Section ${idx + 1}`,
        content: ch.content || '',
        keyTakeaways: ch.keyTakeaways || [],
      }));
    } else {
      chapters = [
        {
          title: 'Chapter 1: Architecture & Foundational Principles',
          subtitle: 'Core Mechanics & Paradigm Shift',
          content: `Welcome to "${book.title}". In this foundational chapter, we deconstruct the core mental models and architectural design philosophies behind modern high-leverage software engineering.
          
When designing distributed, resilient systems, clarity precedes efficiency. You will discover how modular encapsulation, stateless operational nodes, and event-driven data flow insulate applications against unpredicted edge-cases. Every production application starts with clean boundaries, precise domain typing, and defensive operational patterns.`,
          keyTakeaways: [
            'Clarity and encapsulation must always precede premature performance optimizations.',
            'Stateless micro-nodes significantly simplify scaling bottlenecks.',
            'Defensive error logging and fallback pipelines are non-negotiable in production.',
          ],
        },
        {
          title: 'Chapter 2: Deep Dive into Core Implementation',
          subtitle: 'Production Patterns & Hands-on Mechanics',
          content: `Having established foundational concepts, we turn our attention directly to real-world code implementation. Software fails not from high complexity, but from hidden coupling.

In this section, we examine state management across asynchronous boundaries, caching layers with predictable invalidation lifecycles, and cryptographic handshake validations like Razorpay HMAC-SHA256 signatures. By breaking down large components into testable units, you build confidence and maintain rapid development velocity.`,
          keyTakeaways: [
            'Eliminate hidden coupling across asynchronous boundaries.',
            'Implement predictable cache invalidation strategies using deterministic TTLs.',
            'Always authenticate incoming webhook/payment callbacks with cryptographic hashing.',
          ],
        },
        {
          title: 'Chapter 3: Scaling, Resiliency & Performance Optimization',
          subtitle: 'Handling Scale & Zero-Downtime Operations',
          content: `True engineering maturity is demonstrated under real production load. Scalability is not merely throwing CPU cores at problems; it is engineering graceful degradation, circuit breakers, and backpressure mitigation.

Throughout this chapter, we analyze query optimization techniques, database indexing strategies, connection pool sizing, and horizontal autoscaling thresholds. Understanding how your service degrades under peak traffic ensures zero-downtime customer experiences.`,
          keyTakeaways: [
            'Design with circuit breakers to prevent cascading downstream outages.',
            'Monitor database query execution plans and index selectivity.',
            'Stress-test autoscaling thresholds before running marketing campaigns.',
          ],
        },
        {
          title: 'Chapter 4: Production Deployment & Beyond',
          subtitle: 'Continuous Delivery & Operational Excellence',
          content: `The final mile of software engineering is consistent, automated delivery. Deploying to production should be an unremarkable, boring routine rather than an adrenaline-fueled late night panic.

We explore automated container builds, health-check probes, canary deployments, and real-time observability telemetry. Software is a living system: continuous measurement and automated regression prevention safeguard your investment.`,
          keyTakeaways: [
            'Automate testing pipelines to catch regressions before git commits hit staging.',
            'Instrument telemetry for latency, error rate, and saturation (the Golden Signals).',
            'Celebrate operational reliability as a first-class feature.',
          ],
        },
      ];
    }

    res.status(200).json({
      success: true,
      book: {
        id: book._id,
        title: book.title,
        author: book.author,
        category: book.category,
        pages: book.pages,
        coverImage: book.coverImage,
        rating: book.rating,
      },
      userLicense: {
        licensedTo: user.name,
        email: user.email,
        licensedAt: new Date().toISOString(),
      },
      chapters,
    });
  } catch (error) {
    console.error('Reader content error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reader content.' });
  }
});

// @route   GET /api/download/check-access/:bookId
// @desc    Check whether logged-in user has download permission for a book
router.get('/check-access/:bookId', protect, async (req, res) => {
  try {
    const { bookId } = req.params;
    const user = await User.findById(req.user._id);

    const hasInPurchased = user.purchasedBooks.some(
      (id) => id.toString() === bookId.toString()
    );

    const hasPaidOrder = await Order.exists({
      user: req.user._id,
      book: bookId,
      status: 'paid',
    });

    const isAuthorized = hasInPurchased || Boolean(hasPaidOrder);

    res.status(200).json({
      success: true,
      bookId,
      canDownload: isAuthorized,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to verify download authorization.',
    });
  }
});

module.exports = router;
