const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth'); // Updated to use session-based auth

// Chat room model (we'll create this)
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');

// Search users for chat
router.get('/api/users/search', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ users: [] });
        }
        
        const currentUserId = req.session.user._id || req.session.user.id;
        
        const users = await User.find({
            $and: [
                { _id: { $ne: currentUserId } }, // Exclude current user
                {
                    $or: [
                        { username: { $regex: q, $options: 'i' } },
                        { fullname: { $regex: q, $options: 'i' } }
                    ]
                }
            ]
        })
        .select('username fullname profileImage')
        .limit(10);
        
        res.json({ users });
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user data for chat
router.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        const user = await User.findById(userId)
            .select('username fullname profileImage');
        
        if (!user) {
            // Return session data if DB user not found
            return res.json({
                _id: req.session.user._id || req.session.user.id,
                username: req.session.user.username,
                fullname: req.session.user.fullname,
                profileImage: req.session.user.profileImage || '/images/default-avatar.png'
            });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error getting user data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get chat rooms for current user with pagination and search
router.get('/api/chat/rooms', requireAuth, async (req, res) => {
    try {
        const currentUserId = req.session.user._id || req.session.user.id;
        
        // Extract pagination and search parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const searchQuery = req.query.search || '';
        const skip = (page - 1) * limit;
        
        console.log('📊 Chat rooms request:', { currentUserId, page, limit, searchQuery, skip });
        
        // Build the base query
        let query = { participants: currentUserId };
        
        // Get total count for pagination (before search filtering)
        const totalCount = await ChatRoom.countDocuments(query);
        
        // Get chat rooms with pagination
        let chatRooms = await ChatRoom.find(query)
            .populate({
                path: 'participants',
                select: 'username fullname profileImage'
            })
            .populate({
                path: 'lastMessage',
                select: 'content createdAt sender'
            })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // If searching, filter the results after population
        if (searchQuery) {
            console.log('🔍 Filtering chat rooms with search query:', searchQuery);
            chatRooms = chatRooms.filter(room => {
                const otherUser = room.participants.find(p => p._id.toString() !== currentUserId.toString());
                if (!otherUser) return false;
                
                const searchLower = searchQuery.toLowerCase();
                const matchesSearch = 
                    (otherUser.username && otherUser.username.toLowerCase().includes(searchLower)) ||
                    (otherUser.fullname && otherUser.fullname.toLowerCase().includes(searchLower));
                
                console.log(`🔍 Checking user ${otherUser.fullname || otherUser.username}: ${matchesSearch}`);
                return matchesSearch;
            });
            console.log(`🔍 Search filtered results: ${chatRooms.length} rooms found`);
        }
        
        // Format the response
        const rooms = chatRooms.map(room => {
            const otherUser = room.participants.find(p => p._id.toString() !== currentUserId.toString());
            return {
                _id: room._id,
                otherUser: {
                    id: otherUser._id,
                    name: otherUser.fullname || otherUser.username,
                    avatar: otherUser.profileImage || '/images/default-avatar.png'
                },
                lastMessage: room.lastMessage ? room.lastMessage.content : null,
                updatedAt: room.updatedAt,
                unreadCount: 0 // TODO: Implement unread count
            };
        });
        
        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;
        
        // Return paginated response
        res.json({
            conversations: rooms,
            currentPage: page,
            totalPages: totalPages,
            totalCount: totalCount,
            hasMore: hasMore
        });
        
        console.log('✅ Chat rooms response:', {
            roomsCount: rooms.length,
            currentPage: page,
            totalPages: totalPages,
            totalCount: totalCount
        });
    } catch (error) {
        console.error('Error fetching chat rooms:', error);
        res.status(500).json({
            conversations: [],
            currentPage: 1,
            totalPages: 0,
            totalCount: 0,
            hasMore: false,
            error: 'Failed to fetch conversations'
        });
    }
});

// Get messages for a specific chat room
router.get('/api/chat/rooms/:roomId/messages', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const currentUserId = req.session.user._id || req.session.user.id;
        
        // Verify user is participant in this room
        const room = await ChatRoom.findOne({
            _id: roomId,
            participants: currentUserId
        });
        
        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }
        
        const messages = await Message.find({ chatRoom: roomId })
            .populate('sender', 'username fullname profileImage')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        res.json(messages.reverse()); // Reverse to show oldest first
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create or get chat room with another user
router.post('/api/chat/rooms', requireAuth, async (req, res) => {
    try {
        const { otherUserId } = req.body;
        const currentUserId = req.session.user._id || req.session.user.id;
        
        if (!otherUserId || otherUserId === currentUserId.toString()) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        console.log('🔄 Creating/getting chat room between:', currentUserId, 'and', otherUserId);
        
        // Check if chat room already exists
        let chatRoom = await ChatRoom.findOne({
            participants: { $all: [currentUserId, otherUserId] }
        }).populate('participants', 'username fullname profileImage');
        
        if (chatRoom) {
            console.log('✅ Found existing chat room:', chatRoom._id);
            return res.json(chatRoom);
        }
        
        // Create new chat room
        console.log('🆕 Creating new chat room');
        chatRoom = new ChatRoom({
            participants: [currentUserId, otherUserId]
        });
        
        await chatRoom.save();
        console.log('✅ Chat room created with ID:', chatRoom._id);
        
        // Populate the participants
        chatRoom = await ChatRoom.findById(chatRoom._id)
            .populate('participants', 'username fullname profileImage');
            
        res.json(chatRoom);
    } catch (error) {
        console.error('❌ Error creating/getting chat room:', error);
        
        // Handle duplicate key error by trying to find existing room
        if (error.code === 11000) {
            try {
                console.log('🔍 Duplicate key error, searching for existing room...');
                const { otherUserId } = req.body;
                const currentUserId = req.session.user._id || req.session.user.id;
                
                const existingRoom = await ChatRoom.findOne({
                    participants: { $all: [currentUserId, otherUserId] }
                }).populate('participants', 'username fullname profileImage');
                
                if (existingRoom) {
                    console.log('✅ Found existing room after duplicate error:', existingRoom._id);
                    return res.json(existingRoom);
                }
            } catch (findError) {
                console.error('❌ Error finding existing room:', findError);
            }
        }
        
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send a message
router.post('/api/chat/rooms/:roomId/messages', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { content } = req.body;
        const currentUserId = req.session.user._id || req.session.user.id;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        // Verify user is participant in this room
        const room = await ChatRoom.findOne({
            _id: roomId,
            participants: currentUserId
        });
        
        if (!room) {
            return res.status(404).json({ error: 'Chat room not found' });
        }
        
        // Create the message
        const message = new Message({
            chatRoom: roomId,
            sender: currentUserId,
            content: content.trim()
        });
        
        await message.save();
        
        // Update room's last message and updatedAt
        room.lastMessage = message._id;
        room.updatedAt = new Date();
        await room.save();
        
        // Populate sender info for response
        await message.populate('sender', 'username fullname profileImage');
        
        res.json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ===== SWAP-SPECIFIC CHAT ENDPOINTS =====

// Get or create chat for a specific swap
router.get('/api/chat/swap/:swapId', requireAuth, async (req, res) => {
    try {
        const { swapId } = req.params;
        const currentUserId = req.session.user._id || req.session.user.id;
        
        console.log('📋 Getting chat for swap:', swapId);
        
        // Get the swap details
        const Swap = require('../models/Swap');
        const swap = await Swap.findById(swapId)
            .populate('requester', 'username fullname profileImage')
            .populate('owner', 'username fullname profileImage')
            .populate('requestedBook.id', 'title author coverImage image')
            .populate('offeredBooks.id', 'title author coverImage image');
        
        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }
        
        // Verify user is part of this swap
        if (swap.requester._id.toString() !== currentUserId.toString() && 
            swap.owner._id.toString() !== currentUserId.toString()) {
            return res.status(403).json({ error: 'Unauthorized access to this swap chat' });
        }
        
        // Determine the other user
        const otherUserId = swap.requester._id.toString() === currentUserId.toString() 
            ? swap.owner._id 
            : swap.requester._id;
        
        console.log('👥 Chat participants:', { currentUserId, otherUserId });
        
        // Find or create chat room between these users
        let chatRoom = await ChatRoom.findOne({
            participants: { $all: [currentUserId, otherUserId] }
        });
        
        if (!chatRoom) {
            console.log('🆕 Creating new chat room for swap');
            chatRoom = new ChatRoom({
                participants: [currentUserId, otherUserId]
            });
            await chatRoom.save();
        }
        
        // Get messages for this chat room
        const messages = await Message.find({ chatRoom: chatRoom._id })
            .populate('sender', 'username fullname profileImage')
            .sort({ createdAt: 1 })
            .limit(100);
        
        console.log('✅ Found', messages.length, 'messages for swap chat');
        
        // Return chat data with swap context
        res.json({
            chat: {
                _id: chatRoom._id,
                messages: messages
            },
            swap: {
                _id: swap._id,
                status: swap.status,
                requester: swap.requester,
                owner: swap.owner,
                requestedBook: swap.requestedBook,
                offeredBooks: swap.offeredBooks
            }
        });
        
    } catch (error) {
        console.error('❌ Error getting swap chat:', error);
        res.status(500).json({ error: 'Failed to load chat' });
    }
});

// Send a message in swap chat
router.post('/api/chat/swap/:swapId/message', requireAuth, async (req, res) => {
    try {
        const { swapId } = req.params;
        const { content } = req.body;
        const currentUserId = req.session.user._id || req.session.user.id;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        console.log('💬 Sending message in swap chat:', swapId);
        
        // Get the swap details
        const Swap = require('../models/Swap');
        const swap = await Swap.findById(swapId);
        
        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }
        
        // Verify user is part of this swap
        if (swap.requester.toString() !== currentUserId.toString() && 
            swap.owner.toString() !== currentUserId.toString()) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Determine the other user
        const otherUserId = swap.requester.toString() === currentUserId.toString() 
            ? swap.owner 
            : swap.requester;
        
        // Find or create chat room
        let chatRoom = await ChatRoom.findOne({
            participants: { $all: [currentUserId, otherUserId] }
        });
        
        if (!chatRoom) {
            chatRoom = new ChatRoom({
                participants: [currentUserId, otherUserId]
            });
            await chatRoom.save();
        }
        
        // Create the message
        const message = new Message({
            chatRoom: chatRoom._id,
            sender: currentUserId,
            content: content.trim()
        });
        
        await message.save();
        
        // Update room's last message
        chatRoom.lastMessage = message._id;
        chatRoom.updatedAt = new Date();
        await chatRoom.save();
        
        // Populate sender info
        await message.populate('sender', 'username fullname profileImage');
        
        console.log('✅ Message sent successfully');
        
        res.json({
            success: true,
            message: message
        });
        
    } catch (error) {
        console.error('❌ Error sending swap message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;