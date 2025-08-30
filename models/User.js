const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  password: String,
  location: String,
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
