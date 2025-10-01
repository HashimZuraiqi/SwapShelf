const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
/**
 * User Management Controller
 * Handles profile, wishlist, and user-related operations
 */

class UserController {
    
    /**
     * Get user profile data
     */
    static async getProfile(req, res) {
        try {
            console.log('🔍 UserController.getProfile called');
            console.log('🔍 Session exists:', !!req.session);
            console.log('🔍 Session user:', req.session?.user ? 'exists' : 'missing');
            console.log('🔍 Session user email:', req.session?.user?.email);
            console.log('🔍 Session user id:', req.session?.user?._id || req.session?.user?.id);
            
            const userId = req.session.user._id || req.session.user.id;
            console.log('🔍 Using userId:', userId);
            
            const user = await User.findById(userId).select('-password');
            if (!user) {
                console.log('❌ User not found in database for ID:', userId);
                return res.status(404).json({ error: 'User not found' });
            }
            
            console.log('✅ User found in database:', user.email);
            
            // Get user statistics
            const [booksCount, completedSwaps, activeSwaps] = await Promise.all([
                Book.countDocuments({ owner: userId }),
                Swap.countDocuments({ 
                    $or: [{ requester: userId }, { owner: userId }], 
                    status: 'Completed' 
                }),
                Swap.countDocuments({ 
                    $or: [{ requester: userId }, { owner: userId }], 
                    status: { $in: ['Pending', 'Accepted', 'In Progress'] } 
                })
            ]);
            
            const userProfile = {
                ...user.toObject(),
                stats: {
                    booksOwned: booksCount,
                    swapsCompleted: completedSwaps,
                    activeSwaps,
                    wishlistSize: user.wishlist ? user.wishlist.length : 0
                }
            };
            
            console.log('✅ Sending user profile response');
            console.log('✅ Profile keys:', Object.keys(userProfile));
            console.log('✅ Profile email:', userProfile.email);
            console.log('✅ Profile _id:', userProfile._id);
            
            res.json(userProfile);
            
        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({ error: 'Failed to fetch profile' });
        }
    }
    
