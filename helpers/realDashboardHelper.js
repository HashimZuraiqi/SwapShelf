/**
 * Real Dashboard Data Helper
 * Fetches actual data from the database instead of mock data
 */

const User = require('../models/User');
const Book = require('../models/Book');
const Swap = require('../models/Swap');

/**
 * Get real dashboard data for a user
 */
const getRealDashboardData = async (userId) => {
    try {
        console.log('Fetching real dashboard data for user:', userId);
        
        // Get real user statistics
        const userStats = await getRealUserStats(userId);
        
        // Get real swap insights
        const swapInsights = await getRealSwapInsights(userId);
        
        // Get real nearby books (books from other users)
        const nearbyBooks = await getRealNearbyBooks(userId);
        
        // Get real trending genres from actual book data
        const trendingGenres = await getRealTrendingGenres();
        
        // Get real trending books from actual swap data
        const trendingBooks = await getRealTrendingBooks();
        
        // Get real recent activity
        const recentActivity = await getRealRecentActivity(userId);
        
        return {
            userStats,
            swapInsights,
            nearbyBooks,
            trendingGenres,
            trendingBooks,
            recentActivity
        };
        
    } catch (error) {
        console.error('Error fetching real dashboard data:', error);
        
        // Return empty/default data instead of crashing
        return {
            userStats: {
                booksOwned: 0,
                swapsCompleted: 0,
                wishlistItems: 0,
                pendingSwaps: 0,
                readingGoalProgress: 0,
                totalReaders: 0,
                activeSwaps: 0,
                booksAvailable: 0
            },
            swapInsights: {
                swapScore: 0,
                successRate: 0,
                avgResponseTime: 'N/A',
                popularGenre: 'None',
                ranking: 0,
                totalUsers: 0,
                matchRate: 0,
                tipMessage: 'Add some books to start swapping!'
            },
            nearbyBooks: [],
            trendingGenres: [],
            trendingBooks: [],
            recentActivity: []
        };
    }
};

/**
 * Get real user statistics from database
 */
const getRealUserStats = async (userId) => {
    try {
        console.log('Fetching real user stats for:', userId);
        
        // Get user's books
        const userBooks = await Book.find({ owner: userId });
        console.log(`Found ${userBooks.length} books for user`);
        
        // Get user's swaps
        const allUserSwaps = await Swap.find({
            $or: [{ requester: userId }, { owner: userId }]
        });
        console.log(`Found ${allUserSwaps.length} total swaps for user`);
        
        // Count completed swaps
        const completedSwaps = allUserSwaps.filter(swap => swap.status === 'Completed');
        console.log(`Found ${completedSwaps.length} completed swaps`);
        
        // Count pending swaps
        const pendingSwaps = allUserSwaps.filter(swap => swap.status === 'Pending');
        console.log(`Found ${pendingSwaps.length} pending swaps`);
        
        // Count available books
        const availableBooks = userBooks.filter(book => book.availability === 'available');
        console.log(`Found ${availableBooks.length} available books`);
        
        // Get total platform statistics
        const totalUsers = await User.countDocuments();
        const totalActiveSwaps = await Swap.countDocuments({ 
            status: { $in: ['Pending', 'Accepted', 'In Progress'] } 
        });
        
        // Calculate reading goal progress (if user has goals set)
        let readingGoalProgress = 0;
        const currentUser = await User.findById(userId);
        if (currentUser && currentUser.readingGoal && currentUser.readingGoal > 0) {
            readingGoalProgress = Math.round((completedSwaps.length / currentUser.readingGoal) * 100);
        }
        
        return {
            booksOwned: userBooks.length,
            swapsCompleted: completedSwaps.length,
            wishlistItems: 0, // Will implement when wishlist is added to User model
            pendingSwaps: pendingSwaps.length,
            readingGoalProgress: Math.min(readingGoalProgress, 100),
            totalReaders: totalUsers,
            activeSwaps: totalActiveSwaps,
            booksAvailable: availableBooks.length
        };
        
    } catch (error) {
        console.error('Error getting real user stats:', error);
        return {
            booksOwned: 0,
            swapsCompleted: 0,
            wishlistItems: 0,
            pendingSwaps: 0,
            readingGoalProgress: 0,
            totalReaders: 0,
            activeSwaps: 0,
            booksAvailable: 0
        };
    }
};

