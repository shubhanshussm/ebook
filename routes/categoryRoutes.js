const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const DEFAULT_CATEGORIES = [
  { name: 'Programming', icon: '💻', description: 'Web development, core algorithms & software engineering' },
  { name: 'Artificial Intelligence', icon: '🤖', description: 'Machine Learning, Deep Learning & LLMs' },
  { name: 'Cloud & Architecture', icon: '☁️', description: 'Microservices, Docker, Kubernetes & distributed systems' },
  { name: 'Career & Self-Help', icon: '🚀', description: 'Productivity, career acceleration & engineering mindset' },
  { name: 'Design & Frontend', icon: '🎨', description: 'UI/UX design, CSS frameworks & modern interface craft' },
  { name: 'Business & Finance', icon: '📈', description: 'Economics, entrepreneurship & wealth creation' },
  { name: 'Fiction & Novels', icon: '📚', description: 'Fiction, literature & creative storytelling' },
];

// Helper to ensure all predefined categories exist in database
const ensurePredefinedCategories = async () => {
  for (const defCat of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({
      name: { $regex: new RegExp(`^${defCat.name}$`, 'i') },
    });
    if (!exists) {
      await Category.create(defCat);
    }
  }
};

// @route   GET /api/categories
// @desc    Get all categories with dynamic book counts (Public)
router.get('/', async (req, res) => {
  try {
    // Ensure all default predefined categories are present
    await ensurePredefinedCategories();

    const categories = await Category.find().sort({ name: 1 });

    // Attach real-time book count to each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (c) => {
        const count = await Book.countDocuments({ category: c.name });
        return {
          _id: c._id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          description: c.description,
          bookCount: count,
          isPredefined: DEFAULT_CATEGORIES.some((d) => d.name.toLowerCase() === c.name.toLowerCase()),
          createdAt: c.createdAt,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: categoriesWithCount.length,
      categories: categoriesWithCount,
    });
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

// @route   POST /api/categories/reset-defaults
// @desc    Restore all predefined original categories (Admin Only)
router.post('/reset-defaults', protect, adminOnly, async (req, res) => {
  try {
    await ensurePredefinedCategories();
    const all = await Category.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: 'All original predefined categories have been restored successfully!',
      categories: all,
    });
  } catch (error) {
    console.error('Reset defaults error:', error);
    res.status(500).json({ success: false, message: 'Failed to restore predefined categories.' });
  }
});

// @route   POST /api/categories
// @desc    Create a new book category (Admin Only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, icon, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a category name.',
      });
    }

    const cleanName = name.trim();

    // Check case-insensitive duplicate
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Category "${cleanName}" already exists!`,
      });
    }

    const category = await Category.create({
      name: cleanName,
      icon: icon && icon.trim() ? icon.trim() : '📚',
      description: description ? description.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: `Category "${category.name}" added successfully!`,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description,
        bookCount: 0,
      },
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create category.',
    });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a book category (Admin Only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    // Safety Guard: Check if any books are currently assigned to this category
    const bookCount = await Book.countDocuments({ category: category.name });
    if (bookCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Safety Guard: Cannot delete category "${category.name}" because ${bookCount} eBook(s) currently belong to it. Please reassign or delete those eBooks first.`,
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Category "${category.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category.',
    });
  }
});

module.exports = router;