    /**
     * Update user profile
     */
    static async updateProfile(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { fullname, location, preferences } = req.body;
            
            const updateData = {
                updatedAt: new Date()
            };
            
            if (fullname) updateData.fullname = fullname.trim();
            if (location) updateData.location = location.trim();
            if (preferences) {
                updateData.preferences = {
                    ...preferences,
                    updatedAt: new Date()
                };
            }
            
            // Handle profile photo upload
            if (req.file) {
                updateData.photo = `/uploads/profiles/${req.file.filename}`;
            }
            
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, select: '-password' }
            );
            
            // Update session data
            req.session.user = {
                ...req.session.user,
                fullname: updatedUser.fullname,
                location: updatedUser.location,
                photo: updatedUser.photo
            };
            
            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: updatedUser
            });
            
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    }
    
    /**
     * Add book to wishlist
     */
    static async addToWishlist(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { title, author, priority, notes } = req.body;
            
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Check if book already in wishlist
            const existingItem = user.wishlist.find(item => 
                item.title.toLowerCase() === title.toLowerCase() && 
                item.author.toLowerCase() === author.toLowerCase()
            );
            
            if (existingItem) {
                return res.status(400).json({ error: 'Book already in wishlist' });
            }
            
            const wishlistItem = {
                title: title.trim(),
                author: author.trim(),
                priority: priority || 'Medium',
                notes: notes || '',
                addedAt: new Date()
            };
            
            user.wishlist.push(wishlistItem);
            user.updatedAt = new Date();
            
            await user.save();
            
            res.json({
                success: true,
                message: 'Book added to wishlist',
                wishlistItem
            });
            
        } catch (error) {
            console.error('Add to wishlist error:', error);
            res.status(500).json({ error: 'Failed to add to wishlist' });
        }
    }
    
    /**
     * Remove book from wishlist
     */
    static async removeFromWishlist(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { itemId } = req.params;
            
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            user.wishlist = user.wishlist.filter(item => 
                item._id.toString() !== itemId
            );
            user.updatedAt = new Date();
            
            await user.save();
            
            res.json({
                success: true,
                message: 'Book removed from wishlist'
            });
            
        } catch (error) {
            console.error('Remove from wishlist error:', error);
            res.status(500).json({ error: 'Failed to remove from wishlist' });
        }
    }
    
    /**
     * Update wishlist item
     */
    static async updateWishlistItem(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { itemId } = req.params;
            const { priority, notes } = req.body;
            
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const wishlistItem = user.wishlist.id(itemId);
            if (!wishlistItem) {
                return res.status(404).json({ error: 'Wishlist item not found' });
            }
            
            if (priority) wishlistItem.priority = priority;
            if (notes !== undefined) wishlistItem.notes = notes;
            
            user.updatedAt = new Date();
            await user.save();
            
            res.json({
                success: true,
                message: 'Wishlist item updated',
                wishlistItem
            });
            
        } catch (error) {
            console.error('Update wishlist item error:', error);
            res.status(500).json({ error: 'Failed to update wishlist item' });
        }
    }
    
    /**
     * Search for wishlist matches
     */
    static async findWishlistMatches(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            
            const user = await User.findById(userId);
            if (!user || !user.wishlist.length) {
                return res.json({ matches: [] });
            }
            
            const matches = [];
            
            // Search for each wishlist item
            for (const wishlistItem of user.wishlist) {
                const availableBooks = await Book.find({
                    owner: { $ne: userId },
                    availability: 'Available',
                    $or: [
                        { title: { $regex: wishlistItem.title, $options: 'i' } },
                        { author: { $regex: wishlistItem.author, $options: 'i' } }
                    ]
                }).populate('owner', 'fullname location').limit(5);
                
                if (availableBooks.length > 0) {
                    matches.push({
                        wishlistItem: wishlistItem,
                        availableBooks: availableBooks
                    });
                }
            }
            
            res.json({ matches });
            
        } catch (error) {
            console.error('Find wishlist matches error:', error);
            res.status(500).json({ error: 'Failed to find matches' });
        }
    }
    
    /**
     * Get user's reading activity/history
     */
    static async getReadingActivity(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { page = 1, limit = 20 } = req.query;
            
            const skip = (page - 1) * limit;
            
            // Get recent activities (book additions, completed swaps)
            const [recentBooks, completedSwaps] = await Promise.all([
                Book.find({ owner: userId })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select('title author createdAt images'),
                Swap.find({
                    $or: [{ requester: userId }, { owner: userId }],
                    status: 'Completed'
                })
                .sort({ completedAt: -1 })
                .limit(10)
                .populate('requester', 'fullname')
                .populate('owner', 'fullname')
            ]);
            
            // Create activity timeline
            const activities = [];
            
            // Add book additions
            recentBooks.forEach(book => {
                activities.push({
                    type: 'book_added',
                    date: book.createdAt,
                    data: {
                        title: book.title,
                        author: book.author,
                        image: book.images?.[0]
                    }
                });
            });
            
            // Add completed swaps
            completedSwaps.forEach(swap => {
                activities.push({
                    type: 'swap_completed',
                    date: swap.completedAt,
                    data: {
                        bookTitle: swap.requestedBook.title,
                        partnerName: swap.requester._id.toString() === userId 
                            ? swap.owner.fullname 
                            : swap.requester.fullname,
                        wasRequester: swap.requester._id.toString() === userId
                    }
                });
            });
            
            // Sort by date and paginate
            activities.sort((a, b) => new Date(b.date) - new Date(a.date));
            const paginatedActivities = activities.slice(skip, skip + parseInt(limit));
            
            res.json({
                activities: paginatedActivities,
                pagination: {
                    currentPage: parseInt(page),
                    totalItems: activities.length,
                    hasMore: skip + parseInt(limit) < activities.length
                }
            });
            
        } catch (error) {
            console.error('Get reading activity error:', error);
            res.status(500).json({ error: 'Failed to fetch activity' });
        }
    }
}

