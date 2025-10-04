const Swap = require('../models/Swap');
const Book = require('../models/Book');
const User = require('../models/User');

/**
 * Swap Management Controller
 * Handles all swap-related operations: requests, negotiations, completions
 */

class SwapController {
    
    /**
     * Create a new swap request
     */
    static async createSwapRequest(req, res) {
        console.log('🚀 CREATE SWAP REQUEST STARTED');
        console.log('📝 Request body:', req.body);
        console.log('👤 Session user:', req.session.user);
        
        try {
            // For testing - use dummy user ID if no session
            const requesterId = req.session?.user?._id || req.session?.user?.id || '689e2ba746de4ed0a2716e4f';
            const { requestedBookId, offeredBookIds, offeredBookId, message } = req.body;
            
            // Get requester info
            const requester = await User.findById(requesterId);
            if (!requester) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Get requested book with owner info
            const requestedBook = await Book.findById(requestedBookId)
                .populate('owner', 'fullname username email');
                
            console.log('🔍 Requested book check:', {
                bookId: requestedBookId,
                found: !!requestedBook,
                availability: requestedBook?.availability,
                owner: requestedBook?.owner,
                ownerDetails: {
                    fullname: requestedBook?.owner?.fullname,
                    username: requestedBook?.owner?.username,
                    email: requestedBook?.owner?.email
                }
            });
                
            if (!requestedBook || requestedBook.availability !== 'available') {
                console.log('❌ Book availability check failed:', {
                    bookExists: !!requestedBook,
                    availability: requestedBook?.availability,
                    expectedAvailability: 'available'
                });
                return res.status(400).json({ error: 'Book not available for swap' });
            }
            
            if (requestedBook.owner._id.toString() === requesterId) {
                return res.status(400).json({ error: 'Cannot request your own book' });
            }
            
            // Check for existing active request
            const existingRequest = await Swap.findOne({
                requester: requesterId,
                'requestedBook.id': requestedBookId,
                status: { $in: ['Pending', 'Accepted', 'In Progress'] }
            });
            
            if (existingRequest) {
                return res.status(400).json({ error: 'You already have an active request for this book' });
            }
            
            // Get offered books
            let offeredBooks = [];
            const offeredIds = Array.isArray(offeredBookIds) && offeredBookIds.length > 0
                ? offeredBookIds
                : (offeredBookId ? [offeredBookId] : []);
                
            console.log('📚 Offered books check:', {
                offeredBookIds,
                offeredBookId,
                finalOfferedIds: offeredIds
            });
                
            if (offeredIds && offeredIds.length > 0) {
                const books = await Book.find({
                    _id: { $in: offeredIds },
                    owner: requesterId,
                    availability: 'available'
                });
                
                console.log('📚 Found offered books:', {
                    searchedIds: offeredIds,
                    foundBooks: books.length,
                    books: books.map(b => ({ id: b._id, title: b.title, availability: b.availability }))
                });
                
                offeredBooks = books.map(book => ({
                    id: book._id,
                    title: book.title,
                    author: book.author
                }));
            }
            
            // Get proper names with fallbacks
            const requesterName = requester.fullname || requester.username || requester.email || 'Unknown User';
            const ownerName = requestedBook.owner.fullname || requestedBook.owner.username || requestedBook.owner.email || 'Unknown Owner';
            
            console.log('👥 User names:', {
                requesterName,
                ownerName,
                requesterData: {
                    fullname: requester.fullname,
                    username: requester.username,
                    email: requester.email
                },
                ownerData: {
                    fullname: requestedBook.owner.fullname,
                    username: requestedBook.owner.username,
                    email: requestedBook.owner.email
                }
            });

            const newSwap = new Swap({
                requester: requesterId,
                requesterName: requesterName,
                owner: requestedBook.owner._id,
                ownerName: ownerName,
                requestedBook: {
                    id: requestedBook._id,
                    title: requestedBook.title,
                    author: requestedBook.author
                },
                offeredBooks,
                message: message || '',
                status: 'Pending',
                negotiationHistory: [{
                    from: requesterId,
                    fromName: requesterName,
                    message: message || 'Initial swap request',
                    action: 'Message',
                    timestamp: new Date()
                }]
            });
            
            await newSwap.save();
            
            // Update book stats
            await Book.findByIdAndUpdate(requestedBookId, {
                $inc: { 'stats.swapRequests': 1 }
            });
            
            // Keep book available for multiple requests
            // Note: Book will only be marked unavailable when a swap is accepted
            
            res.status(201).json({
                success: true,
                message: 'Swap request sent successfully!',
                swap: newSwap
            });
            
        } catch (error) {
            console.error('Create swap request error:', error);
            res.status(500).json({ error: 'Failed to create swap request' });
        }
    }
    
