const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  location: String,
  resetPasswordToken: { type: String, index: true },
  resetPasswordExpires: { type: Date },
  photo: {
    type: String,
    default: '/images/default-avatar.png'
  },
  preferences: {
    favoriteGenres: [String],
    languages: [String],
    readingLevel: String,
    updatedAt: Date
  },
  wishlist: [{
    title: String,
    author: String,
    ownerId: String,
    ownerName: String,
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    notes: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
