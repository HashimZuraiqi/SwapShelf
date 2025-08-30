require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');

const User = require('./models/User'); //Mongoose User model

const app = express();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'uploads', 'profiles');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename using user email and timestamp
        const userEmail = req.session.user ? req.session.user.email : 'unknown';
        const fileExt = path.extname(file.originalname);
        const fileName = `${userEmail.replace('@', '_at_')}_${Date.now()}${fileExt}`;
        cb(null, fileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Only allow image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => {
    console.warn('⚠️ MongoDB Connection Failed - Running without database');
    console.warn('Registration and login will be temporarily disabled');
    // Don't exit the process, just log the warning
  });

// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session middleware with proper cookie configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    name: 'bookswap.sid', // Custom session name
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'lax', // Important for cross-site requests
        path: '/' // Ensure cookie is sent for all paths
    }
}));

// Enhanced session debugging middleware
app.use((req, res, next) => {
    // Debug session info for development
    if (process.env.NODE_ENV !== 'production') {
        console.log(`${req.method} ${req.path}:`, {
            sessionID: req.sessionID,
            hasSession: !!req.session,
            hasUser: !!(req.session && req.session.user),
            userEmail: req.session?.user?.email,
            cookies: req.headers.cookie ? 'Present' : 'Missing'
        });
    }
    
    // Prevent caching for protected routes
    if (req.path.startsWith('/dashboard') || 
        req.path.startsWith('/me') || 
        req.path.startsWith('/library') ||
        req.path.startsWith('/wishlist') ||
        req.path.startsWith('/profile')) {
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
    }
    
    next();
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Sample trending books data
const sampleTrendingBooks = [
    {
        title: "The Seven Husbands of Evelyn Hugo",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1618329605i/32620332.jpg"
    },
    {
        title: "Where the Crawdads Sing",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1582135294i/36809135.jpg"
    },
    {
        title: "The Silent Patient",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1582143772i/40097951.jpg"
    },
    {
        title: "Educated",
        image: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1506026635i/35133922.jpg"
    }
];

// GET Routes
app.get('/', (req, res) => {
    const userLoggedIn = req.session && req.session.user;
    
    if (userLoggedIn) {
        // For logged-in users, render the dynamic EJS template with logged-in navigation
        res.render('home', { userLoggedIn: true, activePage: 'home' });
    } else {
        // For guests, serve the static HTML file with normal navigation
        res.sendFile(path.join(__dirname, 'public', 'landing.html'));
    }
});

// Redirect /home to root path for consistency
app.get('/home', (req, res) => {
    res.redirect('/');
});

app.get('/dashboard', (req, res) => {
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
    
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email?.split('@')[0] || 'User';
    
    console.log('Dashboard - Session user:', req.session.user);
    console.log('Dashboard - Resolved user name:', user);
    
    res.render('dashboard', { 
        userLoggedIn, 
        activePage: 'dashboard',
        user: user,
        trendingBooks: sampleTrendingBooks
    });
});

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
    res.render('login', { errorMessage });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
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

app.get('/me', (req, res) => {
    console.log('Profile access attempt:', {
        sessionID: req.sessionID,
        session: req.session,
        hasUser: !!(req.session && req.session.user),
        cookies: req.headers.cookie
    });
    
    // Check if user is logged in
    if (!req.session || !req.session.user) {
        console.log('Profile: No session/user, redirecting to login');
        return res.redirect('/login?error=session');
    }

    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    const userEmail = req.session.user.email || 'user@example.com';
    const userPhoto = req.session.user.photo || '/images/default-avatar.png'; // Use uploaded photo or default
    
    // Mock user books data
    const userBooks = [
        { title: 'The Great Gatsby', image: '/images/book1.jpg' },
        { title: '1984', image: '/images/book2.jpg' },
        { title: 'To Kill a Mockingbird', image: '/images/book3.jpg' }
    ];

    console.log('Rendering profile with session data:', { user, userEmail });
    res.render('profile', {
        user: user,
        userEmail: userEmail,
        userPhoto: userPhoto,
        userBooks: userBooks,
        activePage: 'profile'
    });
});

// Redirect old profile route to new one for consistency
app.get('/profile', (req, res) => {
    res.redirect('/me');
});

// Library page - user's personal book collection
app.get('/library', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    
    // TODO: Fetch user's actual books from database
    const books = []; // Placeholder for user's book collection
    
    res.render('library', { 
        userLoggedIn, 
        activePage: 'library',
        user: user,
        books: books
    });
});

app.get('/wishlist', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    
    // TODO: Fetch user's actual wishlist from database
    const wishlistBooks = []; // Placeholder for user's wishlist
    
    res.render('wishlist', { 
        userLoggedIn, 
        activePage: 'wishlist',
        user: user,
        wishlistBooks: wishlistBooks
    });
});

app.get('/swap-matcher', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    
    res.render('swap-matcher', { 
        userLoggedIn, 
        activePage: 'swap-matcher',
        user: user
    });
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
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    res.render('placeholder', { 
        userLoggedIn, 
        activePage: 'rewards',
        user: user,
        pageTitle: 'Rewards',
        pageDescription: 'Earn points and unlock achievements',
        pageIcon: 'bi bi-trophy'
    });
});

// Test route for login error
app.get('/test-login-error', (req, res) => {
    res.redirect('/login?error=invalid');
});

app.get('/logout', (req, res) => {
    console.log('User logging out:', req.session?.user?.email);
    
    // Clear session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/dashboard');
        }
        
        // Clear the session cookie with the correct name
        res.clearCookie('bookswap.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        
        // Set headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        console.log('✅ User logged out successfully');
        res.redirect('/login?message=You have been successfully logged out');
    });
});

// Test route to check session status
app.get('/test-session', (req, res) => {
    res.json({
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        user: req.session?.user || null,
        cookies: req.headers.cookie
    });
});

// POST Routes - Authentication
app.post('/register', async (req, res) => {
  const { fullname, email, password, location } = req.body;

  try {
    console.log("📩 Registration data:", req.body);

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating registration");
      console.log(`✅ Would register user: ${fullname} (${email}) from ${location}`);
      res.redirect('/login?registered=true');
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      fullname,
      email,
      password: hashedPassword,
      location
    });

    console.log("User registered successfully!");
    res.redirect('/login');
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log("🔐 Login attempt:", email);

    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating login");
      console.log(`✅ Would login user: ${email}`);
      
      // Set session for test login
      req.session.user = {
        id: 'test-' + Date.now(),
        email: email,
        name: email.split('@')[0],
        fullname: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
        photo: '/images/default-avatar.png'
      };

      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/login?error=session');
        }
        console.log('✅ Session saved successfully:', req.session.user);
        res.redirect('/dashboard');
      });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/login?error=invalid');
    }

    // Set session for real login
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.fullname,
      fullname: user.fullname,
      photo: user.photo || '/images/default-avatar.png'
    };

    // Save session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/login?error=session');
      }
      console.log("✅ Login successful:", email);
      res.redirect('/dashboard');
    });

  } catch (err) {
    console.error("Login error:", err);
    res.redirect('/login?error=server');
  }
});

// Start Server
if (process.env.NODE_ENV !== 'production') {
    app.listen(3000, () => {
        console.log('Server is running at http://localhost:3000');
        console.log('Dashboard available at: http://localhost:3000/dashboard');
    });
}

// Export for Vercel
module.exports = app;
