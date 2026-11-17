const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const Gift = require('../models/Gift');

// Default category covers for 1-click fallback
const CATEGORY_DEFAULT_COVERS = {
  Programming: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
  'Artificial Intelligence': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80',
  'Cloud & Architecture': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
  'Career & Self-Help': 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?auto=format&fit=crop&w=600&q=80',
  'Design & Frontend': 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
  'Business & Finance': 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80',
  'Fiction & Novels': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
};

// Helper: Auto-generate an authentic multi-page PDF with PDFKit
const generateEbookPdf = (bookData, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Cover Page
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
      doc.fillColor('#38bdf8').fontSize(14).text(`[ ${(bookData.category || 'TECHNICAL').toUpperCase()} EDITION ]`, 60, 150, { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#f8fafc').fontSize(26).text(bookData.title, { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#94a3b8').fontSize(16).text(`By ${bookData.author}`, { align: 'center' });
      doc.moveDown(3);
      doc.fillColor('#22c55e').fontSize(12).text('AUTHENTIC LICENSED E-BOOK COPY', { align: 'center' });
      doc.moveDown(1);
      doc.fillColor('#64748b').fontSize(10).text('Purchased from Official eBook Store.', { align: 'center' });

      const chapters = bookData.chapters && bookData.chapters.length > 0 ? bookData.chapters : [
        {
          title: 'Foundational Principles & Core Concepts',
          content: bookData.description,
          keyTakeaways: ['Foundations and domain modeling precede optimization', 'Maintain clean, decoupled architecture', 'Follow industry best practices for durability'],
        },
        {
          title: 'Deep Dive & Practical Implementation',
          content: `Comprehensive hands-on breakdown for "${bookData.title}". Practical blueprints, engineering considerations, and implementation details.`,
          keyTakeaways: ['Step-by-step methodology', 'Production-tested workflows', 'Error handling strategies'],
        },
        {
          title: 'Scalability & Performance Optimization',
          content: `Optimizing resource utilization, throughput, latency, and lifecycle stability.`,
          keyTakeaways: ['Benchmarking guidelines', 'Bottleneck analysis', 'Resilient fallbacks'],
        },
        {
          title: 'Production Readiness & Advanced Mastery',
          content: `Deploying with confidence, monitoring key metrics, and ensuring continuous operational excellence.`,
          keyTakeaways: ['Zero-downtime deployment', 'Security checklist', 'Long-term maintenance'],
        },
      ];

      chapters.forEach((ch, idx) => {
        doc.addPage();
        doc.fillColor('#0f172a').fontSize(20).text(`Chapter ${idx + 1}: ${ch.title}`);
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
        doc.moveDown(1.5);
        doc.fillColor('#334155').fontSize(12).text(ch.content, { lineGap: 6 });
        doc.moveDown(2);
        if (ch.keyTakeaways && ch.keyTakeaways.length > 0) {
          doc.fillColor('#0369a1').fontSize(13).text('Key Takeaways:');
          doc.moveDown(0.5);
          ch.keyTakeaways.forEach((pt) => {
            doc.fillColor('#475569').fontSize(11).text(`•  ${pt}`);
          });
        }
        doc.fontSize(10).fillColor('#94a3b8').text(`Page ${idx + 2} | ${bookData.title}`, 50, 780, { align: 'center' });
      });

      doc.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
};

// Ensure upload directories exist
const storageBooksDir = path.join(__dirname, '..', 'storage', 'books');
const publicCoversDir = path.join(__dirname, '..', 'public', 'uploads', 'covers');

if (!fs.existsSync(storageBooksDir)) {
  fs.mkdirSync(storageBooksDir, { recursive: true });
}
if (!fs.existsSync(publicCoversDir)) {
  fs.mkdirSync(publicCoversDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'pdfFile') {
      cb(null, storageBooksDir);
    } else if (file.fieldname === 'coverImage') {
      cb(null, publicCoversDir);
    } else {
      cb(new Error('Invalid field for file upload'), false);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    cb(null, `${cleanBase}_${uniqueSuffix}${ext}`);
  },
});

// Multer file filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'pdfFile') {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf files are permitted for eBook file upload!'), false);
    }
  } else if (file.fieldname === 'coverImage') {
    if (file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, webp) are permitted for Book Cover!'), false);
    }
  } else {
    cb(null, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

// Middleware for parsing multipart uploads
const bookUploadMiddleware = upload.fields([
  { name: 'pdfFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

// Apply protection & admin guard to all routes in this router
router.use(protect, adminOnly);

// @route   GET /api/admin/stats
// @desc    Dashboard overview statistics
router.get('/stats', async (req, res) => {
  try {
    const totalBooks = await Book.countDocuments();
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    const totalOrders = await Order.countDocuments({ status: 'paid' });
    const totalGifts = await Gift.countDocuments();

    const revenueResult = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalBooks,
        totalUsers,
        totalOrders,
        totalGifts,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin stats.' });
  }
});

// @route   GET /api/admin/gifts
// @desc    Get all gift vouchers and redemption status across the platform
router.get('/gifts', async (req, res) => {
  try {
    const gifts = await Gift.find()
      .populate('book', 'title coverImage price')
      .populate('sender', 'name email')
      .populate('redeemedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: gifts.length, gifts });
  } catch (error) {
    console.error('Admin gifts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch gift logs.' });
  }
});

// @route   POST /api/admin/books
// @desc    Upload and create a new eBook
router.post('/books', (req, res) => {
  bookUploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      const {
        title,
        author,
        description,
        category,
        price,
        originalPrice,
        coverImageUrl,
        pages,
        language,
        featured,
        previewSample,
        chapters,
      } = req.body;

      if (!title || !author || !description || !price) {
        return res.status(400).json({
          success: false,
          message: 'Please provide title, author, description, and price.',
        });
      }

      const cleanTitle = title.trim();
      const cleanAuthor = author.trim();
      const cleanDesc = description.trim();
      const cleanCat = (category && category.trim()) || 'Programming';
      const numPages = pages ? parseInt(pages) : 160;

      // Parse or generate structured chapters
      let chaptersData = [];
      if (chapters) {
        try {
          chaptersData = typeof chapters === 'string' ? JSON.parse(chapters) : chapters;
        } catch (e) {
          console.warn('Failed to parse custom chapters JSON, generating defaults.');
        }
      }

      if (!Array.isArray(chaptersData) || chaptersData.length === 0) {
        chaptersData = [
          {
            title: 'Foundational Principles & Core Concepts',
            subtitle: 'Core Mechanics & Paradigm Shift',
            content: `Welcome to "${cleanTitle}". In this foundational chapter, we deconstruct the core mental models and domain rules.\n\n${cleanDesc}`,
            keyTakeaways: [
              'Foundations and domain modeling must precede premature optimization.',
              'Maintain clean, decoupled architecture with clear boundaries.',
              'Follow industry best practices for durability and security.',
            ],
          },
          {
            title: 'Deep Dive into Core Implementation',
            subtitle: 'Patterns, Techniques & Code Architecture',
            content: `With foundations established, this chapter examines real-world implementation mechanics for "${cleanTitle}". You will learn how to design robust workflows, eliminate failure points, and maintain velocity.`,
            keyTakeaways: [
              'Eliminate hidden couplings and single points of failure.',
              'Implement structured logging and comprehensive error boundaries.',
              'Write clean, testable, and declarative components.',
            ],
          },
          {
            title: 'Optimization & Performance Engineering',
            subtitle: 'Scalability, Latency & Reliability',
            content: `Engineering excellence is achieved through continuous measurement and systematic optimization. This chapter walks through performance profiling, caching strategies, and throughput tuning.`,
            keyTakeaways: [
              'Measure before and after every optimization.',
              'Use predictive caching and data partitioning.',
              'Ensure resilience under unexpected peak load.',
            ],
          },
          {
            title: 'Production Mastery & Continuous Delivery',
            subtitle: 'Automation, Maintenance & Scaling',
            content: `In the concluding chapter of "${cleanTitle}", we explore continuous delivery, monitoring, automation, and long-term project sustainability.`,
            keyTakeaways: [
              'Automate repetitive workflows and verification checks.',
              'Monitor key health metrics in real time.',
              'Build with future extensibility and security by design.',
            ],
          },
        ];
      }

      // Handle PDF: Uploaded file OR Auto-generate high-quality branded PDF
      let pdfFileName = '';
      if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
        pdfFileName = req.files.pdfFile[0].filename;
      } else {
        const cleanBase = cleanTitle
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 30);
        pdfFileName = `generated_${cleanBase}_${Date.now()}.pdf`;
        const generatedPath = path.join(storageBooksDir, pdfFileName);
        await generateEbookPdf(
          {
            title: cleanTitle,
            author: cleanAuthor,
            category: cleanCat,
            description: cleanDesc,
            chapters: chaptersData,
          },
          generatedPath
        );
      }

      // Determine cover image
      let coverImage = CATEGORY_DEFAULT_COVERS[cleanCat] || CATEGORY_DEFAULT_COVERS['Programming'];
      if (req.files && req.files.coverImage && req.files.coverImage[0]) {
        coverImage = `/uploads/covers/${req.files.coverImage[0].filename}`;
      } else if (coverImageUrl && coverImageUrl.trim()) {
        coverImage = coverImageUrl.trim();
      }

      // Determine preview sample
      const sampleText = (previewSample && previewSample.trim()) || `### Chapter 1: Foundations & Core Concepts
Welcome to **${cleanTitle}** by *${cleanAuthor}*.

> "${cleanDesc}"

#### What You Will Learn in This eBook:
1. **Core Fundamentals**: Understanding foundational concepts, patterns, and principles.
2. **Practical Blueprints**: Real-world recipes, code examples, and structured workflows.
3. **Advanced Optimization**: Scaling techniques, resiliency patterns, and production checklists.

---
*Notice: This is a complimentary free sample preview. To access the complete ${numPages}-page DRM-free eBook with full chapters, please purchase this eBook.*`;

      const newBook = await Book.create({
        title: cleanTitle,
        author: cleanAuthor,
        description: cleanDesc,
        category: cleanCat,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price) * 1.5,
        coverImage,
        pdfFileName,
        pages: numPages,
        language: language || 'English',
        featured: featured === 'true' || featured === true,
        previewSample: sampleText,
        chapters: chaptersData,
      });

      res.status(201).json({
        success: true,
        message: `eBook "${newBook.title}" successfully added to the store!`,
        book: newBook,
      });
    } catch (error) {
      console.error('Create book error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add eBook.',
      });
    }
  });
});

