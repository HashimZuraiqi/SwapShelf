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
  res.render('register', { error: null, name: '', email: '' });
});

// (Optional aliases if someone hits these under /auth)
router.get('/login.html', (req, res) => res.redirect(301, '/auth/login'));
router.get('/register.html', (req, res) => res.redirect(301, '/auth/register'));

/* ----------------------------- Diagnostics ------------------------------ */

router.get('/test', (req, res) => {
  res.json({ message: 'Auth router is working!' });
});

/* -------------------------------- Register ------------------------------ */

router.post('/register', requireGuest, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.render('register', {
        error: 'Name, email, and password are required',
        name: name || '',
        email: email || ''
      });
    }

    if (password !== confirmPassword) {
      return res.render('register', {
        error: 'Passwords do not match',
        name: name || '',
        email: email || ''
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.render('register', {
        error: 'User with this email already exists',
        name: name || '',
        email: email || ''
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword
    });

    const savedUser = await newUser.save();

    req.session.user = {
      _id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    return res.render('register', {
      error: 'Registration failed. Please try again.',
      name: req.body.name || '',
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
        errorMessage: 'Email and password are required',
        successMessage: null,
        email: email || ''
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.render('login', {
        errorMessage: 'Invalid email or password',
        successMessage: null,
        email: email || ''
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('login', {
        errorMessage: 'Invalid email or password',
        successMessage: null,
        email: email || ''
      });
    }

    req.session.user = {
      _id: user._id,
      name: user.name,
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