    /**
     * Get user's swap requests (sent and received)
     */
    static async getUserSwaps(req, res) {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const { type = 'all', status = 'all', page = 1, limit = 10 } = req.query;
            
            let query = {};
            
            // Filter by type (sent/received)
            if (type === 'sent') {
                query.requester = userId;
            } else if (type === 'received') {
                query.owner = userId;
            } else {
                query.$or = [
                    { requester: userId },
                    { owner: userId }
                ];
            }
            
            // Filter by status
            if (status !== 'all') {
                query.status = status;
            }
            
            const skip = (page - 1) * limit;
            
            const [swaps, totalSwaps] = await Promise.all([
                Swap.find(query)
                    .populate('requester', 'fullname photo')
                    .populate('owner', 'fullname photo')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                Swap.countDocuments(query)
            ]);
            
            const totalPages = Math.ceil(totalSwaps / limit);
            
            res.json({
                swaps,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalSwaps,
                    hasMore: parseInt(page) < totalPages
                }
            });
            
        } catch (error) {
            console.error('Get user swaps error:', error);
            res.status(500).json({ error: 'Failed to fetch swaps' });
        }
    }
    
    /**
     * Respond to a swap request (accept/decline)
     */
    static async respondToSwap(req, res) {
        try {
            const { swapId } = req.params;
            const { action, message } = req.body; // 'accept' or 'decline'
            const userId = req.session.user._id || req.session.user.id;
            
            const swap = await Swap.findById(swapId);
            if (!swap) {
                return res.status(404).json({ error: 'Swap request not found' });
            }
            
            // Verify user is the owner
            if (swap.owner.toString() !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            if (swap.status !== 'Pending') {
                return res.status(400).json({ error: 'Swap request already processed' });
            }
            
            const user = await User.findById(userId);
            
            if (action === 'accept') {
                swap.status = 'Accepted';

                // Add to negotiation history
                swap.negotiationHistory.push({
                    from: userId,
                    fromName: user.fullname,
                    message: message || 'Swap request accepted',
                    action: 'Accept',
                    timestamp: new Date()
                });

                // Auto-cancel all other pending requests for the same books
                try {
                    console.log('🔄 Auto-cancelling other pending requests...');
                    
                    // Get all book IDs involved in this swap
                    const allBookIds = [swap.requestedBook.id];
                    if (swap.offeredBooks && swap.offeredBooks.length > 0) {
                        allBookIds.push(...swap.offeredBooks.map(b => b.id));
                    }
                    
                    // Find all other pending swaps that involve any of these books
                    const otherPendingSwaps = await Swap.find({
                        _id: { $ne: swap._id }, // Exclude current swap
                        status: 'Pending',
                        $or: [
                            { 'requestedBook.id': { $in: allBookIds } },
                            { 'offeredBooks.id': { $in: allBookIds } }
                        ]
                    });
                    
                    console.log(`📋 Found ${otherPendingSwaps.length} other pending swaps to cancel`);
                    
                    // Cancel each swap with appropriate messaging
                    for (const otherSwap of otherPendingSwaps) {
                        otherSwap.status = 'Cancelled';
                        otherSwap.negotiationHistory.push({
                            from: null, // System action
                            fromName: 'System',
                            message: 'This swap request was automatically cancelled because one of the books involved was accepted in another swap.',
                            action: 'Cancel',
                            timestamp: new Date()
                        });
                        await otherSwap.save();
                        console.log(`❌ Cancelled swap ${otherSwap._id}`);
                    }
                    
                } catch (cancelError) {
                    console.error('❌ Error auto-cancelling other swaps:', cancelError);
                }

                // Mark books as swapped
                try {
                    const requestedBook = await Book.findById(swap.requestedBook.id);
                    if (requestedBook) {
                        requestedBook.availability = 'swapped';
                        await requestedBook.save();
                    }
                    if (swap.offeredBooks && swap.offeredBooks.length > 0) {
                        await Book.updateMany(
                            { _id: { $in: swap.offeredBooks.map(b => b.id) } },
                            { availability: 'swapped' }
                        );
                    }
                } catch (bookSwapError) {
                    console.error('Error updating book statuses on accept:', bookSwapError);
                }

            } else if (action === 'decline') {
                swap.status = 'Declined';
                
                // Add to negotiation history
                swap.negotiationHistory.push({
                    from: userId,
                    fromName: user.fullname,
                    message: message || 'Swap request declined',
                    action: 'Decline',
                    timestamp: new Date()
                });
                
                // Mark book as available again
                await Book.findByIdAndUpdate(swap.requestedBook.id, {
                    availability: 'available'
                });
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }
            
            swap.updatedAt = new Date();
            await swap.save();
            
            res.json({
                success: true,
                message: `Swap request ${action}ed successfully`,
                swap
            });
            
        } catch (error) {
            console.error('Respond to swap error:', error);
            res.status(500).json({ error: 'Failed to process swap response' });
        }
    }
    
    /**
     * Add message to swap negotiation
     */
    static async addNegotiationMessage(req, res) {
        try {
            const { swapId } = req.params;
            const { message, offeredBookIds } = req.body;
            const userId = req.session.user._id || req.session.user.id;
            
            const swap = await Swap.findById(swapId);
            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }
            
            // Verify user is part of this swap
            if (swap.requester.toString() !== userId && swap.owner.toString() !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            if (swap.status === 'Completed' || swap.status === 'Cancelled') {
                return res.status(400).json({ error: 'Cannot message completed/cancelled swap' });
            }
            
            const user = await User.findById(userId);
            
            // If counter offer with new books
            if (offeredBookIds && offeredBookIds.length > 0) {
                const books = await Book.find({
                    _id: { $in: offeredBookIds },
                    owner: userId,
                    availability: 'available'
                });
                
                swap.offeredBooks = books.map(book => ({
                    id: book._id,
                    title: book.title,
                    author: book.author
                }));
            }
            
            // Add to negotiation history
            swap.negotiationHistory.push({
                from: userId,
                fromName: user.fullname,
                message,
                action: offeredBookIds ? 'Counter Offer' : 'Message',
                timestamp: new Date()
            });
            
            swap.updatedAt = new Date();
            await swap.save();
            
            res.json({
                success: true,
                message: 'Message added successfully',
                swap
            });
            
        } catch (error) {
            console.error('Add negotiation message error:', error);
            res.status(500).json({ error: 'Failed to add message' });
        }
    }
    
    /**
     * Complete a swap
     */
    static async completeSwap(req, res) {
        try {
            const { swapId } = req.params;
            const { meetingConfirmed } = req.body;
            const userId = req.session.user._id || req.session.user.id;
            
            const swap = await Swap.findById(swapId);
            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }
            
            // Verify user is part of this swap
            if (swap.requester.toString() !== userId && swap.owner.toString() !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            if (swap.status !== 'Accepted' && swap.status !== 'In Progress' && swap.status !== 'Pending') {
                return res.status(400).json({ error: 'Swap cannot be completed' });
            }
            
            const user = await User.findById(userId);
            
            swap.status = 'Completed';
            swap.completedAt = new Date();
            
            // Add to negotiation history
            swap.negotiationHistory.push({
                from: userId,
                fromName: user.fullname,
                message: 'Swap completed successfully',
                action: 'Complete',
                timestamp: new Date()
            });
            
            // Update book statuses
            await Book.findByIdAndUpdate(swap.requestedBook.id, { availability: 'swapped' });
            
            // Update offered books if any
            if (swap.offeredBooks && swap.offeredBooks.length > 0) {
                await Book.updateMany({ _id: { $in: swap.offeredBooks.map(b => b.id) } }, { availability: 'swapped' });
            }
            
            await swap.save();
            
            res.json({
                success: true,
                message: 'Swap completed successfully!',
                swap
            });
            
        } catch (error) {
            console.error('Complete swap error:', error);
            res.status(500).json({ error: 'Failed to complete swap' });
        }
    }
    
    /**
     * Cancel a swap
     */
    static async cancelSwap(req, res) {
        try {
            const { swapId } = req.params;
            const { reason } = req.body;
            const userId = req.session.user._id || req.session.user.id;
            
            const swap = await Swap.findById(swapId);
            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }
            
            // Verify user is part of this swap
            if (swap.requester.toString() !== userId && swap.owner.toString() !== userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            if (swap.status === 'Completed' || swap.status === 'Cancelled') {
                return res.status(400).json({ error: 'Swap already finalized' });
            }
            
            const user = await User.findById(userId);
            
            swap.status = 'Cancelled';
            
            // Add to negotiation history
            swap.negotiationHistory.push({
                from: userId,
                fromName: user.fullname,
                message: reason || 'Swap cancelled',
                action: 'Cancel',
                timestamp: new Date()
            });
            
            // Mark book as available again
            await Book.findByIdAndUpdate(swap.requestedBook.id, {
                availability: 'available'
            });
            
            await swap.save();
            
            res.json({
                success: true,
                message: 'Swap cancelled successfully',
                swap
            });
            
        } catch (error) {
            console.error('Cancel swap error:', error);
            res.status(500).json({ error: 'Failed to cancel swap' });
        }
    }
    
    /**
     * Rate a completed swap
     */
    static async rateSwap(req, res) {
        try {
            const { swapId } = req.params;
            const { rating, comment } = req.body;
            const userId = req.session.user._id || req.session.user.id;
            
            const swap = await Swap.findById(swapId);
            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }
            
            if (swap.status !== 'Completed') {
                return res.status(400).json({ error: 'Can only rate completed swaps' });
            }
            
            // Determine if user is requester or owner
            let ratingField;
            if (swap.requester.toString() === userId) {
                ratingField = 'rating.requesterRating';
            } else if (swap.owner.toString() === userId) {
                ratingField = 'rating.ownerRating';
            } else {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            
            // Check if already rated
            if (swap.rating && swap.rating[ratingField.split('.')[1]]) {
                return res.status(400).json({ error: 'You have already rated this swap' });
            }
            
            const ratingData = {
                stars: parseInt(rating),
                comment: comment || '',
                timestamp: new Date()
            };
            
            await Swap.findByIdAndUpdate(swapId, {
                [`${ratingField}`]: ratingData
            });
            
            res.json({
                success: true,
                message: 'Rating submitted successfully'
            });
            
        } catch (error) {
            console.error('Rate swap error:', error);
            res.status(500).json({ error: 'Failed to submit rating' });
        }
    }

    /**
     * Get swap details (with negotiation history)
     */
    static async getSwapDetails(req, res) {
        try {
            const { swapId } = req.params;
            const userId = req.session.user._id || req.session.user.id;

            const swap = await Swap.findById(swapId)
                .populate('requester', 'fullname username photo')
                .populate('owner', 'fullname username photo')
                .populate('requestedBook.id', 'title author image')
                .lean();
            if (!swap) return res.status(404).json({ error: 'Swap not found' });
            if (String(swap.requester._id || swap.requester) !== String(userId) &&
                String(swap.owner._id || swap.owner) !== String(userId)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            return res.json({ swap });
        } catch (error) {
            console.error('Get swap details error:', error);
            return res.status(500).json({ error: 'Failed to fetch swap details' });
        }
    }
}

module.exports = SwapController;