// @route   PUT /api/admin/books/:id
// @desc    Update an existing eBook details
router.put('/books/:id', (req, res) => {
  bookUploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        return res.status(404).json({ success: false, message: 'eBook not found.' });
      }

      const {
        title,
        author,
        description,
        category,
        price,
        originalPrice,
        coverImageUrl,
        pages,
        language,
        featured,
        previewSample,
      } = req.body;

      if (title) book.title = title.trim();
      if (author) book.author = author.trim();
      if (description) book.description = description.trim();
      if (category) book.category = category.trim();
      if (price) book.price = parseFloat(price);
      if (originalPrice !== undefined) book.originalPrice = parseFloat(originalPrice);
      if (pages) book.pages = parseInt(pages);
      if (language) book.language = language;
      if (featured !== undefined) book.featured = featured === 'true' || featured === true;
      if (previewSample) book.previewSample = previewSample.trim();

      // Update cover image if new one provided
      if (req.files && req.files.coverImage && req.files.coverImage[0]) {
        book.coverImage = `/uploads/covers/${req.files.coverImage[0].filename}`;
      } else if (coverImageUrl && coverImageUrl.trim()) {
        book.coverImage = coverImageUrl.trim();
      }

      // Update PDF file if new one uploaded
      if (req.files && req.files.pdfFile && req.files.pdfFile[0]) {
        const oldPdfPath = path.join(storageBooksDir, book.pdfFileName);
        if (fs.existsSync(oldPdfPath)) {
          try {
            fs.unlinkSync(oldPdfPath);
          } catch (e) {
            console.warn('Could not delete old PDF:', e.message);
          }
        }
        book.pdfFileName = req.files.pdfFile[0].filename;
      }

      await book.save();

      res.status(200).json({
        success: true,
        message: 'eBook details updated successfully!',
        book,
      });
    } catch (error) {
      console.error('Update book error:', error);
      res.status(500).json({ success: false, message: 'Failed to update eBook.' });
    }
  });
});

