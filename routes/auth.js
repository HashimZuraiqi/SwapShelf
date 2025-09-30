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

/* ---------------------- Username availability check --------------------- */
/* Used by the registration page live-check: /auth/check-username?username=foo */
router.get('/check-username', async (req, res) => {
  try {
    const raw = (req.query.username || '').trim().toLowerCase();

    if (!raw) {
      return res.status(400).json({
        ok: false, available: false, reason: 'empty', message: 'Username is required'
      });
    }

    // 3–30 chars, a–z 0–9 . _ - ; must start/end with alphanumeric; no spaces
    const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])$/;
    const valid = USERNAME_RE.test(raw);
    if (!valid) {
      return res.json({
        ok: true,
        available: false,
        reason: 'format',
        message: '3–30 chars; letters/numbers with . _ - ; must start/end with a letter or number'
      });
    }

    const exists = await User.exists({ username: raw });
    return res.json({
      ok: true,
      available: !exists,
      reason: exists ? 'taken' : 'ok'
    });
  } catch (err) {
    console.error('check-username error:', err);
    return res.status(500).json({ ok: false, available: false, reason: 'server' });
  }
});

/* -------------------------------- Register ------------------------------ */

router.post('/register', requireGuest, async (req, res) => {
  try {
    const { name, username, email, password, confirmPassword, location, phone } = req.body; // location (country from locked list), phone (number input)

    if (!name || !username || !email || !password) {
      return res.render('register', {
        error: 'Name, username, email, and password are required',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    // Require country selection (locked dropdown); block Israel; allow Palestine
    const countryValue = (location || '').trim();
    if (!countryValue) {
      return res.render('register', {
        error: 'Please choose your country.',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }
    if (/^israel$/i.test(countryValue)) {
      return res.render('register', {
        error: 'Selected country is not allowed.',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    // Require phone number (basic sanity check only)
    const phoneValue = (phone || '').trim();
    if (!phoneValue) {
      return res.render('register', {
        error: 'Please enter your phone number.',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }
    const BASIC_PHONE_RE = /^\+?\d[\d\s\-()]{5,}$/;
    if (!BASIC_PHONE_RE.test(phoneValue)) {
      return res.render('register', {
        error: 'Please enter a valid phone number.',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        error: 'Passwords do not match',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.render('register', {
        error: 'User with this email already exists',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.render('register', {
        error: 'Username is already taken',
        name: name || '',
        username: username || '',
        email: email || ''
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      fullname: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      // Store selected country & phone if schema allows (ignored by mongoose if not in schema)
      location: countryValue,
      phone: phoneValue
    });

    const savedUser = await newUser.save();

    // Award Beta Tester badge to new user
    try {
      const Reward = require('../models/Reward');
      const rewards = await Reward.getOrCreateUserRewards(savedUser._id);
      
      // Add Beta Tester badge
      rewards.badges.push({
        badgeId: 'beta_tester',
        isUnlocked: true,
        unlockedAt: new Date()
      });
      
      rewards.totalPoints += 100;
      rewards.reputationLevel = rewards.calculateReputationLevel();
      
      rewards.achievementHistory.push({
        type: 'badge_unlocked',
        description: 'Unlocked badge: Beta Tester',
        points: 100,
        meta: { badgeId: 'beta_tester', badgeName: 'Beta Tester' }
      });
      
      await rewards.save();
      console.log('✅ Beta Tester badge awarded to new user:', savedUser.username);
    } catch (badgeError) {
      console.error('Failed to award Beta Tester badge:', badgeError.message);
      // Don't fail registration if badge awarding fails
    }

    req.session.user = {
      _id: savedUser._id,
      name: savedUser.fullname,
      username: savedUser.username,
      email: savedUser.email
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    return res.render('register', {
      error: 'Registration failed. Please try again.',
      name: req.body.name || '',
      username: req.body.username || '',
      email: req.body.email || ''
    });
  }
});

/* --------------------------------- Login -------------------------------- */

router.post('/login', requireGuest, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', {
        errorMessage: 'Username/Email and password are required',
        successMessage: null,
        email: email || ''
      });
    }

    // Allow login with either username or email
    const identifier = email.trim().toLowerCase();
    let user = null;

    if (identifier.includes('@')) {
      user = await User.findOne({ email: identifier });
    } else {
      user = await User.findOne({ username: identifier });
    }

    if (!user) {
      return res.render('login', {
        errorMessage: 'Invalid username/email or password',
        successMessage: null,
        email: email || ''
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('login', {
        errorMessage: 'Invalid username/email or password',
        successMessage: null,
        email: email || ''
      });
    }

    req.session.user = {
      _id: user._id,
      name: user.fullname,
      username: user.username,
      email: user.email,
      photo: user.photo
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.render('login', {
      errorMessage: 'Login failed. Please try again.',
      successMessage: null,
      email: req.body.email || ''
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
