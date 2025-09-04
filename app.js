require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');

const User = require('./models/User'); // Mongoose User model
const Book = require('./models/Book'); // Mongoose Book model  
const Swap = require('./models/Swap'); // Mongoose Swap model
const Activity = require('./models/Activity');
const { getDashboardData } = require('./controllers/dashboardController'); // Dashboard data controller

const app = express();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'profiles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const userEmail = req.session.user ? req.session.user.email : 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `${userEmail.replace('@', '_at_')}_${Date.now()}${fileExt}`;
    cb(null, fileName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/')
    ? cb(null, true)
    : cb(new Error('Only image files are allowed!'), false)
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(() => {
    console.warn('⚠️ MongoDB Connection Failed - Running without database');
    console.warn('Registration and login will be temporarily disabled');
  });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
  resave: false,
  saveUninitialized: false,
  name: 'bookswap.sid',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    path: '/'
  }
}));

// Debug + no-cache on protected pages
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.path}:`, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!(req.session && req.session.user),
      userEmail: req.session?.user?.email,
      cookies: req.headers.cookie ? 'Present' : 'Missing'
    });
  }

  if (
    req.path.startsWith('/dashboard') ||
    req.path.startsWith('/me') ||
    req.path.startsWith('/library') ||
    req.path.startsWith('/wishlist') ||
    req.path.startsWith('/profile')
  ) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Import API Routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const swapRoutes = require('./routes/swaps');
const userRoutes = require('./routes/users');
// const dashboardRoutes = require('./routes/dashboard');

// Mount API Routes
app.use('/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/dashboard', dashboardRoutes);

// Legacy route for book addition (redirect to API)
app.post('/books/add', (req, res) => {
    // Redirect to the new API endpoint
    res.redirect(307, '/api/books');
});

// Quick test route to create a test user (REMOVE IN PRODUCTION)
app.get('/create-test-user', async (req, res) => {
    try {
        // Check if test user already exists
        const existingUser = await User.findOne({ email: 'test@gmail.com' });
        if (existingUser) {
            return res.json({ message: 'Test user already exists. You can login with test@gmail.com / password123' });
        }

        // Create test user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('password123', 12);
        
        const testUser = new User({
            name: 'Test User',
            email: 'test@gmail.com',
            password: hashedPassword,
            location: 'Test City'
        });

        await testUser.save();
        
        res.json({ 
            message: 'Test user created successfully!', 
            credentials: { email: 'test@gmail.com', password: 'password123' }
        });
        
    } catch (error) {
        console.error('Error creating test user:', error);
        res.status(500).json({ error: 'Failed to create test user' });
    }
});

/* --------------------- Helpers --------------------- */
async function logActivity({ userId, action, message, entityType = null, entityId = null, meta = {} }) {
  try {
    await Activity.create({ user: userId, action, message, entityType, entityId, meta });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

/* --------------------- Routes --------------------- */
// Home
app.get('/', (req, res) => {
  const userLoggedIn = !!(req.session && req.session.user);
  if (userLoggedIn) {
    res.render('home', { userLoggedIn: true, activePage: 'home' });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  }
});

app.get('/home', (req, res) => res.redirect('/'));

/**
 * Dashboard Route - Real-time data integration
 * 
 * This route fetches real user data from the database including:
 * 1. User statistics (books owned, swaps completed, wishlist size)
 * 2. Swap insights (success rate, active swaps, performance metrics)
 * 3. Nearby available books based on user location
 * 4. Trending genres and books in the platform
 * 5. User activity and recommendations
 */
app.get('/dashboard', async (req, res) => {
    console.log('Dashboard access attempt:', {
        sessionID: req.sessionID,
        session: req.session,
        hasUser: !!(req.session && req.session.user),
        cookies: req.headers.cookie
    });
    
    if (!req.session || !req.session.user) {
        console.log('Dashboard: No session/user, redirecting to login');
        return res.redirect('/login?error=session');
    }
    
    try {
        const userLoggedIn = req.session && req.session.user;
        const userId = req.session.user._id || req.session.user.id;
        const userName = req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User';
        const userPhoto = req.session.user.photo || null;
        
        console.log('Dashboard - Session user:', req.session.user);
        console.log('Dashboard - Resolved user name:', userName);
        console.log('Dashboard - User ID:', userId);
        
        // Verify user exists in database
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            console.log('Dashboard: User not found in database');
            return res.redirect('/login?error=user_not_found');
        }
        
        // Fetch REAL dashboard data from database
        const dashboardData = await getRealDashboardData(userId);
        
        console.log('Real dashboard data fetched successfully:', {
            booksOwned: dashboardData.userStats.booksOwned,
            swapsCompleted: dashboardData.userStats.swapsCompleted,
            nearbyBooksCount: dashboardData.nearbyBooks.length,
            availableBooks: dashboardData.userStats.booksAvailable
        });
        
        res.render('dashboard', { 
            userLoggedIn, 
            activePage: 'dashboard',
            userName: userName,
            userPhoto: userPhoto,
            userStats: dashboardData.userStats,
            swapInsights: dashboardData.swapInsights,
            nearbyBooks: dashboardData.nearbyBooks,
            trendingGenres: dashboardData.trendingGenres,
            trendingBooks: dashboardData.trendingBooks,
            recentActivity: dashboardData.recentActivity
        });
        
    } catch (error) {
        console.error('Dashboard error:', error);
        
        // Fallback to empty data if database queries fail
        const fallbackData = {
            userStats: {
                booksOwned: 0,
                swapsCompleted: 0,
                wishlistItems: 0,
                pendingSwaps: 0
            },
            swapInsights: {
                successRate: 0,
                avgResponseTime: "No data",
                popularGenre: "Not specified"
            },
            nearbyBooks: [],
            trendingGenres: [],
            trendingBooks: []
        };
        
        res.render('dashboard', { 
            userLoggedIn: true, 
            activePage: 'dashboard',
            userName: req.session.user.name || req.session.user.fullname || 'User',
            userPhoto: req.session.user.photo || null,
            ...fallbackData,
            error: 'Unable to load dashboard data. Please try again.'
        });
    }
});

/**
 * API Endpoints for real-time dashboard data
 * These endpoints allow for AJAX updates without full page reload
 */

// API endpoint to get user statistics
app.get('/api/dashboard/stats', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        const { getUserStats } = require('./helpers/dashboardHelper');
        const userStats = await getUserStats(userId);
        res.json(userStats);
    } catch (error) {
        console.error('API error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
});

// API endpoint to get swap insights
app.get('/api/dashboard/insights', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        const { getSwapInsights } = require('./helpers/dashboardHelper');
        const swapInsights = await getSwapInsights(userId);
        res.json(swapInsights);
    } catch (error) {
        console.error('API error fetching swap insights:', error);
        res.status(500).json({ error: 'Failed to fetch swap insights' });
    }
});

// API endpoint to get nearby books
app.get('/api/dashboard/nearby', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        const limit = parseInt(req.query.limit) || 3;
        const { getNearbyBooks } = require('./helpers/dashboardHelper');
        const nearbyBooks = await getNearbyBooks(userId, limit);
        res.json(nearbyBooks);
    } catch (error) {
        console.error('API error fetching nearby books:', error);
        res.status(500).json({ error: 'Failed to fetch nearby books' });
    }
});

// API endpoint to get trending data
app.get('/api/dashboard/trending', async (req, res) => {
    try {
        const { getTrendingGenres, getTrendingBooks } = require('./helpers/dashboardHelper');
        const [trendingGenres, trendingBooks] = await Promise.all([
            getTrendingGenres(),
            getTrendingBooks()
        ]);
        
        res.json({
            genres: trendingGenres,
            books: trendingBooks
        });
    } catch (error) {
        console.error('API error fetching trending data:', error);
        res.status(500).json({ error: 'Failed to fetch trending data' });
    }
});

// API endpoint to refresh all dashboard data
app.get('/api/dashboard/refresh', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        const { getDashboardData } = require('./helpers/dashboardHelper');
        const dashboardData = await getDashboardData(userId);
        res.json(dashboardData);
    } catch (error) {
        console.error('API error refreshing dashboard data:', error);
        res.status(500).json({ error: 'Failed to refresh dashboard data' });
    }
});

// Login / Register / Logout
app.get('/login', (req, res) => {
    const error = req.query.error;
    const message = req.query.message;
    let errorMessage = '';
    
    if (error === 'invalid') {
        errorMessage = 'Invalid email or password. Please try again.';
    } else if (error === 'server') {
        errorMessage = 'Server error. Please try again later.';
    } else if (message) {
        errorMessage = message; // This will show the logout success message
    }
    
    console.log('Login page accessed with error:', error, 'Message:', errorMessage);
    res.render('login', { 
        errorMessage,
        error: errorMessage, // Support both error and errorMessage
        email: req.query.email || '' // Preserve email on error
    });
});

app.get('/register', (req, res) => {
    res.render('register', { 
        error: req.query.error || '',
        name: req.query.name || '',
        email: req.query.email || ''
    });
});

// Profile photo upload route
app.post('/profile/upload-photo', upload.single('profilePhoto'), async (req, res) => {
    console.log('Profile photo upload attempt:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        file: req.file ? 'File received' : 'No file',
        userEmail: req.session?.user?.email
    });
    
    if (!req.session || !req.session.user) {
        console.log('Profile upload: No session/user, returning unauthorized');
        return res.status(401).json({ success: false, error: 'Unauthorized - Please login again' });
    }

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const photoPath = `/uploads/profiles/${req.file.filename}`;
        
        // Update session first
        req.session.user.photo = photoPath;

        // Update database if connected and user has a real ID
        if (mongoose.connection.readyState === 1 && req.session.user.id && !req.session.user.id.toString().startsWith('test-')) {
            try {
                const updateResult = await User.findByIdAndUpdate(
                    req.session.user.id, 
                    { 
                        photo: photoPath,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
                
                if (updateResult) {
                    console.log('✅ Photo updated in database for user:', req.session.user.email);
                } else {
                    console.warn('⚠️ User not found in database:', req.session.user.id);
                }
            } catch (dbError) {
                console.error('❌ Database update failed:', dbError.message);
                console.log('User ID:', req.session.user.id);
            }
        } else {
            console.log('📝 Photo updated in session only (test mode or no DB connection)');
            console.log('Connection state:', mongoose.connection.readyState);
            console.log('User ID:', req.session.user.id);
        }

        // Save session to ensure photo persists
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ success: false, error: 'Failed to save session' });
            }
            
            res.json({ 
                success: true, 
                message: 'Profile photo updated successfully',
                photoUrl: photoPath
            });
        });

    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ success: false, error: 'Failed to upload photo' });
    }
});

// Profile
app.get('/me', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login?error=session');

  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  const userEmail = req.session.user.email || 'user@example.com';
  const userPhoto = req.session.user.photo || '/images/default-avatar.png';

  const userBooks = [
    { title: 'The Great Gatsby', image: '/images/book1.jpg' },
    { title: '1984', image: '/images/book2.jpg' },
    { title: 'To Kill a Mockingbird', image: '/images/book3.jpg' }
  ];

  res.render('profile', {
    user,
    userEmail,
    userPhoto,
    userBooks,
    activePage: 'profile'
  });
});

app.get('/profile', (req, res) => res.redirect('/me'));

// Library page - user's personal book collection
app.get('/library', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    
    const userLoggedIn = req.session && req.session.user;
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        // Fetch REAL user books from database
        const userBooks = await Book.find({ owner: userId }).sort({ createdAt: -1 });
        
        console.log(`Found ${userBooks.length} real books for user ${userId}`);
        
        // Calculate REAL library statistics
        const libraryStats = {
            totalBooks: userBooks.length,
            availableBooks: userBooks.filter(book => book.availability === 'available').length,
            uniqueAuthors: [...new Set(userBooks.map(book => book.author))].length,
            completedSwaps: await Swap.countDocuments({
                $or: [{ requester: userId }, { owner: userId }],
                status: 'Completed'
            })
        };
        
        // Format books for display
        const formattedBooks = userBooks.map(book => ({
            id: book._id,
            title: book.title,
            author: book.author,
            genre: book.genre || 'Unknown',
            condition: book.condition || 'Good',
            language: book.language || 'English',
            available: book.availability === 'available',
            image: book.image || '/images/book-placeholder.jpg',
            dateAdded: book.createdAt
        }));
        
        res.render('library', {
            userLoggedIn,
            activePage: 'library',
            books: formattedBooks, // Changed from userBooks to books
            userBooks: formattedBooks, // Keep both for compatibility
            libraryStats: libraryStats
        });
        
    } catch (error) {
        console.error('Library error:', error);
        res.render('library', {
            userLoggedIn,
            activePage: 'library',
            books: [], // Changed from userBooks to books
            userBooks: [], // Keep both for compatibility
            libraryStats: {
                totalBooks: 0,
                availableBooks: 0,
                uniqueAuthors: 0,
                completedSwaps: 0
            },
            error: 'Unable to load your library. Please try again.'
        });
    }
});

// Book details route
app.get('/books/:bookId', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    
    try {
        const { bookId } = req.params;
        const userId = req.session.user._id || req.session.user.id;
        
        // Find the book and check if user owns it
        const book = await Book.findOne({ _id: bookId, owner: userId });
        
        if (!book) {
            return res.status(404).send('Book not found or you do not have permission to view it.');
        }
        
        // Simple book details page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${book.title} - Book Details</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.4.1/dist/css/bootstrap.min.css">
                <link rel="stylesheet" href="/css/style.css">
            </head>
            <body class="bg-dark text-light">
                <div class="container mt-5">
                    <div class="row">
                        <div class="col-md-4">
                            <img src="${book.image || '/images/book-placeholder.png'}" class="img-fluid" alt="${book.title}">
                        </div>
                        <div class="col-md-8">
                            <h1>${book.title}</h1>
                            <h3>by ${book.author}</h3>
                            <p><strong>Genre:</strong> ${book.genre || 'Not specified'}</p>
                            <p><strong>Condition:</strong> ${book.condition || 'Not specified'}</p>
                            <p><strong>Language:</strong> ${book.language || 'Not specified'}</p>
                            <p><strong>Availability:</strong> ${book.availability === 'available' ? 'Available for swap' : 'Not available'}</p>
                            <p><strong>Description:</strong> ${book.description || 'No description provided'}</p>
                            <div class="mt-4">
                                <a href="/library" class="btn btn-primary">Back to Library</a>
                                <button class="btn btn-danger remove-book-btn ml-2" 
                                        data-book-id="${book._id}" 
                                        data-book-title="${book.title}">
                                    Remove Book
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
                <script>
                    // Remove book functionality
                    $('.remove-book-btn').click(function() {
                        const bookId = $(this).data('book-id');
                        const bookTitle = $(this).data('book-title');
                        
                        if (confirm('Are you sure you want to remove "' + bookTitle + '" from your library?')) {
                            fetch('/api/books/' + bookId, {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' }
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    alert('Book removed successfully!');
                                    window.location.href = '/library';
                                } else {
                                    alert('Error: ' + data.message);
                                }
                            })
                            .catch(error => {
                                alert('Error removing book. Please try again.');
                            });
                        }
                    });
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('Book details error:', error);
        res.status(500).send('Error loading book details.');
    }
});

app.get('/wishlist', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    
    const userLoggedIn = req.session && req.session.user;
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        // Fetch REAL user data from database
        const userData = await User.findById(userId);
        const rawWishlist = userData ? userData.wishlist : [];
        
        console.log(`Found ${rawWishlist.length} wishlist items for user ${userId}`);
        
        // Format wishlist items for display
        const wishlistBooks = rawWishlist.map((item, index) => ({
            id: item._id || index,
            title: item.title,
            author: item.author,
            genre: item.genre || 'Unknown',
            priority: item.priority || 'Medium',
            available: false, // TODO: Check if book is available from other users
            availableNearby: 0, // TODO: Calculate nearby availability
            image: item.image || '/images/book-placeholder.jpg',
            dateAdded: item.dateAdded || new Date()
        }));
        
        // Check which wishlist books are available from other users
        for (let wishItem of wishlistBooks) {
            const availableBooks = await Book.find({
                owner: { $ne: userId },
                title: new RegExp(wishItem.title, 'i'),
                author: new RegExp(wishItem.author, 'i'),
                availability: 'available'
            });
            
            wishItem.available = availableBooks.length > 0;
            wishItem.availableNearby = availableBooks.length;
        }
        
        // Calculate REAL wishlist statistics
        const wishlistStats = {
            totalWishlist: wishlistBooks.length,
            availableNow: wishlistBooks.filter(book => book.available).length,
            highPriority: wishlistBooks.filter(book => book.priority === 'High').length,
            matchNotifications: 2 // TODO: Implement real notification system
        };
        
        res.render('wishlist', { 
            userLoggedIn, 
            activePage: 'wishlist',
            wishlistBooks: wishlistBooks,
            wishlistStats: wishlistStats
        });
        
    } catch (error) {
        console.error('Wishlist error:', error);
        res.render('wishlist', {
            userLoggedIn,
            activePage: 'wishlist',
            wishlistBooks: [],
            wishlistStats: {
                totalWishlist: 0,
                availableNow: 0,
                highPriority: 0,
                matchNotifications: 0
            },
            error: 'Unable to load your wishlist. Please try again.'
        });
    }
});

// Add book to wishlist
app.post('/wishlist/add', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { title, author, ownerId, ownerName, priority, notes } = req.body;
        
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if book is already in wishlist
        const existingBook = user.wishlist.find(book => 
            book.title === title && book.author === author
        );
        
        if (existingBook) {
            return res.status(400).json({ error: 'Book already in wishlist' });
        }
        
        // Add book to wishlist
        user.wishlist.push({
            title,
            author,
            ownerId,
            ownerName,
            priority: priority || 'Medium',
            notes: notes || '',
            addedAt: new Date()
        });
        
        await user.save();
        
        res.json({ success: true, message: 'Book added to wishlist' });
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        res.status(500).json({ error: 'Failed to add book to wishlist' });
    }
});

// Remove book from wishlist
app.delete('/wishlist/remove/:bookId', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.wishlist = user.wishlist.filter(book => book._id.toString() !== req.params.bookId);
        await user.save();
        
        res.json({ success: true, message: 'Book removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ error: 'Failed to remove book from wishlist' });
    }
});

app.get('/swap-matcher', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  res.render('placeholder', { userLoggedIn: true, activePage: 'swap-matcher', user });
});

// app.get('/nearby', (req, res) => {
//     if (!req.session || !req.session.user) {
//         return res.redirect('/login');
//     }
//     const userLoggedIn = req.session && req.session.user;
//     const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
//     res.render('placeholder', { 
//         userLoggedIn, 
//         activePage: 'nearby',
//         user: user,
//         pageTitle: 'Nearby',
//         pageDescription: 'Connect with book lovers near you',
//         pageIcon: 'bi bi-geo-alt'
//     });
// });

app.get('/rewards', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  res.render('placeholder', {
    userLoggedIn: true,
    activePage: 'rewards',
    user,
    pageTitle: 'Rewards',
    pageDescription: 'Earn points and unlock achievements',
    pageIcon: 'bi bi-trophy'
  });
});

// Test login error
app.get('/test-login-error', (req, res) => res.redirect('/login?error=invalid'));

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.redirect('/dashboard');
    res.clearCookie('bookswap.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.redirect('/login?message=You have been successfully logged out');
  });
});

// Test session
app.get('/test-session', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!(req.session && req.session.user),
    user: req.session?.user || null,
    cookies: req.headers.cookie
  });
});

app.post('/register', async (req, res) => {
  const { fullname, email, password, location } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating registration");
      return res.redirect('/login?registered=true');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ fullname, email, password: hashedPassword, location });
    res.redirect('/login');
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      // Simulated login when DB is down
      const simId = 'sim-' + Date.now();
      req.session.user = {
        _id: simId,           // normalize: include _id
        id: simId,
        email,
        name: email.split('@')[0],
        fullname: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
        photo: '/images/default-avatar.png'
      };
      return req.session.save(() => res.redirect('/dashboard'));
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=invalid');
    }

    // Real login
    req.session.user = {
      _id: user._id,         // normalize: include _id
      id: user._id,
      email: user.email,
      name: user.fullname,
      fullname: user.fullname,
      photo: user.photo || '/images/default-avatar.png'
    };
    req.session.save(() => res.redirect('/dashboard'));
  } catch (err) {
    console.error("Login error:", err);
    res.redirect('/login?error=server');
  }
});

// Library page
app.get('/library', async (req, res) => {
  try {
    if (!req.session || !req.session.user) return res.redirect('/login');

    const user =
      req.session.user.name ||
      req.session.user.fullname ||
      (req.session.user.email ? req.session.user.email.split('@')[0] : 'User');

    // Show all books for now; later filter by owner
    const books = await Book.find().sort({ createdAt: -1 }).lean();

    res.render('library', {
      userLoggedIn: true,
      activePage: 'library',
      user,
      books
    });
  } catch (err) {
    console.error('Error loading library:', err);
    res.status(500).send('Failed to load library');
  }
});

app.post('/books', async (req, res) => {
  try {
    const user = req.session?.user || null;
    if (!user) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const {
      title, author, genre, language, year, isbn, publisher, condition, cover
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, message: 'Title is required' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, message: 'Database not connected' });
    }

    const coverUrl = (typeof cover === 'string' && cover.trim()) ? cover.trim() : undefined;

    const doc = await Book.create({
      title: title.trim(),
      author,
      genre,
      language,
      publicationYear: year ? Number(year) : undefined,
      isbn,
      publisher,
      condition,
      coverUrl
      // , owner: user._id    // enable after adding `owner` to schema
    });

    // Log activity
    await logActivity({
      userId: user._id || user.id,
      action: 'ADD_BOOK',
      message: `Added “${doc.title}” to library`,
      entityType: 'Book',
      entityId: doc._id,
      meta: { author: doc.author, condition: doc.condition }
    });
    

    res.status(201).json({ ok: true, book: doc });
  } catch (err) {
    console.error('Create book error:', err);
    res.status(400).json({ ok: false, message: err?.message || 'Invalid data' });
  }
});

// API to list books (optional)
app.get('/api/books', async (req, res) => {
  const books = await Book.find().sort({ createdAt: -1 }).lean();
  res.json(books);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
    console.log('Dashboard available at: http://localhost:3000/dashboard');
  });
}


module.exports = app;
