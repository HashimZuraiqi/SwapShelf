const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: String,
  username: {
    type: String,
    required: true,
    unique: true,     // unique index defined here
    trim: true,
    lowercase: true,  // ensures automatic lowercase
    minlength: 3,
    maxlength: 30
  },
  email: String,
  password: String,
  location: String,
  phone: String,
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
    image: String,
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    },
    notes: String,
    dateAdded: {
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

// (Removed duplicate userSchema.index({ username: 1 }, { unique: true }));

module.exports = mongoose.model('User', userSchema);
