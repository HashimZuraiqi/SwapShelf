const express = require('express');
const UserController = require('../controllers/userController');
const { requireAuth, rateLimit } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

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

module.exports = router;
