const express = require('express');
const BookController = require('../controllers/bookController');
const { requireAuth, requireOwnership, rateLimit } = require('../middleware/auth');
const Book = require('../models/Book');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for book image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'books');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'book-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Apply rate limiting to all book routes
router.use(rateLimit(50, 15 * 60 * 1000)); // 50 requests per 15 minutes

/**
 * @route   POST /api/books
 * @desc    Add a new book to user's library
 * @access  Private
 */
router.post('/', requireAuth, upload.single('cover'), BookController.addBook);

/**
 * @route   GET /api/books
 * @desc    Get user's books (library)
 * @access  Private
 */
router.get('/', requireAuth, BookController.getUserBooks);

/**
 * @route   GET /api/books/search
 * @desc    Search and filter available books
 * @access  Private
 */
router.get('/search', requireAuth, BookController.searchBooks);

/**
 * @route   GET /api/books/:bookId
 * @desc    Get book details
 * @access  Private
 */
router.get('/:bookId', requireAuth, BookController.getBookDetails);

/**
 * @route   PUT /api/books/:bookId
 * @desc    Update book information
 * @access  Private (Owner only)
 */
router.put('/:bookId', 
    requireAuth, 
    requireOwnership(Book, 'bookId'), 
    upload.array('images', 5), 
    BookController.updateBook
);

/**
 * @route   DELETE /api/books/:bookId
 * @desc    Delete a book
 * @access  Private (Owner only)
 */
router.delete('/:bookId', 
    requireAuth, 
    requireOwnership(Book, 'bookId'), 
    BookController.deleteBook
);

/**
 * @route   PATCH /api/books/:bookId/availability
 * @desc    Toggle book availability
 * @access  Private (Owner only)
 */
router.patch('/:bookId/availability', 
    requireAuth, 
    requireOwnership(Book, 'bookId'), 
    BookController.toggleAvailability
);

module.exports = router;