/* ---------- helpers ---------- */
function makeTransport() {
  // If SMTP env not set, fallback to console logger transport
  if (!process.env.SMTP_HOST) {
    return {
      sendMail: async (opts) => {
        console.log('📧 [DEV EMAIL MOCK] To:', opts.to);
        console.log('Subject:', opts.subject);
        console.log('HTML:', opts.html);
        return true;
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: !!(process.env.SMTP_SECURE === 'true'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

function appBaseUrl(req) {
  // Respect Vercel/Proxy/X-Forwarded headers if present
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

/* ---------- views ---------- */
exports.renderForgotPassword = (req, res) => {
  res.render('forgot-password', { error: null, success: null });
};

exports.renderResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.render('reset-password', { token: null, error: 'Reset link is invalid or has expired.' });
    }

    res.render('reset-password', { token, error: null });
  } catch (e) {
    console.error('Render reset error:', e);
    res.render('reset-password', { token: null, error: 'Something went wrong. Please try again.' });
  }
};

/* ---------- actions ---------- */
exports.handleForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.render('forgot-password', { error: 'Please enter your email address.', success: null });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    // For privacy, do not reveal whether user exists
    if (!user) {
      return res.render('forgot-password', { error: null, success: 'If that email exists, we’ve sent a reset link.' });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + (1000 * 60 * 30)); // 30 minutes
    await user.save();

    // Send email
    const transporter = makeTransport();
    const base = appBaseUrl(req);
    const resetUrl = `${base}/auth/reset-password/${token}`;

    await transporter.sendMail({
      to: user.email,
      from: process.env.MAIL_FROM || 'no-reply@swapshelf.local',
      subject: 'Reset your SwapShelf password',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
          <h2>Reset your password</h2>
          <p>Hi ${user.fullname || user.name || ''},</p>
          <p>We received a request to reset your SwapShelf password. Click the button below to set a new one:</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#3BB7FB;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">
              Reset Password
            </a>
          </p>
          <p>Or paste this link into your browser:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p><small>This link expires in 30 minutes. If you didn’t request this, you can safely ignore this email.</small></p>
        </div>
      `
    });

    return res.render('forgot-password', { error: null, success: 'If that email exists, we’ve sent a reset link.' });
  } catch (e) {
    console.error('Forgot password error:', e);
    res.render('forgot-password', { error: 'Could not send reset link. Please try again.', success: null });
  }
};

exports.handleResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirm } = req.body;

    if (!password || password.length < 6) {
      return res.render('reset-password', { token, error: 'Password must be at least 6 characters.' });
    }
    if (password !== confirm) {
      return res.render('reset-password', { token, error: 'Passwords do not match.' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.render('reset-password', { token: null, error: 'Reset link is invalid or has expired.' });
    }

    // Update password
    const hashed = await bcrypt.hash(password, 12);
    user.password = hashed;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Optional: auto-redirect to login with message
    return res.redirect('/auth/login?success=Your password has been reset. Please sign in.');
  } catch (e) {
    console.error('Reset password error:', e);
    res.render('reset-password', { token: null, error: 'Something went wrong. Please try again.' });
  }
};

/* 
 * IMPORTANT FIX:
 * Previously: `module.exports = UserController;` overwrote the `exports.*` handlers above.
 * We now merge them so routes like `router.get('/forgot-password', userCtrl.renderForgotPassword)`
 * receive a real function.
 */
module.exports = Object.assign(UserController, {
  renderForgotPassword: exports.renderForgotPassword,
  renderResetPassword: exports.renderResetPassword,
  handleForgotPassword: exports.handleForgotPassword,
  handleResetPassword: exports.handleResetPassword,
});
