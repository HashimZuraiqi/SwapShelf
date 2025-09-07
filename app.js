require('dotenv').config();

const express = require('express');
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

const app = express();

/* ---------------------- Upload (profile photos) ---------------------- */
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
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed!'), false)
});

/* --------------------------- DB connect --------------------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(() => {
    console.warn('⚠️ MongoDB Connection Failed - Running without database');
    console.warn('Registration and login will be temporarily disabled');
  });

/* --------------------------- App setup --------------------------- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(
  session({
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
  })
);

// Debug + no-cache for protected pages
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`${req.method} ${req.path}:`, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!(req.session && req.session.user),
      userEmail: req.session?.user?.email
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
      Pragma: 'no-cache',
      Expires: '0'
    });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Make username available to all EJS views (for badges/displays)
app.use((req, res, next) => {
  res.locals.username = req.session?.user?.username || null;
  next();
});

/* --------------------------- Routers --------------------------- */
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const swapRoutes = require('./routes/swaps');
const userRoutes = require('./routes/users');

// Mount once
app.use('/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/swaps', swapRoutes);
app.use('/api/users', userRoutes);

app.get('/login.html', (req, res) => res.redirect(301, '/auth/login'));
app.get('/register.html', (req, res) => res.redirect(301, '/auth/register'));

// Legacy route for book addition (redirect to API)
app.post('/books/add', (req, res) => {
  res.redirect(307, '/api/books');
});

