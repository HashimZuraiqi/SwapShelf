const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SimpleChat = require('../models/SimpleChat');

// Create or get chat
router.post('/create', async (req, res) => {
    try {
        const { user1, user2, offeredBook, requestedBook } = req.body;
        
        console.log('Creating chat:', { user1, user2, offeredBook, requestedBook });
        
        // Use the static method from the model
        const { conversation, created } = await SimpleChat.createOrGetConversation(
            user1, 
            user2, 
            {
                offeredBook,
                requestedBook,
                context: `${offeredBook} ↔ ${requestedBook}`,
                chatType: 'swap'
            }
        );
        
        // Add initial message if new conversation
        if (created) {
            conversation.addMessage(
                user1, 
                `Hi! I'm interested in swapping "${offeredBook}" for "${requestedBook}".`,
                'text'
            );
            await conversation.save();
        }
        
        res.json({ 
            success: true, 
            chatId: conversation._id,
            chat: conversation,
            created
        });
        
    } catch (error) {
        console.error('Chat creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get chat by ID
router.get('/:chatId', async (req, res) => {
    try {
        const chat = await SimpleChat.findById(req.params.chatId);
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
router.post('/:chatId/message', async (req, res) => {
    try {
        const { sender, content } = req.body;
        const chat = await SimpleChat.findById(req.params.chatId);
        
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        // Use the model method to add message
        chat.addMessage(sender, content, 'text');
        await chat.save();
        
        res.json({ success: true, message: 'Message sent' });
        
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get messages for a chat
router.get('/:chatId/messages', async (req, res) => {
    try {
        const chat = await SimpleChat.findById(req.params.chatId);
        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }
        
        res.json({ success: true, messages: chat.messages });
        
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;