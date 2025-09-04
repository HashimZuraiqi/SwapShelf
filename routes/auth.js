const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

// Test route to verify auth router is working
router.get('/test', (req, res) => {
    res.json({ message: 'Auth router is working!' });
});

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', requireGuest, async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Basic validation
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

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.render('register', {
                error: 'User with this email already exists',
                name: name || '',
                email: email || ''
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const newUser = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword
        });

        const savedUser = await newUser.save();

        // Create session
        req.session.user = {
            _id: savedUser._id,
            name: savedUser.name,
            email: savedUser.email
        };

        // Redirect to dashboard on success
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            error: 'Registration failed. Please try again.',
            name: req.body.name || '',
            email: req.body.email || ''
        });
    }
});

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', requireGuest, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.render('login', {
                error: 'Email and password are required',
                email: email || ''
            });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.render('login', {
                error: 'Invalid email or password',
                email: email || ''
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('login', {
                error: 'Invalid email or password',
                email: email || ''
            });
        }

        // Create session
        req.session.user = {
            _id: user._id,
            name: user.name,
            email: user.email,
            photo: user.photo
        };

        // Redirect to dashboard on success
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            error: 'Login failed. Please try again.',
            email: req.body.email || ''
        });
    }
});

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
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
        res.json({
            success: true,
            message: 'Logged out successfully',
            redirectUrl: '/'
        });
    });
});

module.exports = router;
