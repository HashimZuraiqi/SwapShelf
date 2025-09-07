const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

/* -------------------- Page routes (render EJS views) -------------------- */

// Login page
router.get('/login', requireGuest, (req, res) => {
  // Support ?success=... (green) and ?error=... (red) messages in the UI
  res.render('login', {
    errorMessage: req.query.error || null,
    successMessage: req.query.success || null,
    email: ''
  });
});

// Register page
router.get('/register', requireGuest, (req, res) => {
  res.render('register', { error: null, name: '', email: '', username: '' });
});

// (Optional aliases if someone hits these under /auth)
router.get('/login.html', (req, res) => res.redirect(301, '/auth/login'));
router.get('/register.html', (req, res) => res.redirect(301, '/auth/register'));

/* ----------------------------- Diagnostics ------------------------------ */

router.get('/test', (req, res) => {
  res.json({ message: 'Auth router is working!' });
});

/* ------------------ Username availability (live check) ------------------ */
// GET /auth/check-username?username=foo
router.get('/check-username', requireGuest, async (req, res) => {
  try {
    const raw = (req.query.username || '').trim();
    const username = raw.toLowerCase(); // normalize for case-insensitive uniqueness
    if (username.length < 3 || !/^[a-zA-Z0-9_.]{3,30}$/.test(raw)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    const exists = await User.exists({ username });
    return res.json({ available: !exists });
  } catch (err) {
    console.error('Username check error:', err);
    return res.status(500).json({ available: false });
  }
});

/* -------------------------------- Register ------------------------------ */

router.post('/register', requireGuest, async (req, res) => {
  try {
    const { name, email, username, password, confirmPassword, location } = req.body;

    // Basic presence checks
    if (!name || !email || !username || !password) {
      return res.render('register', {
        error: 'Name, email, username, and password are required',
        name: name || '',
        email: email || '',
        username: username || ''
      });
    }

    // Username format
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) {
      return res.render('register', {
        error: 'Username must be 3–30 chars using letters, numbers, underscores, or dots.',
        name,
        email,
        username
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        error: 'Passwords do not match',
        name: name || '',
        email: email || '',
        username: username || ''
      });
    }

    const emailLower = (email || '').toLowerCase().trim();
    const usernameLower = (username || '').toLowerCase().trim();

    // Uniqueness checks (email or username)
    const existingUser = await User.findOne({
      $or: [{ email: emailLower }, { username: usernameLower }]
    });

    if (existingUser) {
      const msg =
        existingUser.email?.toLowerCase() === emailLower
          ? 'User with this email already exists'
          : 'Username already taken';
      return res.render('register', {
        error: msg,
        name,
        email,
        username
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      fullname: name.trim(),                // map form "name" -> schema "fullname"
      email: emailLower,
      username: usernameLower,
      password: hashedPassword,
      ...(location ? { location } : {})
    });

    const savedUser = await newUser.save();

    // Store both fullname and name in session for templates that expect either
    req.session.user = {
      _id: savedUser._id,
      id: savedUser._id,
      email: savedUser.email,
      fullname: savedUser.fullname,
      name: savedUser.fullname,
      username: savedUser.username,
      photo: savedUser.photo
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    // Nice duplicate key handling (optional)
    const errMsg =
      error && error.code === 11000
        ? (error.keyPattern?.email
            ? 'User with this email already exists'
            : error.keyPattern?.username
            ? 'Username already taken'
            : 'Registration failed. Please try again.')
        : 'Registration failed. Please try again.';

    return res.render('register', {
      error: errMsg,
      name: req.body.name || '',
      email: req.body.email || '',
      username: req.body.username || ''
    });
  }
});

/* --------------------------------- Login -------------------------------- */

router.post('/login', requireGuest, async (req, res) => {
  try {
    // Accept either `identifier` (recommended: "Email or Username" field) OR fallback to existing `email` field
    const identifierRaw = (req.body.identifier || req.body.email || '').trim();
    const password = req.body.password;

    if (!identifierRaw || !password) {
      return res.render('login', {
        errorMessage: 'Email/Username and password are required',
        successMessage: null,
        email: identifierRaw
      });
    }

    const looksLikeEmail = identifierRaw.includes('@');
    const identifierLower = identifierRaw.toLowerCase();

    // If it looks like an email, search by email only.
    // Otherwise, allow either username or email match with the same lowercased value.
    const query = looksLikeEmail
      ? { email: identifierLower }
      : { $or: [{ username: identifierLower }, { email: identifierLower }] };

    const user = await User.findOne(query);
    if (!user) {
      return res.render('login', {
        errorMessage: 'Invalid credentials.',
        successMessage: null,
        email: identifierRaw
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('login', {
        errorMessage: 'Invalid credentials.',
        successMessage: null,
        email: identifierRaw
      });
    }

    // Put consistent fields into session
    req.session.user = {
      _id: user._id,
      id: user._id,
      email: user.email,
      fullname: user.fullname,
      name: user.fullname,     // many templates read "name" first
      username: user.username,
      photo: user.photo
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.render('login', {
      errorMessage: 'Login failed. Please try again.',
      successMessage: null,
      email: req.body.identifier || req.body.email || ''
    });
  }
});

/* --------------------------------- Logout ------------------------------- */

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid');
    return res.json({
      success: true,
      message: 'Logged out successfully',
      redirectUrl: '/'
    });
  });
});

/* -------------------- Forgot / Reset Password routes -------------------- */
/* (Delegates to handlers in userController) */
const {
  renderForgotPassword,
  handleForgotPassword,
  renderResetPassword,
  handleResetPassword
} = require('../controllers/userController');

router.get('/forgot-password', requireGuest, renderForgotPassword);
router.post('/forgot-password', requireGuest, handleForgotPassword);
router.get('/reset-password/:token', requireGuest, renderResetPassword);
router.post('/reset-password/:token', requireGuest, handleResetPassword);

module.exports = router;
