const express = require('express');
const UserController = require('../controllers/userController');
const { requireAuth, rateLimit } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const Activity = require('../models/Activity');

const router = express.Router();

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const userEmail = req.session.user ? req.session.user.email : 'unknown';
        const uniqueSuffix = Date.now();
        const fileName = `${userEmail.replace('@', '_at_')}_${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Apply rate limiting
router.use(rateLimit(40, 15 * 60 * 1000)); // 40 requests per 15 minutes

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile data
 * @access  Private
 */
router.get('/profile', requireAuth, UserController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', requireAuth, upload.single('photo'), UserController.updateProfile);

/**
 * @route   POST /api/users/wishlist
 * @desc    Add book to wishlist
 * @access  Private
 */
router.post('/wishlist', requireAuth, UserController.addToWishlist);

/**
 * @route   DELETE /api/users/wishlist/:itemId
 * @desc    Remove book from wishlist
 * @access  Private
 */
router.delete('/wishlist/:itemId', requireAuth, UserController.removeFromWishlist);

/**
 * @route   PUT /api/users/wishlist/:itemId
 * @desc    Update wishlist item
 * @access  Private
 */
router.put('/wishlist/:itemId', requireAuth, UserController.updateWishlistItem);

/**
 * @route   GET /api/users/wishlist/matches
 * @desc    Find wishlist matches
 * @access  Private
 */
router.get('/wishlist/matches', requireAuth, UserController.findWishlistMatches);

/**
 * @route   GET /api/users/activity
 * @desc    Get user's reading activity/history
 * @access  Private
 */
router.get('/activity', requireAuth, UserController.getReadingActivity);

/**
 * @route   GET /api/users/history
 * @desc    Paginated full activity history for the logged-in user
 * @access  Private
 * Query: ?page=1&limit=20
 */
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [raw, total] = await Promise.all([
      Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments({ user: userId })
    ]);

    const items = raw.map(a => ({
      // mirror your formatActivity response used elsewhere
      message: a.message,
      time: new Date(a.createdAt).toISOString(),
      icon: (function () {
        switch (a.action) {
          case 'ADD_BOOK': return 'bi-plus-circle';
          case 'UPDATE_BOOK': return 'bi-pencil-square';
          case 'DELETE_BOOK': return 'bi-trash';
          case 'COMPLETE_SWAP': return 'bi-arrow-left-right';
          case 'ADD_WISHLIST': return 'bi-heart-fill';
          case 'REMOVE_WISHLIST': return 'bi-heart';
          case 'MATCH_SWAP': return 'bi-handshake';
          case 'EARN_POINTS': return 'bi-coin';
          case 'UPDATE_PROFILE': return 'bi-person-check';
          default: return 'bi-info-circle';
        }
      })(),
      iconClass: (function () {
        switch (a.action) {
          case 'ADD_BOOK': return 'text-primary';
          case 'UPDATE_BOOK': return 'text-info';
          case 'DELETE_BOOK': return 'text-danger';
          case 'COMPLETE_SWAP': return 'text-success';
          case 'ADD_WISHLIST': return 'text-danger';
          case 'REMOVE_WISHLIST': return 'text-secondary';
          case 'MATCH_SWAP': return 'text-success';
          case 'EARN_POINTS': return 'text-warning';
          case 'UPDATE_PROFILE': return 'text-info';
          default: return 'text-info';
        }
      })(),
      action: a.action,
      createdAt: a.createdAt,
      entityType: a.entityType,
      entityId: a.entityId
    }));

    const hasMore = page * limit < total;

    res.json({
      items,
      page,
      nextPage: hasMore ? page + 1 : null,
      total
    });
  } catch (err) {
    console.error('GET /api/users/history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// User search endpoint for chat
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q = '' } = req.query;
    const currentUserId = req.session.user._id || req.session.user.id;
    
    console.log(`🔍 User search query: "${q}" by user: ${currentUserId}`);
    
    // Build search query
    const searchQuery = {
      _id: { $ne: currentUserId } // Exclude current user
    };
    
    if (q.trim()) {
      searchQuery.$or = [
        { fullname: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    
    const User = require('../models/User');
    const users = await User.find(searchQuery)
      .select('_id fullname username email profileImage photo')
      .limit(20)
      .lean();
    
    // Format the response
    const formattedUsers = users.map(user => ({
      _id: user._id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      profileImage: user.profileImage || user.photo || '/images/default-avatar.png'
    }));
    
    console.log(`✅ Found ${formattedUsers.length} users`);
    res.json(formattedUsers);
    
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;