/* --------------------------- Test helpers --------------------------- */
// Quick test route to create a test user (REMOVE IN PRODUCTION)
app.get('/create-test-user', async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: 'test@gmail.com' });
    if (existingUser) {
      return res.json({
        message: 'Test user already exists. You can login with test@gmail.com / password123'
      });
    }

    const hashedPassword = await bcrypt.hash('password123', 12);

    const testUser = new User({
      fullname: 'Test User',
      email: 'test@gmail.com',
      username: 'testuser',
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

// Test route to create sample activity data
app.get('/create-test-activity', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Please login first at /login' });
  }

  try {
    const userId = req.session.user._id || req.session.user.id;

    await Activity.deleteMany({ user: userId });

    const sampleActivities = [
      {
        user: userId,
        action: 'ADD_BOOK',
        message: 'Added "The Great Gatsby" by F. Scott Fitzgerald to library',
        entityType: 'Book',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        user: userId,
        action: 'ADD_WISHLIST',
        message: 'Added "To Kill a Mockingbird" by Harper Lee to wishlist',
        entityType: 'Wishlist',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      },
      {
        user: userId,
        action: 'UPDATE_PROFILE',
        message: 'Updated profile photo',
        entityType: 'User',
        entityId: userId,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        user: userId,
        action: 'ADD_BOOK',
        message: 'Added "1984" by George Orwell to library',
        entityType: 'Book',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
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
      allActivities: allActivities.slice(0, 10)
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/* --------------------------- Helpers --------------------------- */
async function logActivity({
  userId,
  action,
  message,
  entityType = null,
  entityId = null,
  meta = {}
}) {
  try {
    const aliasMap = {
      WISHLIST_ADD: 'ADD_WISHLIST',
      PROFILE_UPDATE: 'UPDATE_PROFILE',
      SWAP_COMPLETED: 'COMPLETE_SWAP'
    };
    const normalized = (action || '').toUpperCase();
    const finalAction = aliasMap[normalized] || normalized;
    await Activity.create({
      user: userId,
      action: finalAction,
      message,
      entityType,
      entityId,
      meta
    });
  } catch (err) {
    console.error('Activity log failed:', err.message);
  }
}

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

/* --------------------------- Routes --------------------------- */
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

/* --------------------------- Dashboard --------------------------- */
app.get('/dashboard', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login?error=session');
  }

  try {
    const userLoggedIn = req.session && req.session.user;
    const userId = req.session.user._id || req.session.user.id;
    const userName =
      req.session.user.name ||
      req.session.user.fullname ||
      req.session.user.email?.split('@')[0] ||
      'User';
    const userPhoto = req.session.user.photo || null;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.redirect('/login?error=user_not_found');
    }

    let dashboardData = {
      userStats: { booksOwned: 0, swapsCompleted: 0, wishlistItems: 0, pendingSwaps: 0 },
      swapInsights: { successRate: 0, avgResponseTime: 'No data', popularGenre: 'Not specified' },
      nearbyBooks: [],
      trendingGenres: [],
      trendingBooks: [],
      recentActivity: []
    };

    try {
      const userBooks = await Book.find({ owner: userId });
      const userSwaps = await Swap.find({
        $or: [{ requester: userId }, { owner: userId }]
      });
      const userData = await User.findById(userId);

      dashboardData.userStats = {
        booksOwned: userBooks.length,
        swapsCompleted: userSwaps.filter((swap) => swap.status === 'Completed').length,
        wishlistItems: userData ? userData.wishlist.length : 0,
        pendingSwaps: userSwaps.filter((swap) => swap.status === 'Pending').length
      };

      const nearbyBooks = await Book.find({
        owner: { $ne: userId },
        availability: 'available'
      })
        .limit(6)
        .populate('owner', 'name location fullname');

      dashboardData.nearbyBooks = nearbyBooks.map((book) => ({
        id: book._id,
        title: book.title,
        author: book.author,
        image: book.image || '/images/book-placeholder.jpg',
        ownerName: (book.owner && (book.owner.name || book.owner.fullname)) || 'Unknown',
        distance: '2.5 km'
      }));

      const activities = await Activity.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('entityId', 'title author')
        .lean();

      dashboardData.recentActivity = activities.map((activity) => ({
        ...formatActivity(activity)
      }));
    } catch (dbError) {
      console.error('Error fetching dashboard data:', dbError);
    }

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

    const fallbackData = {
      userStats: {
        booksOwned: 0,
        swapsCompleted: 0,
        wishlistItems: 0,
        pendingSwaps: 0
      },
      swapInsights: {
        successRate: 0,
        avgResponseTime: 'No data',
        popularGenre: 'Not specified'
      },
      nearbyBooks: [],
      trendingGenres: [],
      trendingBooks: []
    };

    res.render('dashboard', {
      userLoggedIn: true,
      activePage: 'dashboard',
      userName:
        req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User',
      userPhoto: req.session.user.photo || null,
      ...fallbackData,
      error: 'Unable to load dashboard data. Please try again.'
    });
  }
});

/* ------------------- Dashboard AJAX Endpoints ------------------- */
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

app.get('/api/dashboard/trending', async (req, res) => {
  try {
    const { getTrendingGenres, getTrendingBooks } = require('./helpers/dashboardHelper');
    const [trendingGenres, trendingBooks] = await Promise.all([getTrendingGenres(), getTrendingBooks()]);

    res.json({
      genres: trendingGenres,
      books: trendingBooks
    });
  } catch (error) {
    console.error('API error fetching trending data:', error);
    res.status(500).json({ error: 'Failed to fetch trending data' });
  }
});

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

/* ---------------- Recent activity for profile page ---------------- */
app.get('/api/users/recent-activity', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = req.session.user._id || req.session.user.id;

    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('entityId', 'title author')
      .lean();

    console.log(`🔄 API: Found ${activities.length} activities for user ${userId}`);

    const formattedActivities = activities.map((activity) => {
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

/* ----------------------- Login/Register Pages ----------------------- */
app.get('/login', (req, res) => {
  const err = req.query.error;
  const message = req.query.message;

  let errorMessage = '';
  if (err === 'invalid') {
    errorMessage = 'Invalid email or password. Please try again.';
  } else if (err === 'server') {
    errorMessage = 'Server error. Please try again later.';
  } else if (message) {
    errorMessage = message;
  }

  // ✅ this must be inside the function
  const successMessage = req.query.success || null;

  res.render('login', {
    errorMessage,
    error: errorMessage,          // kept for backwards compatibility
    successMessage,               // <-- fixes login.ejs ReferenceError
    email: req.query.email || ''
  });
});

app.get('/register', (req, res) => {
  res.render('register', {
    error: req.query.error || '',
    name: req.query.name || '',
    email: req.query.email || ''
  });
});

/* ----------------------- Profile (views) ----------------------- */
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

    req.session.user.photo = photoPath;

    if (
      mongoose.connection.readyState === 1 &&
      (req.session.user.id || req.session.user._id) &&
      !String(req.session.user.id || req.session.user._id).startsWith('test-')
    ) {
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

app.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login?error=session');

  try {
    const userId = req.session.user._id || req.session.user.id;
    const user =
      req.session.user.name ||
      req.session.user.fullname ||
      req.session.user.email.split('@')[0] ||
      'User';
    const userEmail = req.session.user.email || 'user@example.com';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png';

    let userBooks = [];
    let recentActivity = [];
    let userStats = {
      booksOwned: 0,
      swapsCompleted: 0,
      booksRead: 0,
      swapRating: 4.8,
      connections: 0
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const books = await Book.find({ owner: userId }).sort({ createdAt: -1 }).limit(3);
        userBooks = books.map((book) => ({
          title: book.title,
          image: book.image || '/images/book-placeholder.jpg'
        }));

        const activities = await Activity.find({ user: userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('entityId', 'title author')
          .lean();

        console.log(`📊 Profile: Found ${activities.length} activities for user ${userId}`);

        recentActivity = activities.map((activity) => {
          const formatted = formatActivity(activity);
          return {
            ...formatted,
            entityType: activity.entityType,
            entityId: activity.entityId
          };
        });

        console.log(`📊 Profile: Formatted ${recentActivity.length} activities`);

        const allUserBooks = await Book.find({ owner: userId });
        const userSwaps = await Swap.find({
          $or: [{ requester: userId }, { owner: userId }]
        });

        userStats = {
          booksOwned: allUserBooks.length,
          swapsCompleted: userSwaps.filter((swap) => swap.status === 'Completed').length,
          booksRead: Math.floor(allUserBooks.length * 0.8),
          swapRating: 4.8,
          connections: Math.floor(userSwaps.length * 0.6)
        };
      } catch (dbError) {
        console.error('Database error in profile:', dbError);
      }
    }

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
      userBooks,
      recentActivity,
      userStats,
      activePage: 'profile'
    });
  } catch (error) {
    console.error('Profile error:', error);

    const user =
      req.session.user.name ||
      req.session.user.fullname ||
      req.session.user.email.split('@')[0] ||
      'User';
    const userEmail = req.session.user.email || 'user@example.com';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png';

    res.render('profile', {
      user,
      userEmail,
      userPhoto,
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

/* --------------------------- Library --------------------------- */
app.get('/add-book', (req, res) => res.redirect('/library'));

app.get('/library', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  const userLoggedIn = req.session && req.session.user;

  try {
    const userId = req.session.user._id || req.session.user.id;

    const userBooks = await Book.find({ owner: userId }).sort({ createdAt: -1 });

    console.log(`Found ${userBooks.length} real books for user ${userId}`);

    const libraryStats = {
      totalBooks: userBooks.length,
      availableBooks: userBooks.filter((book) => book.availability === 'available').length,
      uniqueAuthors: [...new Set(userBooks.map((book) => book.author))].length,
      completedSwaps: await Swap.countDocuments({
        $or: [{ requester: userId }, { owner: userId }],
        status: 'Completed'
      })
    };

    const formattedBooks = userBooks.map((book) => ({
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
      books: formattedBooks,
      userBooks: formattedBooks,
      libraryStats: libraryStats
    });
  } catch (error) {
    console.error('Library error:', error);
    res.render('library', {
      userLoggedIn,
      activePage: 'library',
      books: [],
      userBooks: [],
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

/* ---------------------- Book details + CRUD ---------------------- */
app.get('/books/:bookId', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }

  try {
    const { bookId } = req.params;
    const userId = req.session.user._id || req.session.user.id;
    const book = await Book.findOne({ _id: bookId, owner: userId });

    if (!book) {
      return res.status(404).send('Book not found or you do not have permission to view it.');
    }

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
                      <p><strong>Availability:</strong> ${
                        book.availability === 'available' ? 'Available for swap' : 'Not available'
                      }</p>
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

// Create book (cleaned: removed stray crashing code)
app.post('/books', async (req, res) => {
  try {
    const user = req.session?.user || null;
    if (!user) return res.status(401).json({ ok: false, message: 'Unauthorized' });

    const { title, author, genre, language, year, isbn, publisher, condition, cover } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, message: 'Title is required' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, message: 'Database not connected' });
    }

    const coverUrl = typeof cover === 'string' && cover.trim() ? cover.trim() : undefined;

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
      owner: user._id || user.id
    });

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

// Delete book
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

/* --------------------------- Rewards & misc --------------------------- */
app.get('/swap-matcher', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  res.render('placeholder', { userLoggedIn: true, activePage: 'swap-matcher', user });
});

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

// Logout (GET for your current UI)
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.redirect('/dashboard');
    res.clearCookie('bookswap.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
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

/* --------------------------- Auth fallbacks --------------------------- */
// Minimal fallback register/login (your main ones live in /routes/auth)
app.post('/register', async (req, res) => {
  const { fullname, email, password, location, username } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ MongoDB not connected - simulating registration');
      return res.redirect('/login?registered=true');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      fullname,
      email: email.toLowerCase(),
      username: (username || fullname || email).toLowerCase().replace(/\W+/g, ''),
      password: hashedPassword,
      location
    });
    res.redirect('/login');
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    if (mongoose.connection.readyState !== 1) {
      // Simulated login when DB is down
      const simId = 'sim-' + Date.now();
      const base = (email || 'user@example.com').split('@')[0];
      req.session.user = {
        _id: simId,
        id: simId,
        email,
        name: base,
        fullname: base.charAt(0).toUpperCase() + base.slice(1),
        photo: '/images/default-avatar.png',
        // ✅ provide a username in session for views relying on it
        username: base
      };
      return req.session.save(() => res.redirect('/dashboard'));
    }

    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=invalid');
    }

    // Real login
    req.session.user = {
      _id: user._id,
      id: user._id,
      email: user.email,
      name: user.fullname,
      fullname: user.fullname,
      photo: user.photo || '/images/default-avatar.png',
      // ✅ include username from DB if present
      username: user.username || null
    };
    req.session.save(() => res.redirect('/dashboard'));
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/login?error=server');
  }
});

/* --------------------------- History page --------------------------- */
app.get('/history', async (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');

  try {
    const userId = req.session.user._id || req.session.user.id;
    const PAGE_SIZE = 20;

    const raw = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE)
      .lean();

    const items = raw.map((a) => ({
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
      nextPage: raw.length === PAGE_SIZE ? 2 : null
    });
  } catch (err) {
    console.error('History page error:', err);
    res.status(500).send('Failed to load history');
  }
});

/* --------------------------- Auth guard --------------------------- */
const openPaths = [
  '/',
  '/home',
  '/login',
  '/register',
  '/auth/login',
  '/auth/register',
  '/login.html',
  '/register.html',
  '/test-login-error',
  '/logout',
  '/create-test-user',
  '/create-test-activity',
  '/debug-activities',
  '/api/dashboard/trending',
  // ✅ allow unauthenticated username availability checks
  '/auth/check-username'
];

const openPrefixes = [
  /^\/css\//,
  /^\/js\//,
  /^\/images?\//,
  /^\/img\//,
  /^\/fonts?\//,
  /^\/uploads\//,
  /^\/public\//,
  /^\/favicon\.ico$/
];

app.use((req, res, next) => {
  const p = req.path;
  const isOpen = openPaths.includes(p) || openPrefixes.some((rx) => rx.test(p));
  if (!req.session || !req.session.user) {
    if (!isOpen && p !== '/login') return res.redirect('/login');
  }
  next();
});

/* --------------------------- Boot --------------------------- */
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Server is running at http://localhost:3000');
    console.log('Dashboard available at: http://localhost:3000/dashboard');
  });
}

module.exports = app;
