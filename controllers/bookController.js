const Book = require('../models/Book');
const User = require('../models/User');
const Swap = require('../models/Swap');
const path = require('path');

/**
 * Book Management Controller
 * Handles all book-related operations: CRUD, search, filtering
 */

class BookController {
    
    /**
     * Add a new book to user's library
     */
    static async addBook(req, res) {
        console.log('=== ADD BOOK REQUEST ===');
        console.log('Session:', req.session?.user ? 'User logged in' : 'No user session');
        console.log('Body:', req.body);
        console.log('File:', req.file ? 'File uploaded' : 'No file');
        
        try {
            const userId = req.session.user._id || req.session.user.id;
            console.log('User ID:', userId);
            
            const { title, author, genre, condition, description, language, year, isbn, publisher } = req.body;
            
            console.log('Adding book for user:', userId);
            console.log('Book data received:', { title, author, genre, condition });
            
            // Validate required fields
            if (!title || !author) {
                console.log('❌ Validation failed: Missing title or author');
                return res.status(400).json({
                    success: false,
                    message: 'Title and author are required'
                });
            }
            
            // Get user information
            const user = await User.findById(userId);
            if (!user) {
                console.log('❌ User not found in database');
                return res.status(404).json({ 
                    success: false,
                    message: 'User not found' 
                });
            }
            
            console.log('✅ User found:', user.name || user.email);

            // Handle uploaded image
            let imagePath = '/images/book-placeholder.jpg'; // Default image
            if (req.file) {
                imagePath = `/uploads/books/${req.file.filename}`;
                console.log('✅ Image uploaded:', imagePath);
            } else {
                console.log('ℹ️ No image uploaded, using placeholder');
            }

            const newBook = new Book({
                title: title.trim(),
                author: author.trim(),
                isbn: isbn ? isbn.trim() : undefined,
                genre: Array.isArray(genre) ? genre : [genre || 'Other'],
                condition: condition || 'Good',
                description: description ? description.trim() : '',
                language: language || 'English',
                year: year ? parseInt(year) : undefined,
                publisher: publisher ? publisher.trim() : undefined,
                image: imagePath, // Single image path
                owner: userId,
                ownerName: user.name || user.fullname || user.email.split('@')[0],
                ownerLocation: user.location || 'Unknown',
                availability: 'available',
                createdAt: new Date(),
                stats: {
                    views: 0,
                    interested: 0,
                    swapRequests: 0
                }
            });
            
            console.log('📚 Attempting to save book...');
            const savedBook = await newBook.save();
            console.log('✅ Book saved successfully with ID:', savedBook._id);
            
            res.status(201).json({
                success: true,
                message: 'Book added successfully!',
                book: {
                    id: savedBook._id,
                    title: savedBook.title,
                    author: savedBook.author,
                    genre: savedBook.genre,
                    condition: savedBook.condition,
                    image: savedBook.image
                }
            });
            
        } catch (error) {
            console.error('❌ Add book error:', error);
            console.error('Error details:', error.message);
            res.status(500).json({ 
                success: false,
                message: 'Failed to add book',
                error: error.message 
            });
        }
    }
    
    /**
     * Get user's books (library)
     */
    static async getUserBooks(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 12;
            const skip = (page - 1) * limit;
            
            const books = await Book.find({ owner: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
                
            const totalBooks = await Book.countDocuments({ owner: userId });
            const totalPages = Math.ceil(totalBooks / limit);
            
            res.json({
                books,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalBooks,
                    hasMore: page < totalPages
                }
            });
            
        } catch (error) {
            console.error('Get user books error:', error);
            res.status(500).json({ error: 'Failed to fetch books' });
        }
    }
    
