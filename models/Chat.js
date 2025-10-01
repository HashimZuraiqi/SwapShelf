const mongoose = require('mongoose');

// Simple Chat Schema for legacy swap-based chats
const chatSchema = new mongoose.Schema({
  swapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Swap', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 1000 },
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false }
  }],
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for performance
chatSchema.index({ swapId: 1 });
chatSchema.index({ participants: 1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;