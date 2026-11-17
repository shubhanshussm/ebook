const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ebook_store';

// Ensure required directories exist
const storageBooksDir = path.join(__dirname, 'storage', 'books');
if (!fs.existsSync(storageBooksDir)) {
  fs.mkdirSync(storageBooksDir, { recursive: true });
}

// Built-in & third-party middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/books', require('./routes/bookRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/download', require('./routes/downloadRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/gifts', require('./routes/giftRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'eBook Store API with Razorpay & Auth',
  });
});

// Fallback for SPA/HTML navigation
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/library', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/reader', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reader.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Connect to MongoDB & Initialize Auto-seed if empty
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log(`Connected successfully to MongoDB database: ${mongoose.connection.name}`);

    // Check if books are seeded
    const Book = require('./models/Book');
    const count = await Book.countDocuments();
    if (count === 0) {
      console.log('No eBooks found in database. Automatically running initial seeder...');
      try {
        const { seedDatabase } = require('./seeds/seedBooks');
        // Run seed without process.exit
        const { sampleBooks } = require('./seeds/seedBooks');
        const PDFDocument = require('pdfkit');

        for (const b of sampleBooks) {
          const filePath = path.join(storageBooksDir, b.pdfFileName);
          if (!fs.existsSync(filePath)) {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const writeStream = fs.createWriteStream(filePath);
            doc.pipe(writeStream);

            // Cover Page
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
            doc.fillColor('#38bdf8').fontSize(14).text(`[ ${b.category.toUpperCase()} EDITION ]`, 60, 150, { align: 'center' });
            doc.moveDown(1);
            doc.fillColor('#f8fafc').fontSize(28).text(b.title, { align: 'center' });
            doc.moveDown(1);
            doc.fillColor('#94a3b8').fontSize(16).text(`By ${b.author}`, { align: 'center' });
            doc.moveDown(3);
            doc.fillColor('#22c55e').fontSize(12).text('AUTHENTIC LICENSED E-BOOK COPY', { align: 'center' });
            doc.moveDown(1);
            doc.fillColor('#64748b').fontSize(10).text('Purchased from Official eBook Store.', { align: 'center' });

            // Chapters
            b.chapters.forEach((ch, idx) => {
              doc.addPage();
              doc.fillColor('#0f172a').fontSize(20).text(`Chapter ${idx + 1}: ${ch.title}`);
              doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y + 10).lineTo(550, doc.y + 10).stroke();
              doc.moveDown(1.5);
              doc.fillColor('#334155').fontSize(12).text(ch.content, { lineGap: 6 });
              doc.moveDown(2);
              doc.fillColor('#0369a1').fontSize(13).text('Key Takeaways:');
              doc.moveDown(0.5);
              ch.points.forEach((point) => {
                doc.fillColor('#475569').fontSize(11).text(`•  ${point}`);
              });
              doc.fontSize(10).fillColor('#94a3b8').text(`Page ${idx + 2} | ${b.title}`, 50, 780, { align: 'center' });
            });

            doc.end();
          }

          await Book.create({
            title: b.title,
            author: b.author,
            description: b.description,
            category: b.category,
            price: b.price,
            originalPrice: b.originalPrice,
            coverImage: b.coverImage,
            pdfFileName: b.pdfFileName,
            pages: b.pages,
            rating: b.rating,
            language: b.language,
            featured: b.featured,
          });
        }
        console.log('Initial sample eBooks seeded successfully!');
      } catch (seedErr) {
        console.error('Error during auto-seeding:', seedErr);
      }
    }

    // Sync master administrator from .env
    const User = require('./models/User');
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@bookvault.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    let masterAdmin = await User.findOne({ email: adminEmail });
    if (!masterAdmin) {
      await User.create({
        name: 'Master Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      console.log(`[Admin Setup] Created master admin from .env: ${adminEmail}`);
    } else {
      masterAdmin.role = 'admin';
      masterAdmin.password = adminPassword; // Triggers pre-save hash hook
      await masterAdmin.save();
      console.log(`[Admin Setup] Synced master admin credentials from .env: ${adminEmail}`);
    }

    // Seed default starter coupons if none exist
    const Coupon = require('./models/Coupon');
    const couponCount = await Coupon.countDocuments();
    if (couponCount === 0) {
      await Coupon.create([
        {
          code: 'WELCOME20',
          discountType: 'percentage',
          discountValue: 20,
          maxDiscount: 150,
          minPurchase: 199,
          isActive: true,
          usageLimit: 500,
        },
        {
          code: 'FLAT50',
          discountType: 'fixed',
          discountValue: 50,
          minPurchase: 299,
          isActive: true,
          usageLimit: 500,
        },
      ]);
      console.log('[Coupons] Seeded default promo codes: WELCOME20 (20% off), FLAT50 (₹50 off)');
    }

    app.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`eBook Store Server running at: http://localhost:${PORT}`);
      console.log(`Admin Panel: http://localhost:${PORT}/admin`);
      console.log(`Razorpay Gateway: Ready`);
      console.log(`MongoDB: Connected`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
