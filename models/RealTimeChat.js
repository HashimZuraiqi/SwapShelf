const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, sparse: true }, // Add roomId field
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now }
  }],
  roomType: { type: String, enum: ['direct', 'group'], default: 'direct' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const chatMessageSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  messageType: { type: String, enum: ['text', 'image'], default: 'text' }
}, { timestamps: true });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = { ChatRoom, ChatMessage };