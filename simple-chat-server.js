// Simple Chat System - Complete Implementation
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Simple Chat Schema
const chatSchema = new mongoose.Schema({
    participants: [String], // Simple user identifiers
    messages: [{
        sender: String,
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],
    bookInfo: {
        offeredBook: String,
        requestedBook: String
    }
});

const Chat = mongoose.model('SimpleChat', chatSchema);

// Routes
app.get('/', (req, res) => {
    res.render('simple-chat');
});

// Create or get chat
app.post('/api/simple-chat/create', async (req, res) => {
    try {
        const { user1, user2, offeredBook, requestedBook } = req.body;
        
        console.log('Creating chat:', { user1, user2, offeredBook, requestedBook });
        
        // Find existing chat or create new one
        let chat = await Chat.findOne({
            participants: { $all: [user1, user2] }
        });
        
        if (!chat) {
            chat = new Chat({
                participants: [user1, user2],
                messages: [{
                    sender: user1,
                    content: `Hi! I'm interested in swapping books with you.`,
                    timestamp: new Date()
                }],
                bookInfo: {
                    offeredBook: offeredBook || 'My Book',
                    requestedBook: requestedBook || 'Your Book'
                }
            });
            await chat.save();
        }
        
        res.json({ 
            success: true, 
            chatId: chat._id,
            chat: chat
        });
        
    } catch (error) {
        console.error('Chat creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get chat messages
app.get('/api/simple-chat/:chatId', async (req, res) => {
    try {
        const chat = await Chat.findById(req.params.chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        res.json({ success: true, chat });
        
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send message
app.post('/api/simple-chat/:chatId/message', async (req, res) => {
    try {
        const { sender, content } = req.body;
        const chat = await Chat.findById(req.params.chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        chat.messages.push({
            sender,
            content,
            timestamp: new Date()
        });
        
        await chat.save();
        
        res.json({ 
            success: true, 
            message: chat.messages[chat.messages.length - 1] 
        });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('✅ MongoDB Connected');
        app.listen(3001, () => {
            console.log('🚀 Simple Chat Server running on http://localhost:3001');
        });
    })
    .catch(error => {
        console.error('❌ MongoDB connection failed:', error);
    });