// @route   DELETE /api/admin/books/:id
// @desc    Delete eBook & remove PDF from storage
router.delete('/books/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'eBook not found.' });
    }

    // Try deleting PDF file from disk
    const filePath = path.join(storageBooksDir, book.pdfFileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('Could not delete PDF file:', e.message);
      }
    }

    await Book.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `eBook "${book.title}" was permanently deleted.`,
    });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete eBook.' });
  }
});

// @route   GET /api/admin/orders
// @desc    Get all orders with full user and payment details
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .populate('book', 'title price coverImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error('Fetch admin orders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
});

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

// @route   GET /api/admin/users
// @desc    Get all users (customers and administrators)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('purchasedBooks', 'title')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

// @route   POST /api/admin/users
// @desc    Create a new user or administrator
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'user',
    });

    res.status(201).json({
      success: true,
      message: `Account created successfully for ${newUser.name} with ${newUser.role} privileges.`,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create user.' });
  }
});

// @route   PUT /api/admin/users/:id/role
// @desc    Give or revoke admin access to a user
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const targetUserId = req.params.id;

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role ("admin" or "user") is required.',
      });
    }

    // Prevent current admin from revoking their own admin access
    if (req.user._id.toString() === targetUserId && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Safety Guard: You cannot revoke your own administrator privileges.',
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Access updated: "${user.name}" is now ${role === 'admin' ? 'an Administrator' : 'a Standard Customer'}.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user access.' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete a user account through admin
router.delete('/users/:id', async (req, res) => {
  try {
    const targetUserId = req.params.id;

    // Safety check: Cannot delete own account
    if (req.user._id.toString() === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Safety Guard: You cannot delete your own currently logged-in account.',
      });
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Delete user
    await User.findByIdAndDelete(targetUserId);

    res.status(200).json({
      success: true,
      message: `User "${user.name}" (${user.email}) has been permanently deleted.`,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

module.exports = router;