    /**
     * Search and filter available books
     */
    static async searchBooks(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { 
                search, 
                genre, 
                condition, 
                location, 
                page = 1, 
                limit = 12,
                sortBy = 'createdAt'
            } = req.query;
            
            let query = {
                owner: { $ne: userId }, // Exclude user's own books
                availability: 'Available'
            };
            
            // Text search
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { author: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }
            
            // Filter by genre
            if (genre && genre !== 'all') {
                query.genre = { $in: [genre] };
            }
            
            // Filter by condition
            if (condition && condition !== 'all') {
                query.condition = condition;
            }
            
            // Filter by location (basic text match - can be enhanced with geolocation)
            if (location) {
                query.ownerLocation = { $regex: location, $options: 'i' };
            }
            
            const sortOptions = {};
            switch (sortBy) {
                case 'title':
                    sortOptions.title = 1;
                    break;
                case 'author':
                    sortOptions.author = 1;
                    break;
                case 'newest':
                    sortOptions.createdAt = -1;
                    break;
                case 'popular':
                    sortOptions['stats.views'] = -1;
                    break;
                default:
                    sortOptions.createdAt = -1;
            }
            
            const skip = (page - 1) * limit;
            
            const [books, totalBooks] = await Promise.all([
                Book.find(query)
                    .populate('owner', 'fullname location')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit)),
                Book.countDocuments(query)
            ]);
            
            // Increment view count for searched books
            if (books.length > 0) {
                await Book.updateMany(
                    { _id: { $in: books.map(b => b._id) } },
                    { $inc: { 'stats.views': 1 } }
                );
            }
            
            const totalPages = Math.ceil(totalBooks / limit);
            
            res.json({
                books,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalBooks,
                    hasMore: parseInt(page) < totalPages
                },
                filters: {
                    search,
                    genre,
                    condition,
                    location,
                    sortBy
                }
            });
            
        } catch (error) {
            console.error('Search books error:', error);
            res.status(500).json({ error: 'Failed to search books' });
        }
    }
    
    /**
     * Get book details
     */
    static async getBookDetails(req, res) {
        try {
            const { bookId } = req.params;
            const userId = req.session.user._id || req.session.user.id;
            
            const book = await Book.findById(bookId)
                .populate('owner', 'fullname location photo');
                
            if (!book) {
                return res.status(404).json({ error: 'Book not found' });
            }
            
            // Increment view count if not owner
            if (book.owner._id.toString() !== userId) {
                await Book.findByIdAndUpdate(bookId, { 
                    $inc: { 'stats.views': 1 } 
                });
            }
            
            // Check if user has already requested this book
            const existingRequest = await Swap.findOne({
                requester: userId,
                'requestedBook.id': bookId,
                status: { $in: ['Pending', 'Accepted', 'In Progress'] }
            });
            
            res.json({
                book,
                hasActiveRequest: !!existingRequest,
                requestId: existingRequest?._id
            });
            
        } catch (error) {
            console.error('Get book details error:', error);
            res.status(500).json({ error: 'Failed to fetch book details' });
        }
    }
    
    /**
     * Update book information
     */
    static async updateBook(req, res) {
        try {
            const { bookId } = req.params;
            const userId = req.session.user._id || req.session.user.id;
            const updates = req.body;
            
            const book = await Book.findOne({ _id: bookId, owner: userId });
            if (!book) {
                return res.status(404).json({ error: 'Book not found or unauthorized' });
            }
            
            // Handle image updates
            if (req.files && req.files.length > 0) {
                const newImages = req.files.map(file => `/uploads/books/${file.filename}`);
                updates.images = [...(book.images || []), ...newImages];
            }
            
            Object.assign(book, updates);
            book.updatedAt = new Date();
            
            await book.save();
            
            res.json({
                success: true,
                message: 'Book updated successfully',
                book
            });
            
        } catch (error) {
            console.error('Update book error:', error);
            res.status(500).json({ error: 'Failed to update book' });
        }
    }
    
    /**
     * Delete a book
     */
    static async deleteBook(req, res) {
        try {
            const { bookId } = req.params;
            const userId = req.session.user._id || req.session.user.id;
            
            const book = await Book.findOne({ _id: bookId, owner: userId });
            if (!book) {
                return res.status(404).json({ error: 'Book not found or unauthorized' });
            }
            
            // Check for active swaps
            const activeSwaps = await Swap.find({
                'requestedBook.id': bookId,
                status: { $in: ['Pending', 'Accepted', 'In Progress'] }
            });
            
            if (activeSwaps.length > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete book with active swap requests' 
                });
            }
            
            await Book.findByIdAndDelete(bookId);
            
            res.json({
                success: true,
                message: 'Book deleted successfully',
                bookTitle: book.title
            });
            
        } catch (error) {
            console.error('Delete book error:', error);
            res.status(500).json({ error: 'Failed to delete book' });
        }
    }
    
    /**
     * Toggle book availability
     */
    static async toggleAvailability(req, res) {
        try {
            const { bookId } = req.params;
            const userId = req.session.user._id || req.session.user.id;
            
            const book = await Book.findOne({ _id: bookId, owner: userId });
            if (!book) {
                return res.status(404).json({ error: 'Book not found or unauthorized' });
            }
            
            book.availability = book.availability === 'Available' ? 'Not Available' : 'Available';
            await book.save();
            
            res.json({
                success: true,
                message: `Book marked as ${book.availability.toLowerCase()}`,
                availability: book.availability
            });
            
        } catch (error) {
            console.error('Toggle availability error:', error);
            res.status(500).json({ error: 'Failed to update availability' });
        }
    }
}

module.exports = BookController;