/**
 * Get real swap insights from database
 */
const getRealSwapInsights = async (userId) => {
    try {
        console.log('Fetching real swap insights for:', userId);
        
        // Get all user swaps
        const userSwaps = await Swap.find({
            $or: [{ requester: userId }, { owner: userId }]
        }).sort({ createdAt: -1 });
        
        if (userSwaps.length === 0) {
            return {
                swapScore: 0,
                successRate: 0,
                avgResponseTime: 'N/A',
                popularGenre: 'None',
                ranking: 0,
                totalUsers: await User.countDocuments(),
                matchRate: 0,
                tipMessage: 'Start swapping books to see your insights!'
            };
        }
        
        // Calculate success rate
        const completedSwaps = userSwaps.filter(swap => swap.status === 'Completed');
        const successRate = Math.round((completedSwaps.length / userSwaps.length) * 100);
        
        // Calculate average response time (placeholder - implement when timestamps are added)
        let avgResponseTime = 'N/A';
        
        // Find user's most popular genre
        const userBooks = await Book.find({ owner: userId });
        const genreCounts = {};
        userBooks.forEach(book => {
            if (book.genre) {
                genreCounts[book.genre] = (genreCounts[book.genre] || 0) + 1;
            }
        });
        
        const popularGenre = Object.keys(genreCounts).length > 0 
            ? Object.keys(genreCounts).reduce((a, b) => genreCounts[a] > genreCounts[b] ? a : b)
            : 'None';
        
        // Calculate swap score based on activity and success
        const swapScore = Math.min(
            Math.round((completedSwaps.length * 10) + (successRate * 0.5) + (userBooks.length * 2)),
            100
        );
        
        // Calculate ranking (placeholder - implement proper ranking system)
        const totalUsers = await User.countDocuments();
        const ranking = Math.max(1, Math.round(totalUsers * 0.3)); // Placeholder ranking
        
        // Calculate match rate (placeholder)
        const matchRate = userBooks.length > 0 ? Math.min(75 + (userBooks.length * 2), 95) : 0;
        
        // Generate tip message based on data
        let tipMessage = 'Keep up the great work!';
        if (successRate < 50) {
            tipMessage = 'Try responding faster to swap requests to improve your success rate!';
        } else if (userBooks.length < 5) {
            tipMessage = 'Add more books to increase your swap opportunities!';
        } else if (successRate > 80) {
            tipMessage = 'Excellent swap success rate! You\'re a trusted swapper in the community.';
        }
        
        return {
            swapScore,
            successRate,
            avgResponseTime,
            popularGenre,
            ranking,
            totalUsers,
            matchRate,
            tipMessage
        };
        
    } catch (error) {
        console.error('Error getting real swap insights:', error);
        return {
            swapScore: 0,
            successRate: 0,
            avgResponseTime: 'N/A',
            popularGenre: 'None',
            ranking: 0,
            totalUsers: 0,
            matchRate: 0,
            tipMessage: 'Error loading insights. Please try again.'
        };
    }
};

/**
 * Get real nearby books from other users
 */
const getRealNearbyBooks = async (userId) => {
    try {
        console.log('Fetching real nearby books for:', userId);
        
        // Get books from other users that are available
        const nearbyBooks = await Book.find({
            owner: { $ne: userId }, // Not owned by current user
            availability: 'available'
        })
        .populate('owner', 'name email location')
        .sort({ createdAt: -1 }) // Most recently added first
        .limit(10);
        
        console.log(`Found ${nearbyBooks.length} nearby books from other users`);
        
        // Format the data for frontend
        return nearbyBooks.map(book => ({
            id: book._id,
            title: book.title,
            author: book.author,
            distance: '2.3 km', // Placeholder - implement real distance calculation
            condition: book.condition || 'Good',
            image: book.image || '/images/book-placeholder.jpg',
            owner: book.owner ? (book.owner.name || book.owner.email.split('@')[0]) : 'Unknown'
        }));
        
    } catch (error) {
        console.error('Error getting real nearby books:', error);
        return [];
    }
};

/**
 * Get real trending genres from actual book data
 */
