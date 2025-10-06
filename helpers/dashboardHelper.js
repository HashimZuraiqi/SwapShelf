const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');

/**
 * Dashboard Data Helper Functions
 * These functions fetch and calculate real-time dashboard data
 */

/**
 * Get comprehensive user statistics
 * @param {string} userId - The user's ID
 * @returns {Object} User statistics object
 */
async function getUserStats(userId) {
    try {
        console.log('getUserStats called for userId:', userId);
        
        const [
            booksOwned,
            completedSwaps,
            pendingSwaps,
            currentUser
        ] = await Promise.all([
            Book.countDocuments({ 
                owner: userId, 
                availability: { $ne: 'Swapped' } 
            }),
            Swap.countDocuments({ 
                $or: [{ requester: userId }, { owner: userId }], 
                status: 'Completed'
            }),
            Swap.countDocuments({ 
                $or: [{ requester: userId }, { owner: userId }], 
                status: { $in: ['Pending', 'Accepted', 'In Progress'] } 
            }),
            User.findById(userId).select('wishlist')
        ]);

        const wishlistItems = currentUser && currentUser.wishlist ? currentUser.wishlist.length : 0;

        const stats = {
            booksOwned,
            swapsCompleted: completedSwaps,
            wishlistItems,
            pendingSwaps
        };
        
        console.log('Dashboard helper returning stats:', stats);
        console.log('Stats details:', {
            booksOwnedCount: booksOwned,
            completedSwapsCount: completedSwaps,
            wishlistItemsCount: wishlistItems,
            pendingSwapsCount: pendingSwaps
        });
        
        return stats;
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return {
            booksOwned: 0,
            swapsCompleted: 0,
            wishlistItems: 0,
            pendingSwaps: 0
        };
    }
}

/**
 * Calculate user's swap insights and performance metrics
 * @param {string} userId - The user's ID
 * @returns {Object} Swap insights object
 */
async function getSwapInsights(userId) {
    try {
        const [totalSwaps, completedSwaps, userBooks] = await Promise.all([
            Swap.countDocuments({
                $or: [{ requester: userId }, { owner: userId }],
                status: { $in: ['Completed', 'Declined', 'Cancelled'] }
            }),
            Swap.countDocuments({ 
                $or: [{ requester: userId }, { owner: userId }], 
                status: 'Completed' 
            }),
            Book.find({ owner: userId }).select('genre')
        ]);

        // Calculate success rate
        const successRate = totalSwaps > 0 ? Math.round((completedSwaps / totalSwaps) * 100) : 0;

        // Find user's most popular genre
        const genreCounts = {};
        userBooks.forEach(book => {
            book.genre.forEach(genre => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            });
        });
        
        const popularGenre = Object.keys(genreCounts).length > 0 
            ? Object.keys(genreCounts).reduce((a, b) => genreCounts[a] > genreCounts[b] ? a : b)
            : "Not specified";

        // Estimate response time based on success rate
        const avgResponseTime = successRate > 80 ? "1-2 hours" : 
                               successRate > 60 ? "2-4 hours" : 
                               successRate > 40 ? "4-8 hours" : "1+ days";

        return {
            successRate,
            avgResponseTime,
            popularGenre,
            totalSwaps,
            completedSwaps
        };
    } catch (error) {
        console.error('Error fetching swap insights:', error);
        return {
            successRate: 0,
            avgResponseTime: "No data",
            popularGenre: "Not specified",
            totalSwaps: 0,
            completedSwaps: 0
        };
    }
}

/**
 * Get nearby available books for the user
 * @param {string} userId - The user's ID
 * @param {number} limit - Number of books to return (default: 3)
 * @returns {Array} Array of nearby books
 */
async function getNearbyBooks(userId, limit = 3) {
    try {
        // For now, get recent available books from other users
        // In production, implement actual geolocation-based queries
        const recentBooks = await Book.find({
            owner: { $ne: userId },
            availability: 'Available'
        })
        .populate('owner', 'fullname location')
        .sort({ createdAt: -1 })
        .limit(limit);
        
        return recentBooks.map(book => ({
            id: book._id,
            title: book.title,
            author: book.author,
            distance: "Nearby", // In production: calculate actual distance
            image: book.images && book.images.length > 0 ? book.images[0] : "/images/placeholder-book.jpg",
            ownerName: book.owner ? book.owner.fullname : "Unknown",
            condition: book.condition,
            genre: book.genre
        }));
    } catch (error) {
        console.error('Error fetching nearby books:', error);
        return [];
    }
}

/**
 * Get trending genres based on platform activity
 * @param {number} limit - Number of genres to return (default: 4)
 * @returns {Array} Array of trending genres
 */
async function getTrendingGenres(limit = 4) {
    try {
        const genreAggregation = await Book.aggregate([
            { $match: { availability: 'Available' } },
            { $unwind: '$genre' },
            { $group: { 
                _id: '$genre', 
                count: { $sum: 1 },
                swaps: { $sum: '$stats.swapRequests' }
            }},
            { $sort: { count: -1 } },
            { $limit: limit }
        ]);
        
        const maxCount = genreAggregation.length > 0 ? genreAggregation[0].count : 1;
        
        return genreAggregation.map(item => ({
            name: item._id,
            swaps: item.swaps || 0,
            percentage: Math.round((item.count / maxCount) * 100)
        }));
    } catch (error) {
        console.error('Error fetching trending genres:', error);
        return [];
    }
}

/**
 * Get trending books based on swap requests and views
 * @param {number} limit - Number of books to return (default: 3)
 * @returns {Array} Array of trending books
 */
async function getTrendingBooks(limit = 3) {
    try {
        const trendingBooksData = await Book.find({
            availability: 'Available'
        })
        .sort({ 'stats.swapRequests': -1, 'stats.views': -1 })
        .limit(limit)
        .select('title author stats.swapRequests images genre');
        
        return trendingBooksData.map(book => ({
            id: book._id,
            title: book.title,
            author: book.author,
            swapCount: book.stats.swapRequests || 0,
            image: book.images && book.images.length > 0 ? book.images[0] : "/images/placeholder-book.jpg",
            genre: book.genre
        }));
    } catch (error) {
        console.error('Error fetching trending books:', error);
        return [];
    }
}

/**
 * Get all dashboard data for a user
 * @param {string} userId - The user's ID
 * @returns {Object} Complete dashboard data
 */
async function getDashboardData(userId) {
    try {
        const [userStats, swapInsights, nearbyBooks, trendingGenres, trendingBooks] = await Promise.all([
            getUserStats(userId),
            getSwapInsights(userId),
            getNearbyBooks(userId),
            getTrendingGenres(),
            getTrendingBooks()
        ]);

        return {
            userStats,
            swapInsights,
            nearbyBooks,
            trendingGenres,
            trendingBooks
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Return default empty data structure
        return {
            userStats: {
                booksOwned: 0,
                swapsCompleted: 0,
                wishlistItems: 0,
                pendingSwaps: 0
            },
            swapInsights: {
                successRate: 0,
                avgResponseTime: "No data",
                popularGenre: "Not specified"
            },
            nearbyBooks: [],
            trendingGenres: [],
            trendingBooks: []
        };
    }
}

module.exports = {
    getUserStats,
    getSwapInsights,
    getNearbyBooks,
    getTrendingGenres,
    getTrendingBooks,
    getDashboardData
};
