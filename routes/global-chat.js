const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat'); // We'll use the existing Chat model
const SimpleChat = require('../models/SimpleChat'); // For simple chats
const User = require('../models/User');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');

// Create a new chat conversation
router.post('/create', requireAuth, async (req, res) => {
    try {
        console.log('🚀 Global chat API: Create chat request received:', req.body);
        const { user1, user2, offeredBook, requestedBook, context } = req.body;
        
        if (!user1 || !user2) {
            console.log('❌ Global chat API: Missing users:', { user1, user2 });
            return res.status(400).json({ error: 'Both users are required' });
        }
        
        // Check if conversation already exists
        let existingChat = await SimpleChat.findOne({
            $or: [
                { user1, user2 },
                { user1: user2, user2: user1 }
            ]
        });
        
        if (existingChat) {
            console.log('📋 Global chat API: Found existing chat:', existingChat._id);
            return res.json({ 
                chatId: existingChat._id, 
                existing: true,
                message: 'Conversation already exists' 
            });
        }
        
        console.log('🆕 Global chat API: Creating new chat for users:', user1, 'and', user2);
        
        // Create new chat
        const newChat = new SimpleChat({
            user1,
            user2,
            offeredBook,
            requestedBook,
            context: context || `Book swap: ${offeredBook} ↔ ${requestedBook}`,
            messages: [],
            createdAt: new Date(),
            lastActivity: new Date()
        });
        
        await newChat.save();
        
        console.log('✅ Global chat API: Chat created successfully:', newChat._id);
        res.json({ 
            chatId: newChat._id, 
            message: 'Chat created successfully' 
        });
        
    } catch (error) {
        console.error('❌ Global chat API: Create chat error:', error);
        res.status(500).json({ error: 'Failed to create chat: ' + error.message });
    }
});

// Get all conversations for current user
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        // requireAuth middleware ensures req.session.user exists
        const currentUser = req.session.user.username || req.session.user.name || req.session.user.email;
        
        // Find all chats where user is participant
        const chats = await SimpleChat.find({
            $or: [
                { user1: currentUser },
                { user2: currentUser }
            ]
        }).sort({ lastActivity: -1 });
        
        const conversations = await Promise.all(chats.map(async (chat) => {
            const otherUser = chat.user1 === currentUser ? chat.user2 : chat.user1;
            const lastMessage = chat.messages.length > 0 ? 
                chat.messages[chat.messages.length - 1].content : 
                'No messages yet';
            const lastMessageTime = chat.messages.length > 0 ? 
                chat.messages[chat.messages.length - 1].timestamp : 
                chat.createdAt;
            
            // Count unread messages
            const unreadCount = chat.messages.filter(msg => 
                msg.sender !== currentUser && !msg.readBy?.includes(currentUser)
            ).length;
            
            return {
                id: chat._id,
                otherUser,
                context: chat.context,
                lastMessage,
                lastMessageTime,
                unreadCount,
                offeredBook: chat.offeredBook,
                requestedBook: chat.requestedBook
            };
        }));
        
        res.json({ conversations });
        
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to load conversations' });
    }
});

// Get messages for a specific chat
router.get('/:chatId/messages', requireAuth, async (req, res) => {
    try {
        const { chatId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        const chat = await SimpleChat.findById(chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Verify user has access to this chat
        // requireAuth middleware ensures req.session.user exists
        const currentUser = req.session.user.username || req.session.user.name || req.session.user.email;
        if (chat.user1 !== currentUser && chat.user2 !== currentUser) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json({ messages: chat.messages || [] });
        
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to load messages' });
    }
});

// Send a message
router.post('/:chatId/message', requireAuth, async (req, res) => {
    try {
        const { chatId } = req.params;
        const { sender, content } = req.body;
        
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        const chat = await SimpleChat.findById(chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Verify user has access to this chat
        // requireAuth middleware ensures req.session.user exists
        const currentUser = req.session.user.username || req.session.user.name || req.session.user.email;
        if (chat.user1 !== currentUser && chat.user2 !== currentUser) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Add message
        const newMessage = {
            sender: currentUser,
            content: content.trim(),
            timestamp: new Date(),
            readBy: [currentUser] // Mark as read by sender
        };
        
        chat.messages.push(newMessage);
        chat.lastActivity = new Date();
        
        await chat.save();
        
        res.json({ 
            message: 'Message sent successfully',
            messageId: newMessage._id
        });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Mark messages as read
router.post('/:chatId/mark-read', requireAuth, async (req, res) => {
    try {
        const { chatId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        // requireAuth middleware ensures req.session.user exists
        const currentUser = req.session.user.username || req.session.user.name || req.session.user.email;
        const chat = await SimpleChat.findById(chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Verify user has access to this chat
        if (chat.user1 !== currentUser && chat.user2 !== currentUser) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Mark all messages as read by current user
        chat.messages.forEach(message => {
            if (!message.readBy) {
                message.readBy = [];
            }
            if (!message.readBy.includes(currentUser)) {
                message.readBy.push(currentUser);
            }
        });
        
        await chat.save();
        
        res.json({ message: 'Messages marked as read' });
        
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Delete a conversation (optional)
router.delete('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }
        
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const currentUser = req.session.user.username || req.session.user.name;
        const chat = await SimpleChat.findById(chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Verify user has access to this chat
        if (chat.user1 !== currentUser && chat.user2 !== currentUser) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await SimpleChat.findByIdAndDelete(chatId);
        
        res.json({ message: 'Conversation deleted successfully' });
        
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
});

// Get chat statistics (optional)
router.get('/stats', async (req, res) => {
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        const currentUser = req.session.user.username || req.session.user.name;
        
        const totalChats = await SimpleChat.countDocuments({
            $or: [
                { user1: currentUser },
                { user2: currentUser }
            ]
        });
        
        const chats = await SimpleChat.find({
            $or: [
                { user1: currentUser },
                { user2: currentUser }
            ]
        });
        
        let totalUnreadMessages = 0;
        chats.forEach(chat => {
            const unreadCount = chat.messages.filter(msg => 
                msg.sender !== currentUser && !msg.readBy?.includes(currentUser)
            ).length;
            totalUnreadMessages += unreadCount;
        });
        
        res.json({
            totalChats,
            totalUnreadMessages
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get chat statistics' });
    }
});

module.exports = router;