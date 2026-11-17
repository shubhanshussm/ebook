const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Book = require('../models/Book');

// Ensure directory exists
const booksDir = path.join(__dirname, '..', 'storage', 'books');
if (!fs.existsSync(booksDir)) {
  fs.mkdirSync(booksDir, { recursive: true });
}

// Helper to generate a realistic sample PDF eBook
const generateSamplePDF = (fileName, title, author, category, chapterTopics) => {
  const filePath = path.join(booksDir, fileName);
  if (fs.existsSync(filePath)) {
    return; // Already generated
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  // Cover Page
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a');
  doc.fillColor('#38bdf8').fontSize(14).text(`[ ${category.toUpperCase()} EDITION ]`, 60, 150, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#f8fafc').fontSize(30).text(title, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#94a3b8').fontSize(16).text(`By ${author}`, { align: 'center' });
  doc.moveDown(3);
  doc.fillColor('#22c55e').fontSize(12).text('AUTHENTIC LICENSED E-BOOK COPY', { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#64748b').fontSize(10).text('Thank you for purchasing this eBook from our Official Store.', { align: 'center' });

  // Chapter Pages
  chapterTopics.forEach((ch, idx) => {
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
    doc.fontSize(10).fillColor('#94a3b8').text(`Page ${idx + 2} | ${title}`, 50, 780, { align: 'center' });
  });

  doc.end();
};

const sampleBooks = [
  {
    title: 'Mastering Full-Stack JavaScript & MERN',
    author: 'Alex Mercer',
    description: 'A comprehensive, modern guide to building production-ready scalable web applications using MongoDB, Express, React, and Node.js with authentic industry patterns.',
    category: 'Programming',
    price: 499,
    originalPrice: 999,
    coverImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'mastering-fullstack-mern.pdf',
    pages: 280,
    rating: 4.9,
    language: 'English',
    featured: true,
    chapters: [
      {
        title: 'Modern Architecture & Clean Code in Node.js',
        content: 'Building scalable Node.js applications requires a clear separation of concerns, modular route structures, and robust middleware. In this chapter, we explore how clean architecture shields your code from regressions.',
        points: ['Service layer isolation', 'Asynchronous error handling', 'State management patterns'],
      },
      {
        title: 'Database Design with MongoDB & Mongoose',
        content: 'Data modeling in NoSQL differs fundamentally from relational stores. Learn indexing, aggregation pipelines, schema validation, and replica management.',
        points: ['Compound Indexes for fast queries', 'Referencing vs Embedding', 'Mongoose pre/post hooks'],
      },
      {
        title: 'Securing APIs & Payment Gateways',
        content: 'Implementing HMAC-SHA256 signature verification for payment processors like Razorpay ensures no tampered transactions pass into your fulfillment pipeline.',
        points: ['Webhook verification secrets', 'JWT expiration strategies', 'Role-based access checks'],
      },
    ],
  },
  {
    title: 'Python for AI, Machine Learning & Deep Learning',
    author: 'Dr. Sophia Lin',
    description: 'Learn modern machine learning algorithms, PyTorch fundamentals, neural networks, and deploying LLM workflows in production from ground up.',
    category: 'Artificial Intelligence',
    price: 649,
    originalPrice: 1299,
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'python-ai-ml-handbook.pdf',
    pages: 350,
    rating: 4.8,
    language: 'English',
    featured: true,
    chapters: [
      {
        title: 'Tensors and Deep Neural Networks',
        content: 'Neural networks learn representations through matrix transformations and non-linear activations. Discover backpropagation and loss landscape optimization.',
        points: ['Gradient descent variants', 'Autograd mechanisms', 'Tensor operations in GPU memory'],
      },
      {
        title: 'Transformers and Large Language Models',
        content: 'Attention is all you need. We break down self-attention heads, positional encodings, and fine-tuning open-weights models.',
        points: ['Multi-head attention mechanics', 'LoRA parameter efficient tuning', 'Token embeddings'],
      },
    ],
  },
  {
    title: 'System Design & Scalable Cloud Architectures',
    author: 'Vikram Sethi',
    description: 'Ace technical interviews and engineer resilient distributed systems handling millions of concurrent requests with microservices, caching, and message queues.',
    category: 'Cloud & Architecture',
    price: 599,
    originalPrice: 1199,
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'system-design-secrets.pdf',
    pages: 310,
    rating: 4.9,
    language: 'English',
    featured: true,
    chapters: [
      {
        title: 'High Availability and Load Balancing',
        content: 'Designing for single points of failure is the core tenet of distributed systems. Explore layer 4 vs layer 7 routing and consistent hashing rings.',
        points: ['Round-robin vs Weighted least connections', 'Health probes and graceful degradations', 'Global DNS routing'],
      },
      {
        title: 'Caching Strategies with Redis',
        content: 'Read-through, write-through, and write-back caching. Prevent cache stampedes and memory bloat with probabilistic TTLs.',
        points: ['Cache stampede mitigation', 'LRU eviction policies', 'Distributed locks with Redlock'],
      },
    ],
  },
  {
    title: 'The Mindset of a 10x Software Engineer',
    author: 'Rohan Sharma',
    description: 'Develop laser focus, master problem decomposition, overcome impostor syndrome, and cultivate high-leverage habits that elevate your tech career.',
    category: 'Career & Self-Help',
    price: 349,
    originalPrice: 699,
    coverImage: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'mindset-10x-engineer.pdf',
    pages: 190,
    rating: 4.7,
    language: 'English',
    featured: false,
    chapters: [
      {
        title: 'First Principles Thinking in Problem Solving',
        content: 'Break down complex bugs and feature requests into their most fundamental truths before writing a single line of code.',
        points: ['Root cause isolation', 'Rubber duck debugging on paper', 'Cognitive biases in code reviews'],
      },
      {
        title: 'Deep Work and Eliminating Distractions',
        content: 'How to structure uninterrupted 90-minute coding blocks to enter flow state and achieve rapid implementation velocity.',
        points: ['Batching asynchronous notifications', 'Mental context-switching costs', 'Energy management vs time management'],
      },
    ],
  },
  {
    title: 'Mastering Modern UI/UX Design & CSS Wizardry',
    author: 'Elena Rostova',
    description: 'Transform boring websites into stunning, interactive, responsive digital experiences using modern CSS Grid, Flexbox, micro-animations, and UX psychology.',
    category: 'Design & Frontend',
    price: 399,
    originalPrice: 799,
    coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'ui-ux-design-wizardry.pdf',
    pages: 220,
    rating: 4.9,
    language: 'English',
    featured: false,
    chapters: [
      {
        title: 'Color Psychology & Typography Hierarchy',
        content: 'Harmonious color palettes and deliberate font pairings determine how credible and engaging your product feels in the first 3 seconds.',
        points: ['60-30-10 color rule', 'Scale and line-height ratios', 'High-contrast accessible text'],
      },
      {
        title: 'Micro-Interactions & Smooth Animations',
        content: 'Subtle transitions give digital products tactile feedback. Learn cubic-bezier easing curves and hardware-accelerated CSS transforms.',
        points: ['Transform vs top/left rendering performance', 'Button ripple feedback', 'Skeleton loading states'],
      },
    ],
  },
  {
    title: 'Docker, Kubernetes & DevOps Pipeline Mastery',
    author: 'Marcus Vance',
    description: 'From local containerization to multi-node Kubernetes clusters, CI/CD automated test & deployment pipelines, and cloud monitoring.',
    category: 'Cloud & Architecture',
    price: 549,
    originalPrice: 1099,
    coverImage: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&w=600&q=80',
    pdfFileName: 'docker-kubernetes-devops.pdf',
    pages: 310,
    rating: 4.8,
    language: 'English',
    featured: false,
    chapters: [
      {
        title: 'Multi-Stage Docker Builds',
        content: 'Shrink container images from 1.5GB to 50MB using alpine bases, multi-stage compilation, and dependency caching.',
        points: ['Layer caching optimization', 'Non-root container user security', 'Zero-footprint binaries'],
      },
      {
        title: 'Kubernetes Pod Scheduling & Deployments',
        content: 'Rolling updates, blue-green deployments, ingress controllers, and horizontal pod autoscalers.',
        points: ['Readiness vs Liveness probes', 'ConfigMaps and Secrets', 'HPA based on CPU/RAM metrics'],
      },
    ],
  },
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ebook_store';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding...');

    // Generate PDFs
    console.log('Generating sample eBook PDF files in storage/books/...');
    for (const b of sampleBooks) {
      generateSamplePDF(b.pdfFileName, b.title, b.author, b.category, b.chapters);
    }
    console.log('All eBook PDFs generated successfully!');

    // Seed into Database if not already present
    for (const b of sampleBooks) {
      const existing = await Book.findOne({ title: b.title });
      if (!existing) {
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
        console.log(`+ Added book: ${b.title}`);
      } else {
        console.log(`= Book already exists: ${b.title}`);
      }
    }

    console.log('Database seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, sampleBooks };
