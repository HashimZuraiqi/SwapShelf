const express = require('express');
const router = express.Router();

// Simple in-memory message store (for immediate testing)
// In production, this should use MongoDB
const messages = new Map(); // chatId -> messages array
const users = new Map(); // userId -> user info

// Get or create a simple chat room
router.post('/room/create', async (req, res) => {
    try {
        const { user1, user2, roomName } = req.body;
        
        // Create a simple room ID
        const roomId = `${user1}_${user2}`.replace(/[^a-zA-Z0-9_]/g, '_');
        
        console.log('🏠 Creating simple chat room:', roomId);
        
        // Initialize room if it doesn't exist
        if (!messages.has(roomId)) {
            messages.set(roomId, []);
        }
        
        // Store user info
        users.set(user1, { name: user1, lastSeen: new Date() });
        users.set(user2, { name: user2, lastSeen: new Date() });
        
        res.json({
            success: true,
            roomId: roomId,
            message: 'Room created successfully'
        });
        
    } catch (error) {
        console.error('❌ Simple chat room creation error:', error);
        res.status(500).json({ error: 'Failed to create room' });
    }
});

// Send a message (no authentication required)
router.post('/message/send', async (req, res) => {
    try {
        const { roomId, sender, content } = req.body;
        
        if (!roomId || !sender || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        console.log('💬 Sending message in room:', roomId, 'from:', sender);
        
        // Get or create message array for room
        if (!messages.has(roomId)) {
            messages.set(roomId, []);
        }
        
        const roomMessages = messages.get(roomId);
        
        // Create new message
        const newMessage = {
            id: Date.now() + Math.random(),
            sender: sender,
            content: content.trim(),
            timestamp: new Date().toISOString(),
            read: false
        };
        
        // Add message to room
        roomMessages.push(newMessage);
        
        // Keep only last 100 messages per room
        if (roomMessages.length > 100) {
            roomMessages.splice(0, roomMessages.length - 100);
        }
        
        console.log('✅ Message sent successfully:', newMessage.id);
        
        res.json({
            success: true,
            message: newMessage,
            roomId: roomId
        });
        
    } catch (error) {
        console.error('❌ Simple message send error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Get messages for a room (no authentication required)
router.get('/messages/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { since } = req.query; // Optional: get messages since timestamp
        
        console.log('📨 Getting messages for room:', roomId);
        
        let roomMessages = messages.get(roomId) || [];
        
        // Filter messages if 'since' parameter provided
        if (since) {
            const sinceDate = new Date(since);
            roomMessages = roomMessages.filter(msg => new Date(msg.timestamp) > sinceDate);
        }
        
        console.log('✅ Returning', roomMessages.length, 'messages for room:', roomId);
        
        res.json({
            success: true,
            messages: roomMessages,
            roomId: roomId,
            count: roomMessages.length
        });
        
    } catch (error) {
        console.error('❌ Simple get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Get all rooms for a user (no authentication required)
router.get('/rooms/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🏠 Getting rooms for user:', userId);
        
        const userRooms = [];
        
        // Find all rooms that contain this user
        for (const [roomId, roomMessages] of messages.entries()) {
            if (roomId.includes(userId.replace(/[^a-zA-Z0-9_]/g, '_'))) {
                const lastMessage = roomMessages.length > 0 ? roomMessages[roomMessages.length - 1] : null;
                const unreadCount = roomMessages.filter(msg => msg.sender !== userId && !msg.read).length;
                
                // Extract other user from roomId
                const users = roomId.split('_');
                const otherUser = users.find(u => u !== userId.replace(/[^a-zA-Z0-9_]/g, '_'));
                
                userRooms.push({
                    roomId: roomId,
                    otherUser: otherUser,
                    lastMessage: lastMessage ? lastMessage.content : 'No messages yet',
                    lastMessageTime: lastMessage ? lastMessage.timestamp : null,
                    unreadCount: unreadCount,
                    messageCount: roomMessages.length
                });
            }
        }
        
        console.log('✅ Found', userRooms.length, 'rooms for user:', userId);
        
        res.json({
            success: true,
            rooms: userRooms,
            userId: userId
        });
        
    } catch (error) {
        console.error('❌ Simple get rooms error:', error);
        res.status(500).json({ error: 'Failed to get rooms' });
    }
});

// Mark messages as read
router.post('/messages/read', async (req, res) => {
    try {
        const { roomId, userId } = req.body;
        
        console.log('✅ Marking messages as read in room:', roomId, 'for user:', userId);
        
        const roomMessages = messages.get(roomId) || [];
        
        // Mark all messages from other users as read
        roomMessages.forEach(msg => {
            if (msg.sender !== userId) {
                msg.read = true;
            }
        });
        
        res.json({
            success: true,
            message: 'Messages marked as read'
        });
        
    } catch (error) {
        console.error('❌ Mark messages read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const stats = {
        totalRooms: messages.size,
        totalUsers: users.size,
        totalMessages: Array.from(messages.values()).reduce((sum, msgs) => sum + msgs.length, 0),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
    
    console.log('📊 Simple chat health check:', stats);
    res.json({ success: true, stats });
});

module.exports = router;