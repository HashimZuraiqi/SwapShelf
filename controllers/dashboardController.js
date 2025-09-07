/**
 * Dashboard API Controller
 * Handles all dashboard-related API endpoints and data fetching
 */

const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');

/**
 * Get comprehensive dashboard data for a user
 */
const getDashboardData = async (userId) => {
    try {
        // User Statistics
        const userBooks = await Book.find({ owner: userId });
        const userSwaps = await Swap.find({
            $or: [{ requester: userId }, { owner: userId }]
        });
        
        const completedSwaps = userSwaps.filter(swap => swap.status === 'completed');
        const activeSwaps = userSwaps.filter(swap => ['pending', 'accepted', 'in-progress'].includes(swap.status));
        
        const userStats = {
            booksOwned: userBooks.length,
            swapsCompleted: completedSwaps.length,
            activeSwaps: activeSwaps.length,
            wishlistSize: 0, // Will be updated when wishlist is implemented
            successRate: userSwaps.length > 0 ? Math.round((completedSwaps.length / userSwaps.length) * 100) : 0
        };
        
        // Swap Insights
        const swapInsights = {
            totalRequests: userSwaps.filter(swap => swap.requester.toString() === userId.toString()).length,
            totalOffers: userSwaps.filter(swap => swap.owner.toString() === userId.toString()).length,
            averageRating: 4.2, // Placeholder - will be calculated from actual ratings
            monthlyGrowth: 15 // Placeholder - will be calculated from actual data
        };
        
        // Nearby Books (placeholder for now - will use geolocation)
        const nearbyBooks = await Book.find({ 
            owner: { $ne: userId },
            availability: 'available'
        }).limit(10).populate('owner', 'name email location');
        
        // Trending Genres
        const genreStats = await Book.aggregate([
            {
                $group: {
                    _id: '$genre',
                    count: { $sum: 1 },
                    books: { $push: { title: '$title', author: '$author' } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        const trendingGenres = genreStats.map(genre => ({
            name: genre._id || 'Unknown',
            count: genre.count,
            books: genre.books.slice(0, 3)
        }));
        
        // Recent Activity
        const recentActivity = await Swap.find({
            $or: [{ requester: userId }, { owner: userId }]
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('requester', 'name email')
        .populate('owner', 'name email')
        .populate('bookRequested', 'title author')
        .populate('bookOffered', 'title author');
        
        return {
            userStats,
            swapInsights,
            nearbyBooks,
            trendingGenres,
            recentActivity
        };
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        throw error;
    }
};

/**
 * API endpoint to get dashboard data
 */
const getDashboardAPI = async (req, res) => {
    try {
        const userId = req.session?.user?._id || req.session?.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        const dashboardData = await getDashboardData(userId);
        
        res.json({
            success: true,
            data: dashboardData
        });
        
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};

/**
 * API endpoint to get user statistics only
 */
const getUserStatsAPI = async (req, res) => {
    try {
        const userId = req.session?.user?._id || req.session?.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        const dashboardData = await getDashboardData(userId);
        
        res.json({
            success: true,
            data: {
                userStats: dashboardData.userStats,
                swapInsights: dashboardData.swapInsights
            }
        });
        
    } catch (error) {
        console.error('User stats API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user statistics',
            error: error.message
        });
    }
};

/**
 * API endpoint to get nearby books
 */
const getNearbyBooksAPI = async (req, res) => {
    try {
        const userId = req.session?.user?._id || req.session?.user?.id;
        
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        const { latitude, longitude, radius = 10 } = req.query;
        
        // For now, just get random available books
        // Later we'll implement proper geolocation filtering
        const nearbyBooks = await Book.find({ 
            owner: { $ne: userId },
            availability: 'available'
        }).limit(parseInt(req.query.limit) || 10)
        .populate('owner', 'name email location');
        
        res.json({
            success: true,
            data: nearbyBooks
        });
        
    } catch (error) {
        console.error('Nearby books API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch nearby books',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardData,
    getDashboardAPI,
    getUserStatsAPI,
    getNearbyBooksAPI
};
