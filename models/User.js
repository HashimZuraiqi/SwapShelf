const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,       // unique index created once (no manual schema.index duplicate)
      lowercase: true,    // normalize for case-insensitive uniqueness
      trim: true
    },

    // Unique username for login/profile URLs
    username: {
      type: String,
      required: true,
      unique: true,       // unique index created once
      trim: true,
      lowercase: true,    // normalize to ensure case-insensitive uniqueness
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_.]+$/ // letters, numbers, underscore, dot
    },

    password: { type: String, required: true },

    location: { type: String, default: '' },

    resetPasswordToken: { type: String, index: true },
    resetPasswordExpires: { type: Date },

    photo: { type: String, default: '/images/default-avatar.png' },

    preferences: {
      favoriteGenres: [String],
      languages: [String],
      readingLevel: String,
      updatedAt: Date
    },

    wishlist: [
      {
        title: String,
        author: String,
        image: String,
        priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
        notes: String,
        dateAdded: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true } // adds createdAt/updatedAt automatically
);

module.exports = mongoose.model('User', userSchema);
