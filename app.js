require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const User = require('./models/User'); // Mongoose User model
const Book = require('./models/Book'); // Mongoose Book model  
const Swap = require('./models/Swap'); // Mongoose Swap model
const Activity = require('./models/Activity');
const { getDashboardData } = require('./controllers/dashboardController'); // Dashboard data controller
const GoogleBooksHelper = require('./helpers/googleBooksHelper');

/**
 * Calculate user activity score based on real platform usage
 */
function calculateUserActivityScore(userData) {
    const {
        booksOwned,
        completedSwaps,
        pendingSwaps,
        joinDate,
        existingPoints,
        badges
    } = userData;
    
    let score = 0;
    
    // Base points from existing rewards system
    score += existingPoints || 0;
    
    // Points for books owned (10 points per book)
    score += booksOwned * 10;
    
    // Points for completed swaps (50 points per completed swap)
    score += completedSwaps * 50;
    
    // Points for active swaps (20 points per pending swap)
    score += pendingSwaps * 20;
    
    // Points for badges (100 points per badge)
    score += (badges || 0) * 100;
    
    // Bonus points for platform longevity (1 point per day since joining)
    if (joinDate) {
        const daysSinceJoin = Math.floor((new Date() - new Date(joinDate)) / (1000 * 60 * 60 * 24));
        score += Math.min(daysSinceJoin, 365); // Cap at 365 days
    }
    
    // Bonus for high activity users
    if (completedSwaps >= 10) score += 200; // Active swapper bonus
    if (booksOwned >= 20) score += 300; // Book collector bonus
    if (completedSwaps >= 5 && booksOwned >= 10) score += 500; // Well-rounded user bonus
    
    return Math.max(score, 0); // Ensure non-negative score
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Real-time chat will be handled by Socket.IO events below

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

// Debug middleware (only in development)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.path}:`, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!(req.session && req.session.user),
      userEmail: req.session?.user?.email
    });
  }

  // Set no-cache headers for protected pages
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

// Serve static files from the 'public' directory (including uploads)
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Import API Routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const swapRoutes = require('./routes/swaps');
const userRoutes = require('./routes/users');
const rewardsRoutes = require('./routes/rewards');
const chatRoutes = require('./routes/chat'); // Updated chat system

// Auth API for Chat - Now handled in chat.js routes
/*
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const user = req.session.user;
  res.json({
    _id: user._id || user.id,
    fullname: user.fullname,
    username: user.username,
    email: user.email,
    profileImage: user.profileImage || '/images/default-avatar.png'
  });
});
*/

// Mount API Routes
app.use('/auth', require('./routes/auth'));  // mounts /auth/*
app.use('/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/users', userRoutes);
app.use('/', chatRoutes); // Chat routes (includes /api/chat and /api/users/search)
app.use('/api/rewards', rewardsRoutes);
app.get('/login.html', (req, res) => res.redirect(301, '/auth/login'));
app.get('/register.html', (req, res) => res.redirect(301, '/auth/register'));
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
        const hashedPassword = await bcrypt.hash('password123', 12);
        
        const testUser = new User({
            fullname: 'Test User',
            email: 'test@gmail.com',
            // 👇 add a username derived from email (lowercased)
            username: 'test',
            password: hashedPassword,
            location: 'Test City'
        });

        await testUser.save();
        
        res.json({ 
            message: 'Test user created successfully!', 
            credentials: { email: 'test@gmail.com', username: 'test', password: 'password123' }
        });
        
    } catch (error) {
        console.error('Error creating test user:', error);
        res.status(500).json({ error: 'Failed to create test user' });
    }
});

// Test route to create sample activity data
app.get('/create-test-activity', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Please login first at /login' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        // Clear existing activities for this user first
        await Activity.deleteMany({ user: userId });
        
        // Create some sample activities
        const sampleActivities = [
            {
                user: userId,
                action: 'ADD_BOOK',
                message: 'Added "The Great Gatsby" by F. Scott Fitzgerald to library',
                entityType: 'Book',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                user: userId,
                action: 'ADD_WISHLIST',
                message: 'Added "To Kill a Mockingbird" by Harper Lee to wishlist',
                entityType: 'Wishlist',
                createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
            },
            {
                user: userId,
                action: 'UPDATE_PROFILE',
                message: 'Updated profile photo',
                entityType: 'User',
                entityId: userId,
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
            },
            {
                user: userId,
                action: 'ADD_BOOK',
                message: 'Added "1984" by George Orwell to library',
                entityType: 'Book',
                createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
            }
        ];
        
        await Activity.insertMany(sampleActivities);
        
        res.json({ 
            success: true, 
            message: 'Sample activity data created successfully!',
            count: sampleActivities.length,
            userId: userId,
            nextStep: 'Visit /me to see the activities'
        });
        
    } catch (error) {
        console.error('Error creating test activity:', error);
        res.status(500).json({ error: 'Failed to create test activity', details: error.message });
    }
});

