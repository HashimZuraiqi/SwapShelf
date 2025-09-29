const express = require('express');
const Chat = require('../models/Chat');
const Swap = require('../models/Swap');
const Book = require('../models/Book');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Create or get direct chat between users for potential swap
router.post('/direct', requireAuth, async (req, res) => {
    console.log('🚀 POST /api/chat/direct hit with body:', req.body);
    console.log('👤 User ID:', req.session.user._id || req.session.user.id);
    
    try {
        const { offeredBookId, requestedBookId, message } = req.body;
        const userId = req.session.user._id || req.session.user.id;
        
        if (!offeredBookId || !requestedBookId) {
            return res.status(400).json({ message: 'Both book IDs are required' });
        }
        
        // Get books and verify ownership
        const [offeredBook, requestedBook] = await Promise.all([
            Book.findById(offeredBookId).populate('owner', 'username fullname'),
            Book.findById(requestedBookId).populate('owner', 'username fullname')
        ]);
        
        if (!offeredBook || !requestedBook) {
            return res.status(404).json({ message: 'Books not found' });
        }
        
        if (offeredBook.owner._id.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'You can only offer your own books' });
        }
        
        const otherUserId = requestedBook.owner._id;
        const currentUser = await User.findById(userId);
        
        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Check for existing swap between these books
        let existingSwap = await Swap.findOne({
            requester: userId,
            'requestedBook.id': requestedBookId,
            'offeredBooks.id': offeredBookId,
            status: { $in: ['Pending', 'Accepted', 'In Progress'] }
        });
        
        if (!existingSwap) {
            // Create a new swap request
            existingSwap = new Swap({
                requester: userId,
                requesterName: currentUser.fullname,
                owner: otherUserId,
                ownerName: requestedBook.owner.fullname,
                requestedBook: {
                    id: requestedBook._id,
                    title: requestedBook.title,
                    author: requestedBook.author
                },
                offeredBooks: [{
                    id: offeredBook._id,
                    title: offeredBook.title,
                    author: offeredBook.author
                }],
                message: message || 'Hi! I\'m interested in swapping books with you.',
                status: 'Pending',
                negotiationHistory: [{
                    from: userId,
                    fromName: currentUser.fullname,
                    message: message || 'Initial chat request',
                    action: 'Message',
                    timestamp: new Date()
                }]
            });
            
            await existingSwap.save();
            
            // Update book stats
            await Book.findByIdAndUpdate(requestedBookId, {
                $inc: { 'stats.swapRequests': 1 }
            });
        }
        
        // Return the swap ID for chat
        res.status(201).json({
            success: true,
            message: 'Chat initialized successfully!',
            swapId: existingSwap._id,
            swap: existingSwap
        });
        
    } catch (error) {
        console.error('Create direct chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get chat for a specific swap
router.get('/swap/:swapId', requireAuth, async (req, res) => {
    try {
        const { swapId } = req.params;
        const userId = req.session.user._id || req.session.user.id;
        
        // Verify user is part of the swap
        const swap = await Swap.findById(swapId)
            .populate('requester', 'username fullname')
            .populate('owner', 'username fullname');
            
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }
        
        const isParticipant = swap.requester._id.toString() === userId.toString() || 
                             swap.owner._id.toString() === userId.toString();
                             
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        let chat = await Chat.findOne({ swapId })
            .populate('messages.sender', 'username fullname')
            .populate('participants', 'username fullname');
            
        if (!chat) {
            // Create chat if it doesn't exist
            chat = new Chat({
                swapId,
                participants: [swap.requester._id, swap.owner._id],
                messages: []
            });
            await chat.save();
            
            // Populate the new chat
            chat = await Chat.findById(chat._id)
                .populate('messages.sender', 'username fullname')
                .populate('participants', 'username fullname');
        }
        
        // Mark messages as read for current user
        const hasUnread = chat.messages.some(msg => 
            !msg.read && msg.sender._id.toString() !== userId.toString()
        );
        
        if (hasUnread) {
            chat.messages.forEach(msg => {
                if (msg.sender._id.toString() !== userId.toString()) {
                    msg.read = true;
                }
            });
            await chat.save();
        }
        
        res.json({ 
            chat, 
            swap: {
                _id: swap._id,
                offeredBook: swap.offeredBook,
                requestedBook: swap.requestedBook,
                status: swap.status,
                requester: swap.requester,
                owner: swap.owner
            }
        });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send message
router.post('/swap/:swapId/message', requireAuth, async (req, res) => {
    try {
        const { swapId } = req.params;
        const { content } = req.body;
        const userId = req.session.user._id || req.session.user.id;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Message content is required' });
        }
        
        if (content.length > 1000) {
            return res.status(400).json({ message: 'Message too long' });
        }
        
        // Verify user is part of the swap
        const swap = await Swap.findById(swapId);
        if (!swap) {
            return res.status(404).json({ message: 'Swap not found' });
        }
        
        const isParticipant = swap.requester.toString() === userId.toString() || 
                             swap.owner.toString() === userId.toString();
                             
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied' });
        }
        
        let chat = await Chat.findOne({ swapId });
        if (!chat) {
            chat = new Chat({
                swapId,
                participants: [swap.requester, swap.owner],
                messages: []
            });
        }
        
        // Add message
        chat.messages.push({
            sender: userId,
            content: content.trim(),
            read: false
        });
        
        chat.lastActivity = new Date();
        await chat.save();
        
        // Populate the new message
        const populatedChat = await Chat.findById(chat._id)
            .populate('messages.sender', 'username fullname');
            
        const newMessage = populatedChat.messages[populatedChat.messages.length - 1];
        
        res.json({ message: newMessage });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;