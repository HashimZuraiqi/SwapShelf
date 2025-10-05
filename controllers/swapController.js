const Swap = require('../models/Swap');
const Book = require('../models/Book');
const User = require('../models/User');
const Activity = require('../models/Activity');

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
            
            // Check for existing active request from this user to book owner
            const existingRequest = await Swap.findOne({
                requester: requesterId,
                'requestedBook.id': requestedBookId,
                status: { $in: ['Pending', 'Accepted', 'In Progress'] }
            });
            
            if (existingRequest) {
                return res.status(400).json({ error: 'You already have an active request for this book' });
            }
            
            // Check for reverse swap request (prevent duplicate swaps between same users)
            const reverseSwapRequest = await Swap.findOne({
                requester: requestedBook.owner._id,
                owner: requesterId,
                status: { $in: ['Pending', 'Accepted', 'In Progress'] }
            });
            
            if (reverseSwapRequest) {
                return res.status(400).json({ 
                    error: 'There is already an active swap between you and this user. Please check your incoming requests or active swaps.' 
                });
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
            
            // Mark requested book as unavailable during negotiation
            await Book.findByIdAndUpdate(requestedBookId, {
                availability: 'unavailable'
            });
            
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
                    .populate('requester', 'fullname username photo profilePicture')
                    .populate('owner', 'fullname username photo profilePicture')
                    .populate('requestedBook.id', 'title author coverImage image')
                    .populate('offeredBooks.id', 'title author coverImage image')
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

                // Optional immediate ownership swap: mark statuses as swapped and exchange owners
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
            const reason = req.body?.reason || 'Swap cancelled by user';
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

    /**
     * Schedule a meeting for book exchange
     */
    static async scheduleMeeting(req, res) {
        console.log('📅 SCHEDULE MEETING STARTED');
        console.log('Request body:', req.body);
        
        try {
            const { swapId } = req.params;
            const { location, datetime, notes } = req.body;
            const userId = req.session.user._id || req.session.user.id;

            // Validate required fields
            if (!location || !datetime) {
                return res.status(400).json({ 
                    error: 'Location and datetime are required' 
                });
            }

            // Find the swap
            const swap = await Swap.findById(swapId)
                .populate('requester', 'fullname username email')
                .populate('owner', 'fullname username email')
                .populate('requestedBook.id', 'title author');

            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }

            // Verify user is part of this swap
            const isRequester = String(swap.requester._id || swap.requester) === String(userId);
            const isOwner = String(swap.owner._id || swap.owner) === String(userId);

            if (!isRequester && !isOwner) {
                return res.status(403).json({ error: 'Unauthorized - You are not part of this swap' });
            }

            // Verify swap is in accepted or in-progress status (can schedule meetings for active swaps)
            const allowedStatuses = ['Accepted', 'In Progress'];
            if (!allowedStatuses.includes(swap.status)) {
                return res.status(400).json({ 
                    error: 'Can only schedule meetings for accepted or in-progress swaps',
                    currentStatus: swap.status
                });
            }

            // Validate datetime is in the future
            const meetingDate = new Date(datetime);
            if (meetingDate <= new Date()) {
                return res.status(400).json({ 
                    error: 'Meeting time must be in the future' 
                });
            }

            // Update swap with meeting details
            swap.meetingDetails = {
                location: location.trim(),
                datetime: meetingDate,
                notes: notes ? notes.trim() : '',
                confirmed: false
            };

            // Optionally update status to "in progress"
            // swap.status = 'In Progress';

            await swap.save();

            console.log('✅ Meeting scheduled successfully:', swap.meetingDetails);

            // Determine who is the other party for notification
            const otherParty = isRequester ? swap.owner : swap.requester;
            const currentUser = isRequester ? swap.requester : swap.owner;
            const bookTitle = swap.requestedBook?.id?.title || swap.requestedBook?.title || 'the book';

            console.log('📧 Sending notification to:', {
                otherPartyName: otherParty.fullname || otherParty.username,
                otherPartyEmail: otherParty.email,
                scheduledBy: currentUser.fullname || currentUser.username
            });

            // Create activity notification for the other party
            try {
                const formattedDateTime = meetingDate.toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                await Activity.create({
                    user: otherParty._id,
                    action: 'MATCH_SWAP',
                    message: `${currentUser.fullname || currentUser.username} scheduled a meeting for "${bookTitle}" on ${formattedDateTime} at ${location.trim()}`,
                    entityType: 'Swap',
                    entityId: swap._id,
                    meta: {
                        swapId: swap._id,
                        scheduledBy: userId,
                        location: location.trim(),
                        datetime: meetingDate,
                        bookTitle
                    }
                });

                console.log('✅ Activity notification created for', otherParty.username);
            } catch (activityError) {
                console.error('⚠️ Failed to create activity notification:', activityError);
                // Don't fail the whole request if activity logging fails
            }

            // TODO: Send email notification to the other party
            // You can implement email/push notification here
            // Example:
            // await sendMeetingNotification({
            //     to: otherParty.email,
            //     swapId: swap._id,
            //     bookTitle,
            //     location: swap.meetingDetails.location,
            //     datetime: swap.meetingDetails.datetime,
            //     scheduledBy: currentUser.fullname || currentUser.username
            // });

            // Format the response with user-friendly date
            const formattedDate = meetingDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            res.json({
                success: true,
                message: `Meeting scheduled successfully! ${otherParty.fullname || otherParty.username} will be notified.`,
                swap: {
                    _id: swap._id,
                    status: swap.status,
                    meetingDetails: swap.meetingDetails,
                    formattedDate
                },
                notification: {
                    sent: true,
                    recipient: otherParty.fullname || otherParty.username,
                    message: `${currentUser.fullname || currentUser.username} scheduled a meeting for exchanging "${bookTitle}" on ${formattedDate} at ${location}`
                }
            });

        } catch (error) {
            console.error('❌ Schedule meeting error:', error);
            res.status(500).json({ 
                error: 'Failed to schedule meeting',
                details: error.message 
            });
        }
    }

    /**
     * Confirm meeting attendance
     */
    static async confirmMeeting(req, res) {
        console.log('✅ CONFIRM MEETING STARTED');
        
        try {
            const { swapId } = req.params;
            const userId = req.session.user._id || req.session.user.id;

            // Find the swap
            const swap = await Swap.findById(swapId)
                .populate('requester', 'fullname username email')
                .populate('owner', 'fullname username email')
                .populate('requestedBook.id', 'title author');

            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }

            // Verify user is part of this swap
            const isRequester = String(swap.requester._id || swap.requester) === String(userId);
            const isOwner = String(swap.owner._id || swap.owner) === String(userId);

            if (!isRequester && !isOwner) {
                return res.status(403).json({ error: 'Unauthorized - You are not part of this swap' });
            }

            // Check if meeting exists
            if (!swap.meetingDetails || !swap.meetingDetails.datetime) {
                return res.status(400).json({ 
                    error: 'No meeting scheduled for this swap' 
                });
            }

            // Check if already confirmed
            if (swap.meetingDetails.confirmed) {
                return res.json({
                    success: true,
                    message: 'Meeting already confirmed',
                    swap: {
                        _id: swap._id,
                        meetingDetails: swap.meetingDetails
                    }
                });
            }

            // Confirm the meeting
            swap.meetingDetails.confirmed = true;
            await swap.save();

            console.log('✅ Meeting confirmed:', swap.meetingDetails);

            // Notify the other party
            const otherParty = isRequester ? swap.owner : swap.requester;
            const currentUser = isRequester ? swap.requester : swap.owner;
            const bookTitle = swap.requestedBook?.id?.title || swap.requestedBook?.title || 'the book';

            // Create activity notification
            try {
                const formattedDateTime = new Date(swap.meetingDetails.datetime).toLocaleDateString('en-US', { 
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                await Activity.create({
                    user: otherParty._id,
                    action: 'MATCH_SWAP',
                    message: `${currentUser.fullname || currentUser.username} confirmed the meeting for "${bookTitle}" on ${formattedDateTime}`,
                    entityType: 'Swap',
                    entityId: swap._id,
                    meta: {
                        swapId: swap._id,
                        confirmedBy: userId,
                        meetingConfirmed: true,
                        bookTitle
                    }
                });

                console.log('✅ Confirmation notification created for', otherParty.username);
            } catch (activityError) {
                console.error('⚠️ Failed to create activity notification:', activityError);
            }

            res.json({
                success: true,
                message: `Meeting confirmed! ${otherParty.fullname || otherParty.username} has been notified.`,
                swap: {
                    _id: swap._id,
                    status: swap.status,
                    meetingDetails: swap.meetingDetails
                }
            });

        } catch (error) {
            console.error('❌ Confirm meeting error:', error);
            res.status(500).json({ 
                error: 'Failed to confirm meeting',
                details: error.message 
            });
        }
    }

    /**
     * Confirm book received - User confirms they received their book from the swap
     */
    static async confirmBookReceived(req, res) {
        console.log('📦 CONFIRM BOOK RECEIVED STARTED');
        
        try {
            const { swapId } = req.params;
            const userId = req.session.user._id || req.session.user.id;

            // Find the swap
            const swap = await Swap.findById(swapId)
                .populate('requester', 'fullname username email')
                .populate('owner', 'fullname username email')
                .populate('requestedBook.id', 'title author')
                .populate('offeredBooks.id', 'title author');

            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }

            // Verify user is part of this swap
            const isRequester = String(swap.requester._id || swap.requester) === String(userId);
            const isOwner = String(swap.owner._id || swap.owner) === String(userId);

            if (!isRequester && !isOwner) {
                return res.status(403).json({ error: 'Unauthorized - You are not part of this swap' });
            }

            // Check if swap is in the right status
            if (swap.status !== 'In Progress') {
                return res.status(400).json({ 
                    error: 'Can only confirm receipt for swaps in progress',
                    currentStatus: swap.status
                });
            }

            // Initialize receivedConfirmation if it doesn't exist
            if (!swap.receivedConfirmation) {
                swap.receivedConfirmation = {
                    requesterConfirmed: false,
                    ownerConfirmed: false
                };
            }

            // Check if user already confirmed
            if (isRequester && swap.receivedConfirmation.requesterConfirmed) {
                return res.json({
                    success: true,
                    message: 'You have already confirmed receipt',
                    bothConfirmed: swap.receivedConfirmation.ownerConfirmed,
                    swap: {
                        _id: swap._id,
                        status: swap.status,
                        receivedConfirmation: swap.receivedConfirmation
                    }
                });
            }

            if (isOwner && swap.receivedConfirmation.ownerConfirmed) {
                return res.json({
                    success: true,
                    message: 'You have already confirmed receipt',
                    bothConfirmed: swap.receivedConfirmation.requesterConfirmed,
                    swap: {
                        _id: swap._id,
                        status: swap.status,
                        receivedConfirmation: swap.receivedConfirmation
                    }
                });
            }

            // Confirm receipt for this user
            if (isRequester) {
                swap.receivedConfirmation.requesterConfirmed = true;
                swap.receivedConfirmation.requesterConfirmedAt = new Date();
            } else {
                swap.receivedConfirmation.ownerConfirmed = true;
                swap.receivedConfirmation.ownerConfirmedAt = new Date();
            }

            // Check if both parties have confirmed
            const bothConfirmed = swap.receivedConfirmation.requesterConfirmed && 
                                  swap.receivedConfirmation.ownerConfirmed;

            // If both confirmed, move to verification/completion stage
            if (bothConfirmed) {
                swap.status = 'Completed';
                swap.completedAt = new Date();
                
                // Update book statuses
                await Book.findByIdAndUpdate(swap.requestedBook.id, { availability: 'swapped' });
                
                if (swap.offeredBooks && swap.offeredBooks.length > 0) {
                    await Book.updateMany(
                        { _id: { $in: swap.offeredBooks.map(b => b.id) } }, 
                        { availability: 'swapped' }
                    );
                }
            }

            await swap.save();

            console.log('📦 Receipt confirmed:', {
                swapId,
                userId,
                isRequester,
                bothConfirmed
            });

            // Notify the other party
            const otherParty = isRequester ? swap.owner : swap.requester;
            const currentUser = isRequester ? swap.requester : swap.owner;
            const bookTitle = swap.requestedBook?.id?.title || swap.requestedBook?.title || 'the book';

            // Create activity notification
            try {
                const message = bothConfirmed 
                    ? `Swap completed! Both parties confirmed receiving their books for "${bookTitle}". You earned 10 reward points! 🎉`
                    : `${currentUser.fullname || currentUser.username} confirmed receiving their book for "${bookTitle}". Waiting for your confirmation.`;

                await Activity.create({
                    user: otherParty._id,
                    action: bothConfirmed ? 'COMPLETE_SWAP' : 'MATCH_SWAP',
                    message: message,
                    entityType: 'Swap',
                    entityId: swap._id,
                    meta: {
                        swapId: swap._id,
                        confirmedBy: userId,
                        bookReceived: true,
                        bothConfirmed,
                        bookTitle
                    }
                });

                console.log('✅ Receipt notification created for', otherParty.username);

                // Award points if completed
                if (bothConfirmed) {
                    await User.findByIdAndUpdate(swap.requester._id, { $inc: { points: 10 } });
                    await User.findByIdAndUpdate(swap.owner._id, { $inc: { points: 10 } });
                    console.log('🎁 10 points awarded to both parties');
                }

            } catch (activityError) {
                console.error('⚠️ Failed to create activity notification:', activityError);
            }

            res.json({
                success: true,
                message: bothConfirmed 
                    ? '🎉 Swap completed! Both parties have confirmed. You earned 10 reward points!'
                    : `Receipt confirmed! Waiting for ${otherParty.fullname || otherParty.username} to confirm their receipt.`,
                bothConfirmed,
                completed: bothConfirmed,
                swap: {
                    _id: swap._id,
                    status: swap.status,
                    receivedConfirmation: swap.receivedConfirmation,
                    completedAt: swap.completedAt
                }
            });

        } catch (error) {
            console.error('❌ Confirm book received error:', error);
            res.status(500).json({ 
                error: 'Failed to confirm book receipt',
                details: error.message 
            });
        }
    }

    /**
     * Mark swap as In Progress - Allows user to manually mark swap as in progress after exchanging books
     */
    static async markAsInProgress(req, res) {
        console.log('📦 MARK AS IN PROGRESS STARTED');
        
        try {
            const { swapId } = req.params;
            const userId = req.session.user._id || req.session.user.id;

            // Find the swap
            const swap = await Swap.findById(swapId)
                .populate('requester', 'fullname username email')
                .populate('owner', 'fullname username email')
                .populate('requestedBook.id', 'title author');

            if (!swap) {
                return res.status(404).json({ error: 'Swap not found' });
            }

            // Verify user is part of this swap
            const isRequester = String(swap.requester._id || swap.requester) === String(userId);
            const isOwner = String(swap.owner._id || swap.owner) === String(userId);

            if (!isRequester && !isOwner) {
                return res.status(403).json({ error: 'Unauthorized - You are not part of this swap' });
            }

            // Can only mark as "In Progress" if currently "Accepted"
            if (swap.status !== 'Accepted') {
                return res.status(400).json({ 
                    error: `Cannot mark as In Progress. Current status is "${swap.status}". Only "Accepted" swaps can be marked as In Progress.` 
                });
            }

            // Update status
            swap.status = 'In Progress';
            await swap.save();

            console.log('📦 Swap marked as In Progress:', {
                swapId,
                userId,
                previousStatus: 'Accepted',
                newStatus: 'In Progress'
            });

            // Notify the other party
            const otherParty = isRequester ? swap.owner : swap.requester;
            const currentUser = isRequester ? swap.requester : swap.owner;
            const bookTitle = swap.requestedBook?.id?.title || swap.requestedBook?.title || 'the book';

            // Create activity notification
            try {
                await Activity.create({
                    user: otherParty._id,
                    action: 'MATCH_SWAP',
                    message: `${currentUser.fullname || currentUser.username} marked your swap for "${bookTitle}" as In Progress. You can now confirm when you receive your book! 📦`,
                    entityType: 'Swap',
                    entityId: swap._id,
                    meta: {
                        swapId: swap._id,
                        markedBy: userId,
                        bookTitle
                    }
                });

                console.log('✅ In Progress notification created for', otherParty.username);

            } catch (activityError) {
                console.error('⚠️ Failed to create activity notification:', activityError);
            }

            res.json({
                success: true,
                status: 'In Progress',
                message: 'Swap marked as In Progress! You can now confirm when you receive your book. 📦'
            });

        } catch (error) {
            console.error('❌ MARK AS IN PROGRESS ERROR:', error);
            res.status(500).json({ 
                error: 'Failed to mark swap as In Progress',
                details: error.message 
            });
        }
    }
}

module.exports = SwapController;