// Debug endpoint to see activities in database
app.get('/debug-activities', async (req, res) => {
    try {
        // Get all activities for all users to see if any exist
        const allActivities = await Activity.find({}).sort({ createdAt: -1 });
        
        let userActivities = [];
        let userId = 'Not logged in';
        
        if (req.session && req.session.user) {
            userId = req.session.user._id || req.session.user.id;
            userActivities = await Activity.find({ user: userId }).sort({ createdAt: -1 });
        }
        
        res.json({
            loggedIn: !!(req.session && req.session.user),
            userId: userId,
            userActivityCount: userActivities.length,
            userActivities: userActivities,
            allActivityCount: allActivities.length,
            allActivities: allActivities.slice(0, 10) // Show first 10
        });
        
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

/* --------------------- Helpers --------------------- */
async function logActivity({ userId, action, message, entityType = null, entityId = null, meta = {} }) {
  try {
    const aliasMap = {
      WISHLIST_ADD: 'ADD_WISHLIST',
      PROFILE_UPDATE: 'UPDATE_PROFILE',
      SWAP_COMPLETED: 'COMPLETE_SWAP'
    };
    const normalized = (action || '').toUpperCase();
    const finalAction = aliasMap[normalized] || normalized;
    await Activity.create({ user: userId, action: finalAction, message, entityType, entityId, meta });
    
    // Integrate with rewards system
    try {
      const RewardsController = require('./controllers/rewardsController');
      
      // Map activity types to rewards system
      let rewardsActivityType = null;
      switch (finalAction) {
        case 'ADD_BOOK':
          rewardsActivityType = 'book_added';
          break;
        case 'COMPLETE_SWAP':
          rewardsActivityType = 'swap_completed';
          break;
        case 'UPDATE_PROFILE':
          rewardsActivityType = 'visit';
          break;
        default:
          // Check if it's a report activity
          if (message && message.toLowerCase().includes('report')) {
            rewardsActivityType = 'report_made';
          }
      }
      
      if (rewardsActivityType) {
        await RewardsController.recordActivity(userId, rewardsActivityType, meta);
      }
    } catch (rewardsError) {
      console.error('Rewards integration failed:', rewardsError.message);
      // Don't fail the main activity logging if rewards fail
    }
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

// 👉 username/email normalizer for login
function parseIdentifier(identifierRaw) {
  const id = (identifierRaw || '').trim().toLowerCase();
  if (!id) return null;
  return id.includes('@')
    ? { by: 'email', query: { email: id } }
    : { by: 'username', query: { username: id } };
}

// Helper function for time formatting
function getTimeAgo(date) {
  if (!date) return 'Unknown time';
  
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  
  return new Date(date).toLocaleDateString();
}

// Helper function to format activities consistently
function formatActivity(activity) {
  let icon = 'bi-circle';
  let iconClass = 'text-info';
  let message = activity.message;

  switch (activity.action) {
    case 'ADD_BOOK':
      icon = 'bi-plus-circle';
      iconClass = 'text-primary';
      break;
    case 'UPDATE_BOOK':
      icon = 'bi-pencil-square';
      iconClass = 'text-info';
      break;
    case 'DELETE_BOOK':
      icon = 'bi-trash';
      iconClass = 'text-danger';
      break;
    case 'COMPLETE_SWAP':
      icon = 'bi-arrow-left-right';
      iconClass = 'text-success';
      break;
    case 'ADD_WISHLIST':
      icon = 'bi-heart-fill';
      iconClass = 'text-danger';
      break;
    case 'REMOVE_WISHLIST':
      icon = 'bi-heart';
      iconClass = 'text-secondary';
      break;
    case 'MATCH_SWAP':
      icon = 'bi-handshake';
      iconClass = 'text-success';
      break;
    case 'EARN_POINTS':
      icon = 'bi-coin';
      iconClass = 'text-warning';
      break;
    case 'UPDATE_PROFILE':
      icon = 'bi-person-check';
      iconClass = 'text-info';
      break;
    default:
      icon = 'bi-info-circle';
      iconClass = 'text-info';
  }

  return {
    message,
    icon,
    iconClass,
    time: getTimeAgo(activity.createdAt)
  };
}

/* --------------------- Routes --------------------- */
// Home
app.get('/', (req, res) => {
  const userLoggedIn = !!(req.session && req.session.user);
  if (userLoggedIn) {
    return res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  }
});

app.get('/home', (req, res) => res.redirect('/'));

// Working Chat Demo Route
app.get('/working-chat-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'working-chat-demo.html'));
});

// Master Chat System Demo Route
app.get('/chat-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat-system-demo.html'));
});

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
    if (!req.session || !req.session.user) {
        return res.redirect('/login?error=session');
    }
    
    try {
        const userLoggedIn = req.session && req.session.user;
        const userId = req.session.user._id || req.session.user.id;
        // 👇 prefer username for greeting if present
        const userName = req.session.user.username || req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User';
        const userPhoto = req.session.user.photo || null;
        
        // Verify user exists in database
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.redirect('/login?error=user_not_found');
        }
        
        // Fetch REAL dashboard data from database using the updated controller
        let dashboardData;
        try {
            dashboardData = await getDashboardData(userId);
        } catch (dbError) {
            console.error('Error fetching dashboard data:', dbError);
            // Fallback data if there's an error
            dashboardData = {
                userStats: { booksOwned: 0, swapsCompleted: 0, wishlistItems: 0, pendingSwaps: 0 },
                swapInsights: { successRate: 0, avgResponseTime: "No data", popularGenre: "Not specified" },
                nearbyBooks: [],
                trendingGenres: [],
                leaderboard: [],
                recentActivity: []
            };
        }
        
        // Dashboard data is now provided by the getDashboardData function
        
        res.render('dashboard', { 
            userLoggedIn, 
            activePage: 'dashboard',
            userName: userName,
            userPhoto: userPhoto,
            userStats: dashboardData.userStats,
            swapInsights: dashboardData.swapInsights,
            nearbyBooks: dashboardData.nearbyBooks,
            trendingGenres: dashboardData.trendingGenres,
            leaderboard: dashboardData.leaderboard,
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
            userName: req.session.user.username || req.session.user.name || req.session.user.fullname || 'User',
            userPhoto: req.session.user.photo || null,
            ...fallbackData,
            error: 'Unable to load dashboard data. Please try again.'
        });
    }
});

// Chat test page
app.get('/chat-test', (req, res) => {
    res.render('chat-test', { 
        title: 'Simple Chat System Test',
        userLoggedIn: true,
        activePage: 'chat-test'
    });
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
        const { getDashboardData } = require('./controllers/dashboardController');
        const dashboardData = await getDashboardData(userId);
        res.json(dashboardData.nearbyBooks);
    } catch (error) {
        console.error('API error fetching nearby books:', error);
        res.status(500).json({ error: 'Failed to fetch nearby books' });
    }
});

// API endpoint to get trending data
app.get('/api/dashboard/trending', async (req, res) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        const { getDashboardData } = require('./controllers/dashboardController');
        const dashboardData = await getDashboardData(userId);
        
        res.json({
            genres: dashboardData.trendingGenres,
            leaderboard: dashboardData.leaderboard
        });
    } catch (error) {
        console.error('API error fetching trending data:', error);
        res.status(500).json({ error: 'Failed to fetch trending data' });
    }
});

