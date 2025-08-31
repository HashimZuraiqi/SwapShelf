require('dotenv').config();

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');

const Activity = require('./models/Activity');
const Book = require('./models/Books');     
const User = require('./models/User');

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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

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

// Dashboard (loads recent activities)
app.get('/dashboard', async (req, res) => {
  try {
    const user = req.session?.user || null;
    if (!user) return res.redirect('/login?error=session');

    const userId = user._id || user.id; // <— normalize
    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const displayName =
      user.name || user.fullname || (user.email ? user.email.split('@')[0] : 'User');

    res.render('dashboard', {
      activePage: 'dashboard',
      activities,
      user: displayName,
      trendingBooks: sampleTrendingBooks
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to load dashboard');
  }
});

// Login / Register / Logout
app.get('/login', (req, res) => {
  const error = req.query.error;
  const message = req.query.message;
  let errorMessage = '';

  if (error === 'invalid') errorMessage = 'Invalid email or password. Please try again.';
  else if (error === 'server') errorMessage = 'Server error. Please try again later.';
  else if (message) errorMessage = message;

  res.render('login', { errorMessage });
});

app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));

// Profile photo upload
app.post('/profile/upload-photo', upload.single('profilePhoto'), (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized - Please login again' });
  }
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const photoPath = `/uploads/profiles/${req.file.filename}`;
    req.session.user.photo = photoPath;
    res.json({ success: true, message: 'Profile photo updated successfully', photoUrl: photoPath });
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

// Wishlist / Swap / Nearby / Rewards placeholders
app.get('/wishlist', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  res.render('placeholder', { userLoggedIn: true, activePage: 'wishlist', user });
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

app.get('/nearby', (req, res) => {
  if (!req.session || !req.session.user) return res.redirect('/login');
  const user =
    req.session.user.name ||
    req.session.user.fullname ||
    req.session.user.email.split('@')[0] ||
    'User';
  res.render('placeholder', {
    userLoggedIn: true,
    activePage: 'nearby',
    user,
    pageTitle: 'Nearby',
    pageDescription: 'Connect with book lovers near you',
    pageIcon: 'bi bi-geo-alt'
  });
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