const getRealTrendingGenres = async () => {
    try {
        console.log('Fetching real trending genres');
        
        // Aggregate genres from all books in the platform
        const genreStats = await Book.aggregate([
            { $match: { genre: { $exists: true, $ne: null } } },
            { $group: { _id: '$genre', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        
        console.log(`Found ${genreStats.length} genres in platform`);
        
        // Calculate total books for percentage
        const totalBooks = await Book.countDocuments();
        
        return genreStats.map(genre => ({
            name: genre._id,
            percentage: totalBooks > 0 ? Math.round((genre.count / totalBooks) * 100) : 0,
            swaps: genre.count // Using book count as proxy for swaps
        }));
        
    } catch (error) {
        console.error('Error getting real trending genres:', error);
        return [];
    }
};

/**
 * Get real trending books from actual swap/book data
 */
const getRealTrendingBooks = async () => {
    try {
        console.log('Fetching real trending books');
        
        // Get most recently added books across the platform
        const trendingBooks = await Book.find({
            availability: 'available'
        })
        .sort({ createdAt: -1 })
        .limit(8);
        
        console.log(`Found ${trendingBooks.length} trending books`);
        
        return trendingBooks.map((book, index) => ({
            id: book._id,
            title: book.title,
            author: book.author,
            swapCount: Math.max(1, 50 - (index * 3)), // Placeholder swap count
            image: book.image || '/images/book-placeholder.jpg',
            genre: book.genre || 'Unknown'
        }));
        
    } catch (error) {
        console.error('Error getting real trending books:', error);
        return [];
    }
};

/**
 * Get real recent activity for user
 */
const getRealRecentActivity = async (userId) => {
    try {
        console.log('Fetching real recent activity for:', userId);
        
        const activities = [];
        
        // Get recent swaps
        const recentSwaps = await Swap.find({
            $or: [{ requester: userId }, { owner: userId }]
        })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('requester', 'name email')
        .populate('owner', 'name email')
        .populate('requestedBook.id', 'title')
        .populate('offeredBooks.id', 'title');
        
        recentSwaps.forEach(swap => {
            const isRequester = swap.requester._id.toString() === userId.toString();
            const otherUser = isRequester ? swap.owner : swap.requester;
            const otherUserName = otherUser.name || otherUser.email.split('@')[0];
            
            let message, icon, classType;
            
            switch (swap.status) {
                case 'Completed':
                    message = `Successfully swapped "${swap.requestedBook.title || 'a book'}" with ${otherUserName}`;
                    icon = 'bi-check-circle';
                    classType = 'success';
                    break;
                case 'Pending':
                    message = isRequester 
                        ? `Sent swap request to ${otherUserName}`
                        : `Received swap request from ${otherUserName}`;
                    icon = 'bi-arrow-left-right';
                    classType = 'warning';
                    break;
                case 'Accepted':
                    message = `Swap accepted with ${otherUserName}`;
                    icon = 'bi-check-circle';
                    classType = 'info';
                    break;
                case 'Declined':
                    message = `Swap declined with ${otherUserName}`;
                    icon = 'bi-x-circle';
                    classType = 'secondary';
                    break;
                default:
                    message = `Swap activity with ${otherUserName}`;
                    icon = 'bi-arrow-left-right';
                    classType = 'info';
            }
            
            activities.push({
                type: `swap_${swap.status.toLowerCase()}`,
                message,
                time: getTimeAgo(swap.createdAt),
                icon,
                class: classType
            });
        });
        
        // Get recent book additions
        const recentBooks = await Book.find({ owner: userId })
        .sort({ createdAt: -1 })
        .limit(2);
        
        recentBooks.forEach(book => {
            activities.push({
                type: 'book_added',
                message: `Added "${book.title}" to your library`,
                time: getTimeAgo(book.createdAt),
                icon: 'bi-plus-circle',
                class: 'info'
            });
        });
        
        // Sort all activities by date and limit to 5
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        console.log(`Generated ${activities.length} recent activities`);
        
        return activities.slice(0, 5);
        
    } catch (error) {
        console.error('Error getting real recent activity:', error);
        return [];
    }
};

/**
 * Helper function to get time ago string
 */
const getTimeAgo = (date) => {
    if (!date) return 'Unknown time';
    
    const now = new Date();
    const diffInMs = now - new Date(date);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInDays < 30) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
};

module.exports = {
    getRealDashboardData,
    getRealUserStats,
    getRealSwapInsights,
    getRealNearbyBooks,
    getRealTrendingGenres,
    getRealTrendingBooks,
    getRealRecentActivity
};