// API endpoint to get platform statistics (for landing page)
app.get('/api/platform/stats', async (req, res) => {
    try {
        console.log('🔢 Fetching real platform statistics...');
        
        const Swap = require('./models/Swap');
        const User = require('./models/User');
        
        // Get total completed swaps (Books Exchanged)
        const totalCompletedSwaps = await Swap.countDocuments({ 
            status: { $in: ['Completed', 'completed', 'Swapped'] }
        });
        
        // Get active swappers (users who have completed at least 1 swap)
        const activeSwappersCount = await Swap.distinct('requester', { 
            status: { $in: ['Completed', 'completed', 'Swapped'] }
        }).then(requesters => 
            Swap.distinct('owner', { 
                status: { $in: ['Completed', 'completed', 'Swapped'] }
            }).then(owners => {
                // Combine and deduplicate users
                const allSwappers = new Set([...requesters, ...owners]);
                return allSwappers.size;
            })
        );
        
        // Get total registered users for fallback
        const totalUsers = await User.countDocuments();
        
        // Calculate cities (placeholder - you can enhance this later)
        const citiesCovered = Math.min(Math.floor(activeSwappersCount * 0.3), 150);
        
        // Calculate satisfaction rate based on completed vs failed swaps
        const failedSwaps = await Swap.countDocuments({ 
            status: { $in: ['Declined', 'declined', 'Cancelled', 'cancelled'] }
        });
        const totalSwapRequests = await Swap.countDocuments();
        const satisfactionRate = totalSwapRequests > 0 
            ? Math.round(((totalCompletedSwaps / totalSwapRequests) * 100))
            : 98; // Default high satisfaction
        
        const stats = {
            booksExchanged: totalCompletedSwaps,
            activeSwappers: activeSwappersCount,
            citiesCovered: citiesCovered,
            satisfactionRate: Math.min(satisfactionRate, 98) // Cap at 98%
        };
        
        console.log('📈 Real platform stats:', stats);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ Platform stats error:', error);
        
        // Fallback to reasonable defaults if DB fails
        res.json({
            success: true,
            data: {
                booksExchanged: 150, // Conservative fallback
                activeSwappers: 85,   // Conservative fallback
                citiesCovered: 25,    // Conservative fallback
                satisfactionRate: 94  // Conservative fallback
            }
        });
    }
});

