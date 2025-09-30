const mongoose = require('mongoose');

const messageChatSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 1000
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    readBy: [{
        type: String
    }],
    messageType: {
        type: String,
        enum: ['text', 'system', 'book-offer'],
        default: 'text'
    }
});

const simpleChatSchema = new mongoose.Schema({
    user1: {
        type: String,
        required: true
    },
    user2: {
        type: String,
        required: true
    },
    offeredBook: {
        type: String
    },
    requestedBook: {
        type: String
    },
    context: {
        type: String,
        default: 'General chat'
    },
    messages: [messageChatSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'blocked'],
        default: 'active'
    },
    chatType: {
        type: String,
        enum: ['swap', 'general', 'support'],
        default: 'swap'
    }
});

// Index for efficient queries
simpleChatSchema.index({ user1: 1, user2: 1 });
simpleChatSchema.index({ lastActivity: -1 });
simpleChatSchema.index({ createdAt: -1 });

// Virtual for getting the other user
simpleChatSchema.methods.getOtherUser = function(currentUser) {
    return this.user1 === currentUser ? this.user2 : this.user1;
};

// Method to add a message
simpleChatSchema.methods.addMessage = function(sender, content, messageType = 'text') {
    const message = {
        sender,
        content,
        timestamp: new Date(),
        readBy: [sender],
        messageType
    };
    
    this.messages.push(message);
    this.lastActivity = new Date();
    
    return message;
};

// Method to get unread count for a user
simpleChatSchema.methods.getUnreadCount = function(username) {
    return this.messages.filter(msg => 
        msg.sender !== username && 
        (!msg.readBy || !msg.readBy.includes(username))
    ).length;
};

// Method to mark messages as read
simpleChatSchema.methods.markAsRead = function(username) {
    this.messages.forEach(message => {
        if (!message.readBy) {
            message.readBy = [];
        }
        if (!message.readBy.includes(username)) {
            message.readBy.push(username);
        }
    });
    
    return this.save();
};

// Static method to find conversations for a user
simpleChatSchema.statics.findUserConversations = function(username) {
    return this.find({
        $or: [
            { user1: username },
            { user2: username }
        ],
        status: 'active'
    }).sort({ lastActivity: -1 });
};

// Static method to create or get existing conversation
simpleChatSchema.statics.createOrGetConversation = async function(user1, user2, options = {}) {
    // Check if conversation already exists
    let conversation = await this.findOne({
        $or: [
            { user1, user2 },
            { user1: user2, user2: user1 }
        ],
        status: 'active'
    });
    
    if (conversation) {
        return { conversation, created: false };
    }
    
    // Create new conversation
    conversation = new this({
        user1,
        user2,
        offeredBook: options.offeredBook,
        requestedBook: options.requestedBook,
        context: options.context || 'General chat',
        chatType: options.chatType || 'swap'
    });
    
    await conversation.save();
    return { conversation, created: true };
};

module.exports = mongoose.model('SimpleChat', simpleChatSchema);