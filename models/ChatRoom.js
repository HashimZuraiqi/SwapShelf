const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        default: null // For group chats
    }
}, {
    timestamps: true
});

// Index for efficient queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ updatedAt: -1 });

// Ensure only 2 participants for direct messages
chatRoomSchema.pre('save', function(next) {
    if (!this.isGroup && this.participants.length !== 2) {
        return next(new Error('Direct chat rooms must have exactly 2 participants'));
    }
    next();
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);