// API endpoint to search users
app.get('/api/users/search', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { q } = req.query;
        const User = require('./models/User');
        
        if (!q || q.trim().length < 2) {
            return res.json({ users: [] });
        }
        
        // Search users by name, username, or email
        const users = await User.find({
            $and: [
                { _id: { $ne: req.session.user._id } }, // Exclude current user
                {
                    $or: [
                        { name: { $regex: q, $options: 'i' } },
                        { username: { $regex: q, $options: 'i' } },
                        { email: { $regex: q, $options: 'i' } }
                    ]
                }
            ]
        })
        .select('name username email photo rewards stats createdAt')
        .limit(10)
        .lean();
        
        // Format user data for search results
        const searchResults = users.map(user => ({
            _id: user._id,
            name: user.name || user.email?.split('@')[0] || 'User',
            username: user.username || user.email?.split('@')[0] || 'Unknown',
            email: user.email,
            avatar: user.photo || '/images/default-avatar.png',
            points: user.rewards?.points || 0,
            badges: user.rewards?.badges?.length || 0,
            booksOwned: user.stats?.booksOwned || 0,
            joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'
        }));
        
        res.json({ users: searchResults });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// API endpoint to get user profile data
app.get('/api/user/profile/:userId', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { userId } = req.params;
        const User = require('./models/User');
        const Book = require('./models/Book');
        const Swap = require('./models/Swap');
        
        // Get user profile
        const user = await User.findById(userId)
            .select('name username email photo rewards stats createdAt preferences')
            .lean();
            
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's books
        const userBooks = await Book.find({ owner: userId })
            .select('title author genre condition image stats createdAt')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
            
        console.log(`Found ${userBooks.length} books for user ${userId}:`, userBooks.map(b => ({ title: b.title, author: b.author, createdAt: b.createdAt })));
            
               // Get user's swap stats
               const userSwaps = await Swap.find({
                   $or: [{ requester: userId }, { owner: userId }]
               });
               
               const completedSwaps = userSwaps.filter(swap => 
                   swap.status === 'completed' || swap.status === 'Completed'
               ).length;
               
               const pendingSwaps = userSwaps.filter(swap => 
                   ['pending', 'Pending', 'accepted', 'Accepted', 'in-progress', 'In Progress'].includes(swap.status)
               ).length;
               
               const totalSwaps = userSwaps.length;
               const successRate = totalSwaps > 0 ? Math.round((completedSwaps / totalSwaps) * 100) : 0;
               
               // Calculate real user statistics
               const booksOwned = userBooks.length;
               
               // Calculate activity score using the same system as leaderboard
               const activityScore = calculateUserActivityScore({
                   booksOwned,
                   completedSwaps,
                   pendingSwaps,
                   joinDate: user.createdAt,
                   existingPoints: user.rewards?.points || 0,
                   badges: user.rewards?.badges?.length || 0
               });
               
               const badgeCount = user.rewards?.badges?.length || 0;
               const level = Math.floor(activityScore / 100) + 1;
               const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        
        // Prepare profile data
        const profileData = {
            _id: user._id,
            displayName: user.name || user.username || user.email?.split('@')[0] || 'User',
            username: user.username || user.email?.split('@')[0] || 'Unknown',
            email: user.email,
            avatar: user.photo || '/images/default-avatar.png',
            joinDate: joinDate,
               level: level,
               totalPoints: activityScore,
            badgeCount: badgeCount,
            badges: user.rewards?.badges || [],
            stats: {
                booksOwned: userBooks.length,
                swapsCompleted: completedSwaps,
                totalSwaps: totalSwaps,
                successRate: successRate,
                booksViewed: user.stats?.booksViewed || 0,
                booksInterested: user.stats?.booksInterested || 0
            },
            recentBooks: userBooks.slice(0, 5),
            preferences: user.preferences || {}
        };
        
        res.json(profileData);
    } catch (error) {
        console.error('API error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

// User profile view route
app.get('/user/:userId', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    
    try {
        const { userId } = req.params;
        const User = require('./models/User');
        const Book = require('./models/Book');
        
        // Get user profile
        const user = await User.findById(userId)
            .select('username fullname email profileImage createdAt')
            .lean();
            
        if (!user) {
            return res.status(404).render('404', { message: 'User not found' });
        }
        
        // Get user's books
        const userBooks = await Book.find({ owner: userId })
            .select('title author genre condition imageUrl description')
            .lean();
        
        // Render user profile view
        res.render('user-profile', {
            activePage: 'user-profile',
            user: req.session.user,
            profileUser: user,
            books: userBooks,
            booksCount: userBooks.length
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).render('error', { message: 'Failed to load user profile' });
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

// API endpoint to get recent activity for profile page
app.get('/api/users/recent-activity', async (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        // Fetch recent activities
        const activities = await Activity.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('entityId', 'title author')
            .lean();

        console.log(`🔄 API: Found ${activities.length} activities for user ${userId}`);

        // Format activities for JSON response using the helper function
        const formattedActivities = activities.map(activity => {
            const formatted = formatActivity(activity);
            return {
                ...formatted,
                entityType: activity.entityType,
                entityId: activity.entityId
            };
        });

        res.json(formattedActivities);
        
    } catch (error) {
        console.error('Recent activity API error:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Login / Register / Logout
app.get('/login', (req, res) => {
    const error = req.query.error;
    const message = req.query.message;
    let errorMessage = '';
    
    if (error === 'invalid') {
        errorMessage = 'Invalid email/username or password. Please try again.'; // 👈 wording
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
        if (mongoose.connection.readyState === 1 && (req.session.user.id || req.session.user._id) && !String(req.session.user.id || req.session.user._id).startsWith('test-')) {
            try {
                const userIdForUpdate = req.session.user.id || req.session.user._id;
                const updateResult = await User.findByIdAndUpdate(
                    userIdForUpdate, 
                    { 
                        photo: photoPath,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
                
                if (updateResult) {
                    console.log('✅ Photo updated in database for user:', req.session.user.email);
                    
                    // Log activity for profile update
                    try {
                        await logActivity({
                            userId: userIdForUpdate,
                            action: 'UPDATE_PROFILE',
                            message: 'Updated profile photo',
                            entityType: 'User',
                            entityId: userIdForUpdate
                        });
                    } catch (activityError) {
                        console.error('Failed to log profile activity:', activityError);
                    }
                } else {
                    console.warn('⚠️ User not found in database:', userIdForUpdate);
                }
            } catch (dbError) {
                console.error('❌ Database update failed:', dbError.message);
                console.log('User ID:', req.session.user.id || req.session.user._id);
            }
        } else {
            console.log('📝 Photo updated in session only (test mode or no DB connection)');
            console.log('Connection state:', mongoose.connection.readyState);
            console.log('User ID:', req.session.user.id || req.session.user._id);
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
app.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login?error=session');

  try {
    const userId = req.session.user._id || req.session.user.id;
    const user = {
      fullname: req.session.user.fullname || req.session.user.name || req.session.user.username || 'User',
      email: req.session.user.email || 'user@example.com',
      profilePhoto: req.session.user.photo || '/images/default-avatar.png',
      bio: req.session.user.bio || '',
      username: req.session.user.username || ''
    };
    const userEmail = req.session.user.email || 'user@example.com';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png';
    const username = req.session.user.username || ''; // 👈 pass explicit username to template

    // Get real user data from database
    let userBooks = [];
    let recentActivity = [];
    let userStats = {
      booksOwned: 0,
      swapsCompleted: 0,
      wishlistCount: 0,
      joinedDays: 0,
      booksRead: 0,
      swapRating: 4.8,
      connections: 0
    };

    if (mongoose.connection.readyState === 1) {
      try {
        // Fetch user's books
        const books = await Book.find({ owner: userId }).sort({ createdAt: -1 }).limit(3);
        userBooks = books.map(book => ({
          title: book.title,
          image: book.image || '/images/book-placeholder.jpg'
        }));

        // Fetch recent activity using existing Activity model
        const activities = await Activity.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('entityId', 'title author')
          .lean();

        console.log(`📊 Profile: Found ${activities.length} activities for user ${userId}`);

        // Format activities for profile display using the helper function
        recentActivity = activities.map(activity => {
          const formatted = formatActivity(activity);
          console.log('📊 Formatted activity:', formatted);
          return {
            ...formatted,
            entityType: activity.entityType,
            entityId: activity.entityId
          };
        });

        console.log(`📊 Profile: Formatted ${recentActivity.length} activities`);

        // Calculate user statistics
        const allUserBooks = await Book.find({ owner: userId });
        const userSwaps = await Swap.find({
          $or: [{ requester: userId }, { owner: userId }]
        });

        userStats = {
          booksOwned: allUserBooks.length,
          swapsCompleted: userSwaps.filter(swap => swap.status === 'Completed').length,
          wishlistCount: Math.floor(allUserBooks.length * 0.3), // Estimate wishlist items
          joinedDays: Math.floor((Date.now() - new Date(req.session.user.createdAt || Date.now() - 30*24*60*60*1000)) / (24*60*60*1000)), // Days since joining
          booksRead: Math.floor(allUserBooks.length * 0.8), // Estimate
          swapRating: 4.8, // TODO: Calculate from ratings
          connections: Math.floor(userSwaps.length * 0.6) // Estimate unique connections
        };

      } catch (dbError) {
        console.error('Database error in profile:', dbError);
      }
    }

    // Only show fallback activity if NO real activities exist
    if (recentActivity.length === 0) {
      recentActivity = [
        {
          message: 'Welcome to BookSwap! Add your first book to get started.',
          icon: 'bi-heart',
          iconClass: 'text-primary', 
          time: 'Welcome!',
          entityType: null,
          entityId: null
        }
      ];
      console.log('📊 Profile: Using fallback welcome message');
    } else {
      console.log(`📊 Profile: Rendering ${recentActivity.length} real activities - NO fallback needed`);
    }

    res.render('profile', {
      user,
      userEmail,
      userPhoto,
      username, // 👈 make available to EJS
      userBooks,
      recentActivity,
      userStats,
      activePage: 'profile'
    });

  } catch (error) {
    console.error('Profile error:', error);
    
    // Fallback data
    const user = req.session.user.username ||
      req.session.user.name ||
      req.session.user.fullname ||
      req.session.user.email.split('@')[0] ||
      'User';
    const userEmail = req.session.user.email || 'user@example.com';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png';
    const username = req.session.user.username || '';

    res.render('profile', {
      user,
      userEmail,
      userPhoto,
      username,
      userBooks: [],
      recentActivity: [
        {
          message: 'Error loading activity. Please try again.',
          icon: 'bi-exclamation-triangle',
          iconClass: 'text-warning',
          time: 'Now',
          entityType: null,
          entityId: null
        }
      ],
      userStats: {
        booksOwned: 0,
        swapsCompleted: 0,
        booksRead: 0,
        swapRating: 0,
        connections: 0
      },
      activePage: 'profile',
      error: 'Unable to load profile data'
    });
  }
});

app.get('/profile', (req, res) => res.redirect('/me'));

// Redirect /add-book to library page where books can be added
app.get('/add-book', (req, res) => res.redirect('/library'));

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
        
        // Get user information for navbar
        const user = await User.findById(userId);
        const userLoggedIn = req.session && req.session.user;
        const userName = user?.username || user?.name || user?.fullname || user?.email?.split('@')[0] || 'User';
        const userPhoto = user?.profilePicture || '/images/default-avatar.png';
        
        // Render the professional book details page
        res.render('book-details', {
            book: book,
            userLoggedIn: userLoggedIn,
            userName: userName,
            userPhoto: userPhoto,
            activePage: 'library'
        });
        
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
            image: item.image || '/images/book-placeholder.jpg',
            priority: item.priority || 'Medium',
            notes: item.notes || '',
            dateAdded: item.dateAdded || new Date()
        }));
        
        // Calculate wishlist statistics
        const wishlistStats = {
            totalWishlist: wishlistBooks.length,
            highPriority: wishlistBooks.filter(book => book.priority === 'High').length,
            mediumPriority: wishlistBooks.filter(book => book.priority === 'Medium').length,
            lowPriority: wishlistBooks.filter(book => book.priority === 'Low').length
        };
        
        res.render('wishlist', { 
            userLoggedIn, 
            activePage: 'wishlist',
            userName: req.session.user.username || req.session.user.name || req.session.user.fullname || 'User',
            userPhoto: req.session.user.photo || null,
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
        const { title, author, image, priority, notes } = req.body;
        
        const user = await User.findById(req.session.user.id || req.session.user._id);
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
            image: image || '',
            priority: priority || 'Medium',
            notes: notes || '',
            dateAdded: new Date()
        });
        
        await user.save();

        // Log activity for adding to wishlist
        try {
            await logActivity({
                userId: user._id,
                action: 'WISHLIST_ADD',
                message: `Added "${title}" by ${author} to wishlist`,
                entityType: 'Wishlist',
                entityId: null
            });
        } catch (activityError) {
            console.error('Failed to log wishlist activity:', activityError);
        }
        
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
        const user = await User.findById(req.session.user.id || req.session.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.wishlist = user.wishlist.filter(book => String(book._id) !== String(req.params.bookId));
        await user.save();

        await logActivity({
          userId: user._id,
          action: 'REMOVE_WISHLIST',
          message: `Removed book from wishlist`,
          entityType: 'Wishlist',
          entityId: req.params.bookId || null
        });
        
        res.json({ success: true, message: 'Book removed from wishlist' });
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        res.status(500).json({ error: 'Failed to remove book from wishlist' });
    }
});

app.get('/swap-matcher', async (req, res) => {
  // Check authentication
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const userId = req.session.user._id || req.session.user.id;
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found in database:', userId);
      return res.redirect('/login');
    }

    // Create safe user object for template
    const safeUser = {
      _id: user._id,
      username: user.username,
      fullname: user.fullname,
      email: user.email,
      profilePicture: user.profilePicture,
      rewardPoints: user.rewardPoints || 0,
      totalSwapsCompleted: user.totalSwapsCompleted || 0,
      books: [] // Will be populated later
    };

    // Get user's own books (available for swapping) - exclude swapped books
    const userBooks = await Book.find({ 
        owner: userId, 
        availability: { $in: ['available', 'unavailable'] } // Include available and unavailable, but exclude swapped
    }).sort({ createdAt: -1 }).lean();

    // Enhance user books with Google Books images
    console.log(`Enhancing ${userBooks.length} user books with Google Books images...`);
    const enhancedUserBooks = await Promise.all(userBooks.map(async (book) => {
        try {
            console.log(`Processing user book: "${book.title}" by ${book.author}`);
            
            // If book already has a custom image, keep it
            if (book.image && !book.image.includes('placeholder') && !book.image.includes('default')) {
                console.log(`  ✅ Already has custom image: ${book.image}`);
                return book;
            }

            // Try to get image from Google Books API
            let imageUrl = null;
            
            // First try with ISBN if available
            if (book.isbn) {
                console.log(`  🔍 Searching by ISBN: ${book.isbn}`);
                imageUrl = await GoogleBooksHelper.getBookImageByISBN(book.isbn);
                if (imageUrl) {
                    console.log(`  ✅ Found image by ISBN: ${imageUrl}`);
                }
            }
            
            // If no image found with ISBN, try with title and author
            if (!imageUrl) {
                console.log(`  🔍 Searching by title/author: "${book.title}" by ${book.author}`);
                imageUrl = await GoogleBooksHelper.getBookImage(book.title, book.author);
                if (imageUrl) {
                    console.log(`  ✅ Found image by title/author: ${imageUrl}`);
                } else {
                    console.log(`  ❌ No image found for "${book.title}"`);
                }
            }

            // Return book with enhanced image
            const result = {
                ...book,
                image: imageUrl || book.image || '/images/placeholder-book.jpg',
                coverImage: imageUrl || book.coverImage || book.image || '/images/placeholder-book.jpg'
            };
            
            console.log(`  📸 Final image: ${result.image}`);
            return result;
        } catch (error) {
            console.error(`❌ Error enhancing user book ${book.title}:`, error);
            return book;
        }
    }));
    
    console.log(`✅ Completed enhancing user books with Google Books images`);

    // Add enhanced books to user object for template
    user.books = enhancedUserBooks;

    // Get available books for swapping (exclude user's own books)
    const availableBooks = await Book.find({ owner: { $ne: userId }, availability: 'available' })
    .populate('owner', 'username fullname')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

    // Add owner name to each book and ensure image field is properly set
    availableBooks.forEach(book => {
      book.ownerName = book.owner?.fullname || book.owner?.username || 'Unknown';
      // Ensure the image field is available for the frontend
      if (!book.coverImage && book.image) {
        book.coverImage = book.image;
      }
    });

    // Get user's swap activities with properly populated books
    // Fetch all swaps without a hard limit to ensure ALL completed/cancelled swaps are visible
    // Note: If performance becomes an issue with many swaps, consider implementing pagination
    const userSwaps = await Swap.find({
      $or: [
        { requester: userId },
        { owner: userId }
      ]
    })
    .populate('requester', 'username fullname profilePicture')
    .populate('owner', 'username fullname profilePicture')
    .populate('requestedBook.id', 'title author coverImage image')
    .populate('offeredBooks.id', 'title author coverImage image')
    .sort({ createdAt: -1 })
    .lean();

    // Flatten and fix book data for easier template access
    userSwaps.forEach(swap => {
      // Fix requested book
      if (swap.requestedBook?.id) {
        swap.requestedBook = {
          ...swap.requestedBook,
          title: swap.requestedBook.id.title || swap.requestedBook.title,
          author: swap.requestedBook.id.author || swap.requestedBook.author,
          coverImage: swap.requestedBook.id.coverImage || swap.requestedBook.id.image || '/images/placeholder-book.jpg'
        };
      }
      
      // Fix offered books - take the first one for display
      if (swap.offeredBooks && swap.offeredBooks.length > 0 && swap.offeredBooks[0].id) {
        swap.offeredBook = {
          title: swap.offeredBooks[0].id.title || swap.offeredBooks[0].title,
          author: swap.offeredBooks[0].id.author || swap.offeredBooks[0].author,
          coverImage: swap.offeredBooks[0].id.coverImage || swap.offeredBooks[0].id.image || '/images/placeholder-book.jpg'
        };
      } else {
        // Fallback if no offered books
        swap.offeredBook = {
          title: 'Unknown Book',
          author: 'Unknown Author',
          coverImage: '/images/placeholder-book.jpg'
        };
      }
    });

    // Calculate swap counts for tabs
    const myPendingRequests = userSwaps.filter(s => s.status === 'Pending' && (s.requester._id || s.requester).toString() === userId).length;
    const incomingRequests = userSwaps.filter(s => s.status === 'Pending' && (s.owner._id || s.owner).toString() === userId).length;
    const activeSwaps = userSwaps.filter(s => s.status === 'Accepted' || s.status === 'Pending Confirmation').length;

    // Get user stats
    const userStats = {
      rewardPoints: user.rewardPoints || 0,
      swapsCompleted: user.totalSwapsCompleted || 0,
      booksOwned: await Book.countDocuments({ owner: userId }),
      pendingSwaps: await Swap.countDocuments({
        $or: [
          { requester: userId, status: { $in: ['Pending', 'Accepted', 'Pending Confirmation'] } },
          { owner: userId, status: { $in: ['Pending', 'Accepted', 'Pending Confirmation'] } }
        ]
      })
    };

    // Calculate total and completed swaps for success rate
    const totalUserSwaps = await Swap.countDocuments({
      $or: [{ requester: userId }, { owner: userId }]
    });
    
    const completedUserSwaps = await Swap.countDocuments({
      $or: [{ requester: userId }, { owner: userId }],
      status: 'Swapped'
    });

    const swapInsights = {
      successRate: totalUserSwaps > 0 ? Math.round((completedUserSwaps / totalUserSwaps) * 100) : 0,
      avgResponseTime: '2.3 days',
      popularGenre: 'Fiction'
    };

    // Get nearby books (for demo purposes, just use available books with proper mapping)
    const nearbyBooks = availableBooks.slice(0, 5).map(book => ({
      ...book,
      image: book.coverImage || '/images/placeholder-book.jpg',
      id: book._id,
      distance: '2.5 km'
    }));

    // Get trending genres (for demo purposes)
    const trendingGenres = [
      { name: 'Fiction', swaps: 124, percentage: 85 },
      { name: 'Science Fiction', swaps: 98, percentage: 72 },
      { name: 'Romance', swaps: 76, percentage: 58 },
      { name: 'Mystery', swaps: 65, percentage: 48 },
      { name: 'Fantasy', swaps: 54, percentage: 42 }
    ];

    // Get trending books (for demo purposes)
    const trendingBooks = availableBooks.slice(0, 5).map((book, index) => ({
      title: book.title,
      author: book.author,
      image: book.coverImage || '/images/placeholder-book.jpg',
      swapCount: Math.floor(Math.random() * 50) + 10 // Random swap count between 10-60
    }));

    res.render('swap-matcher', { 
      userLoggedIn: true, 
      activePage: 'swap-matcher', 
      user, 
      userName: user.username || user.fullname || 'Reader',
      userPhoto: user.profilePicture || '/images/default-avatar.png',
      availableBooks,
      userSwaps,
      userStats,
      swapInsights,
      nearbyBooks,
      trendingGenres,
      trendingBooks,
      myPendingRequests,
      incomingRequests,
      activeSwaps,
      // Pass availableBooks as JSON for frontend use
      availableBooksJson: JSON.stringify(availableBooks)
    });

  } catch (error) {
    console.error('Swap matcher error:', error);
    // Redirect to login if there's an error - likely authentication issue
    res.redirect('/login');
  }
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
  
  const userLoggedIn = req.session && req.session.user;
  const userName = req.session.user.username || req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User';
  const userPhoto = req.session.user.photo || '/images/default-avatar.png';
  
  // Record visit activity for rewards
  logActivity({
    userId: req.session.user._id || req.session.user.id,
    action: 'UPDATE_PROFILE',
    message: 'Visited rewards page',
    meta: { page: 'rewards' }
  });
  
  res.render('rewards', {
    userLoggedIn,
    userName,
    userPhoto,
    activePage: 'rewards'
  });
});

app.get('/leaderboard', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  
  try {
    const userLoggedIn = req.session && req.session.user;
    const userName = req.session.user.username || req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png';
    const userId = req.session.user._id || req.session.user.id;
    
    // Get real leaderboard data using the same system as dashboard
    const { getDashboardData } = require('./controllers/dashboardController');
    const dashboardData = await getDashboardData(userId);
    
    // Get extended leaderboard data (top 10 instead of just top 3)
    const allUsers = await User.find({})
        .select('name email photo rewards stats createdAt')
        .lean();
    
    // Calculate real statistics for all users
    const usersWithStats = await Promise.all(allUsers.map(async (user) => {
        try {
            // Get user's books count
            const booksOwned = await Book.countDocuments({ 
                owner: user._id,
                availability: { $ne: 'Swapped' }
            });
            
            // Get user's swap statistics
            const userSwaps = await Swap.find({
                $or: [{ requester: user._id }, { owner: user._id }]
            });
            
            const completedSwaps = userSwaps.filter(swap => 
                swap.status === 'completed' || swap.status === 'Completed'
            ).length;
            
            const pendingSwaps = userSwaps.filter(swap => 
                ['pending', 'Pending', 'accepted', 'Accepted', 'in-progress', 'In Progress'].includes(swap.status)
            ).length;
            
            // Calculate activity score
            const activityScore = calculateUserActivityScore({
                booksOwned,
                completedSwaps,
                pendingSwaps,
                joinDate: user.createdAt,
                existingPoints: user.rewards?.points || 0,
                badges: user.rewards?.badges?.length || 0
            });
            
            const level = Math.floor(activityScore / 100) + 1;
            const isCurrentUser = user._id.toString() === userId.toString();
            
            return {
                _id: user._id,
                displayName: user.name || user.email?.split('@')[0] || 'User',
                username: user.email?.split('@')[0] || 'Unknown',
                email: user.email,
                totalPoints: activityScore,
                badgeCount: user.rewards?.badges?.length || 0,
                level: level,
                avatar: user.photo || '/images/default-avatar.png',
                joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
                isCurrentUser: isCurrentUser,
                booksOwned: booksOwned,
                completedSwaps: completedSwaps,
                pendingSwaps: pendingSwaps,
                totalSwaps: userSwaps.length,
                successRate: userSwaps.length > 0 ? Math.round((completedSwaps / userSwaps.length) * 100) : 0
            };
        } catch (error) {
            console.error(`Error calculating stats for user ${user._id}:`, error);
            return {
                _id: user._id,
                displayName: user.name || user.email?.split('@')[0] || 'User',
                username: user.email?.split('@')[0] || 'Unknown',
                email: user.email,
                totalPoints: user.rewards?.points || 0,
                badgeCount: user.rewards?.badges?.length || 0,
                level: 1,
                avatar: user.photo || '/images/default-avatar.png',
                joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
                isCurrentUser: user._id.toString() === userId.toString(),
                booksOwned: 0,
                completedSwaps: 0,
                pendingSwaps: 0,
                totalSwaps: 0,
                successRate: 0
            };
        }
    }));
    
    // Sort users by activity score (descending) and add ranks
    usersWithStats.sort((a, b) => b.totalPoints - a.totalPoints);
    const fullLeaderboard = usersWithStats.map((user, index) => ({
        ...user,
        rank: index + 1
    }));
    
    // Find current user's position
    const currentUserRank = fullLeaderboard.findIndex(user => user.isCurrentUser) + 1;
    const currentUser = fullLeaderboard.find(user => user.isCurrentUser);
    
    res.render('leaderboard', {
        userLoggedIn,
        userName,
        userPhoto,
        activePage: 'leaderboard',
        leaderboard: fullLeaderboard,
        currentUserRank: currentUserRank || 'Unranked',
        currentUser: currentUser || null,
        totalUsers: fullLeaderboard.length
    });
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    
    // Fallback to basic leaderboard if there's an error
    res.render('leaderboard', {
        userLoggedIn: req.session && req.session.user,
        userName: req.session.user.username || req.session.user.name || 'User',
        userPhoto: req.session.user.photo || '/images/default-avatar.png',
        activePage: 'leaderboard',
        leaderboard: [],
        currentUserRank: 'Unranked',
        currentUser: null,
        totalUsers: 0,
        error: 'Unable to load leaderboard data'
    });
  }
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

// ✅ Register (legacy endpoint) — add username support & lowercase
app.post('/register', async (req, res) => {
  const { fullname, email, password, location, username } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating registration");
      return res.redirect('/login?registered=true');
    }

    // Ensure email and username uniqueness
    const emailLc = (email || '').trim().toLowerCase();
    const usernameLc = (username || '').trim().toLowerCase();
    if (!usernameLc) {
      return res.status(400).send('Username is required');
    }
    const exists = await User.findOne({ $or: [{ email: emailLc }, { username: usernameLc }] });
    if (exists) {
      return res.status(400).send('Email or username already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ fullname, email: emailLc, username: usernameLc, password: hashedPassword, location });
    res.redirect('/login');
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send('Error registering user');
  }
});

// ✅ Login (legacy endpoint) — allow email OR username
app.post('/login', async (req, res) => {
  // Accept both "identifier" (new form) and "email" (older form)
  const identifierRaw = req.body.identifier || req.body.email;
  const { password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      // Simulated login when DB is down
      const simId = 'sim-' + Date.now();
      const idParsed = parseIdentifier(identifierRaw) || { by: 'email', query: {} };
      const fakeEmail = idParsed.by === 'email' ? identifierRaw : (identifierRaw + '@example.local');
      const fakeUsername = idParsed.by === 'username' ? identifierRaw.toLowerCase() : (fakeEmail.split('@')[0] || 'user');
      req.session.user = {
        _id: simId,           // normalize: include _id
        id: simId,
        email: fakeEmail,
        username: fakeUsername, // 👈 include username in session
        name: fakeUsername,
        fullname: fakeUsername.charAt(0).toUpperCase() + fakeUsername.slice(1),
        photo: '/images/default-avatar.png'
      };
      return req.session.save(() => res.redirect('/dashboard'));
    }

    // Real login
    const parsed = parseIdentifier(identifierRaw);
    if (!parsed) return res.redirect('/login?error=invalid');

    const user = await User.findOne(parsed.query);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=invalid');
    }

    req.session.user = {
      _id: user._id,         // normalize: include _id
      id: user._id,
      email: user.email,
      username: user.username, // 👈 keep in session
      name: user.fullname || user.username,
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
      req.session.user.username || // 👈 prefer username
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
      coverUrl,
      owner: user._id || user.id   // ✅ set owner for later DELETE authorization
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

const book = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
await logActivity({
  userId: req.session.user.id,
  action: 'UPDATE_BOOK',
  message: `Updated "${book1.title}" details`,
  entityType: 'Book',
  entityId: book._id
});

const book1 = await Book.findByIdAndDelete(req.params.id);
await logActivity({
  userId: req.session.user.id,
  action: 'DELETE_BOOK',
  message: `Removed "${book1.title}" from library`,
  entityType: 'Book',
  entityId: book._id
});

await logActivity({
  userId: req.session.user.id,
  action: 'ADD_WISHLIST',
  message: `Added "${req.body.title}" by ${req.body.author} to wishlist`,
  entityType: 'Book',
  entityId: req.body.bookId
});

await logActivity({
  userId: req.session.user.id,
  action: 'REMOVE_WISHLIST',
  message: `Removed book from wishlist`,
  entityType: 'Book',
  entityId: req.params.bookId
});

const swap = await Swap.create({ ...req.body, requester: req.session.user.id });
await logActivity({
  userId: req.session.user.id,
  action: 'MATCH_SWAP',
  message: `Requested swap for "${swap.bookTitle}" with ${swap.ownerName}`,
  entityType: 'Swap',
  entityId: swap._id
});

const swap1 = await Swap.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
await logActivity({
  userId: req.session.user.id,
  action: 'COMPLETE_SWAP',
  message: `Completed swap: "${swap1.bookTitle}" with ${swap1.otherUserName}`,
  entityType: 'Swap',
  entityId: swap._id
});

await logActivity({
  userId: req.session.user.id,
  action: 'UPDATE_PROFILE',
  message: `Updated profile photo`,
  entityType: 'User',
  entityId: req.session.user.id
});

    res.status(201).json({ ok: true, book: doc });
  } catch (err) {
    console.error('Create book error:', err);
    res.status(400).json({ ok: false, message: err?.message || 'Invalid data' });
  }
});

// ✅ NEW: explicit DELETE route so Recent Activity shows DELETE_BOOK
app.delete('/api/books/:id', async (req, res) => {
  try {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const userId = req.session.user._id || req.session.user.id;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid book id' });
    }
    const book = await Book.findOne({ _id: id, owner: userId });
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found or not yours' });
    }
    const title = book.title;
    await book.deleteOne();

    await logActivity({
      userId,
      action: 'DELETE_BOOK',
      message: `Removed "${title}" from library`,
      entityType: 'Book',
      entityId: id
    });

    return res.json({ success: true, message: 'Book removed successfully' });
  } catch (err) {
    console.error('DELETE /api/books/:id error:', err);
    return res.status(500).json({ success: false, message: 'Failed to remove book' });
  }
});

// API to list books (optional)
app.get('/api/books', async (req, res) => {
  const books = await Book.find().sort({ createdAt: -1 }).lean();
  res.json(books);
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {

  });
}

// Full history page (server-rendered shell + first page)
app.get('/history', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const userId = req.session.user._id || req.session.user.id;
    const PAGE_SIZE = 20;

    const raw = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean();

    const items = raw.map(a => ({
      ...formatActivity(a),
      action: a.action,
      createdAt: a.createdAt,
      entityType: a.entityType,
      entityId: a.entityId
    }));

    res.render('history', {
      userLoggedIn: true,
      activePage: 'history',
      items,
      nextPage: raw.length === PAGE_SIZE ? 2 : null  // client can request /api/users/history?page=2
    });
  } catch (err) {
    console.error('History page error:', err);
    res.status(500).send('Failed to load history');
  } 
});


app.get('/history', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const userId = req.session.user._id || req.session.user.id;
  const PAGE_SIZE = 20;
  const raw = await Activity.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean();
  const items = raw.map(a => ({
    message: a.message,
    time: new Date(a.createdAt).toLocaleString(),
    icon: 'bi-info-circle', // or map same as API
    iconClass: 'text-info'
  }));
  res.render('history', { userLoggedIn: true, activePage: 'history', items, nextPage: raw.length === PAGE_SIZE ? 2 : null });
});

// ---- Public routes/prefixes allowed without auth (define before guard) ----
const openPaths = [
  '/', '/home',
  '/login', '/register',
  '/auth/login', '/auth/register',
  '/login.html', '/register.html',
  '/test-login-error', '/logout',
  '/create-test-user', '/create-test-activity', '/debug-activities', // dev only; remove in prod
  '/api/dashboard/trending', // keep only if you want this public
  '/auth/check-username'
];

// Additional public prefixes for API routes
const openApiPrefixes = [
  /^\/api\/simple-message\//, // Allow all simple message API endpoints
  /^\/api\/enhanced-chat\//, // Allow enhanced chat API endpoints
  /^\/api\/auth-bypass\//, // Allow auth bypass endpoints
  /^\/api\/auth\/me$/, // Allow auth check endpoint
  /^\/chat-integration-test\.html$/ // Allow test page
];

// Use regexes for directories / assets
const openPrefixes = [
  /^\/css\//, /^\/js\//, /^\/images?\//, /^\/img\//, /^\/fonts?\//,
  /^\/uploads\//, /^\/public\//, /^\/favicon\.ico$/
];

app.use((req, res, next) => {
  const path = req.path;
  const isOpen =
    openPaths.includes(path) ||
    openPrefixes.some(rx => rx.test(path)) ||
    openApiPrefixes.some(rx => rx.test(path)); // Check API prefixes too

  if (!isOpen && (!req.session || !req.session.user)) {
    // don’t trap the user in a redirect loop
    if (path !== '/login') return res.redirect('/login');
  }
  next();
});

// Real-Time Chat Socket.IO Handling
io.on('connection', (socket) => {
  console.log(`🔌 New socket connection: ${socket.id}`);
  
  // Handle joining rooms
  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`👋 Socket ${socket.id} joined room ${roomId}`);
  });
  
  // Handle real-time message sending
  socket.on('sendMessage', async (data) => {
    try {
      const { roomId, message } = data;
      console.log('📨 Real-time message received:', message.content);
      
      // Broadcast to room (excluding sender)
      socket.to(roomId).emit('newMessage', message);
      
      console.log('✅ Message broadcasted to room:', roomId);
    } catch (error) {
      console.error('Error handling real-time message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Handle authentication for socket
  socket.on('authenticate', async (data) => {
    try {
      const { userId } = data;
      socket.authenticated = true;
      socket.userId = userId;
      console.log(`✅ Socket ${socket.id} authenticated for user ${userId}`);
      socket.emit('authenticated', { success: true });
    } catch (error) {
      console.error('Socket authentication failed:', error);
      socket.emit('authError', { message: 'Authentication failed' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}/dashboard`);
  console.log(`💬 Enhanced Chat System: ACTIVE`);
  console.log(`🔌 WebSocket Server: READY`);
});

module.exports = { app, server, io };