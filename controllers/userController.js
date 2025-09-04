const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');

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
            const userId = req.session.user._id || req.session.user.id;
            
            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
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

module.exports = UserController;
