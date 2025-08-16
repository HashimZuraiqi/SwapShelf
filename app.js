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

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: { 
        secure: process.env.NODE_ENV === 'production' ? false : false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Middleware to prevent caching for all routes (helps with logout)
app.use((req, res, next) => {
    // Debug session info
    if (process.env.NODE_ENV !== 'production') {
        console.log('Session ID:', req.sessionID);
        console.log('Session User:', req.session?.user?.email);
    }
    
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
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
app.post('/profile/upload-photo', upload.single('profilePhoto'), (req, res) => {
    console.log('Profile photo upload attempt:', {
        sessionID: req.sessionID,
        hasSession: !!req.session,
        hasUser: !!(req.session && req.session.user),
        file: req.file ? 'File received' : 'No file'
    });
    
    if (!req.session || !req.session.user) {
        console.log('Profile upload: No session/user, returning unauthorized');
        return res.status(401).json({ success: false, error: 'Unauthorized - Please login again' });
    }

    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        // Update the session with the new photo path
        const photoPath = `/uploads/profiles/${req.file.filename}`;
        req.session.user.photo = photoPath;

        // In a real app, you would update the database here
        // await User.findByIdAndUpdate(req.session.user.id, { photo: photoPath });

        res.json({ 
            success: true, 
            message: 'Profile photo updated successfully',
            photoUrl: photoPath
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
    
    res.render('placeholder', { 
        userLoggedIn, 
        activePage: 'wishlist',
        user: user
    });
});

app.get('/swap-matcher', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    
    res.render('placeholder', { 
        userLoggedIn, 
        activePage: 'swap-matcher',
        user: user
    });
});

app.get('/nearby', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    const userLoggedIn = req.session && req.session.user;
    const user = req.session.user.name || req.session.user.fullname || req.session.user.email.split('@')[0] || 'User';
    res.render('placeholder', { 
        userLoggedIn, 
        activePage: 'nearby',
        user: user,
        pageTitle: 'Nearby',
        pageDescription: 'Connect with book lovers near you',
        pageIcon: 'bi bi-geo-alt'
    });
});

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
    console.log('User logged out');
    
    // Clear session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/dashboard');
        }
        
        // Clear cookie
        res.clearCookie('connect.sid');
        
        // Set headers to prevent caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        // Redirect to login page instead of home to make logout clear
        res.redirect('/login?message=You have been successfully logged out');
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
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️ MongoDB not connected - simulating login");
      console.log(`✅ Would login user: ${email}`);
      
      // Allow test login with any email and password for testing
      req.session.user = {
        email: email,
        name: email.split('@')[0],
        fullname: email.split('@')[0]
      };
      console.log('Session set for user:', req.session.user);
      res.redirect('/dashboard');
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
      fullname: user.fullname
    };

    console.log("✅ Login successful:", email);
    res.redirect('/dashboard');
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
