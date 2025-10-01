const mongoose = require('mongoose');const mongoose = require('mongoose');const mongoose = require('mongoose');const mongoose = require('mongoose');const mongoose = require('mongoose');



// Chat Room Schema

const chatRoomSchema = new mongoose.Schema({

  participants: [{const chatRoomSchema = new mongoose.Schema({

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    joinedAt: { type: Date, default: Date.now }  participants: [{

  }],

  roomType: { type: String, enum: ['direct', 'group'], default: 'direct' },    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },// Chat Room Schema - Clean and Simple

  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },

  isActive: { type: Boolean, default: true }    joinedAt: { type: Date, default: Date.now }

}, { timestamps: true });

  }],const chatRoomSchema = new mongoose.Schema({

// Chat Message Schema

const chatMessageSchema = new mongoose.Schema({  roomType: { type: String, enum: ['direct', 'group'], default: 'direct' },

  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },

  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },  participants: [{// Chat Room Schemaconst messageSchema = new mongoose.Schema({

  content: { type: String, required: true, trim: true },

  messageType: { type: String, enum: ['text', 'image'], default: 'text' }  isActive: { type: Boolean, default: true }

}, { timestamps: true });

}, { timestamps: true });    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

// Models

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

const chatMessageSchema = new mongoose.Schema({    joinedAt: { type: Date, default: Date.now },const chatRoomSchema = new mongoose.Schema({    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

module.exports = { ChatRoom, ChatMessage };
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },

  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },    lastSeen: { type: Date, default: Date.now }

  content: { type: String, required: true, trim: true },

  messageType: { type: String, enum: ['text', 'image'], default: 'text' }  }],  participants: [{    content: { type: String, required: true, maxlength: 1000 },

}, { timestamps: true });

  roomType: { type: String, enum: ['direct', 'group'], default: 'direct' },

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },    timestamp: { type: Date, default: Date.now },



module.exports = { ChatRoom, ChatMessage };  isActive: { type: Boolean, default: true }

}, {    joinedAt: { type: Date, default: Date.now },    read: { type: Boolean, default: false }

  timestamps: true

});    lastSeen: { type: Date, default: Date.now }});



// Chat Message Schema - Clean and Simple  }],

const chatMessageSchema = new mongoose.Schema({

  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },  roomType: { type: String, enum: ['direct', 'group'], default: 'direct' },const chatSchema = new mongoose.Schema({

  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  content: { type: String, required: true, trim: true },  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },    swapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Swap', required: true },

  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },

  isDeleted: { type: Boolean, default: false }  isActive: { type: Boolean, default: true },    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

}, {

  timestamps: true  metadata: {    messages: [messageSchema],

});

    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },    lastActivity: { type: Date, default: Date.now },

// Create models

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);    swapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Swap' }    isActive: { type: Boolean, default: true }

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

  }}, {

module.exports = { ChatRoom, ChatMessage };
}, {    timestamps: true

  timestamps: true});

});

chatSchema.index({ swapId: 1 });

// Chat Message SchemachatSchema.index({ participants: 1 });

const chatMessageSchema = new mongoose.Schema({

  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },module.exports = mongoose.model('Chat', chatSchema);
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  attachments: [{
    filename: String,
    originalName: String,
    url: String,
    size: Number,
    mimeType: String
  }],
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes for performance
chatRoomSchema.index({ 'participants.user': 1 });
chatRoomSchema.index({ updatedAt: -1 });
chatMessageSchema.index({ room: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1 });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = { ChatRoom, ChatMessage };