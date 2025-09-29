const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  isbn: {
    type: String,
    trim: true
  },
  genre: {
    type: [String],
    default: ['Other']
  },
  condition: {
    type: String,
    enum: ['New', 'Excellent', 'Good', 'Fair', 'Poor'],
    default: 'Good'
  },
  description: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    default: 'English'
  },
  year: {
    type: Number
  },
  publisher: {
    type: String,
    trim: true
  },
  image: {
    type: String, // Single image path
    default: '/images/book-placeholder.jpg'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  ownerLocation: {
    type: String,
    default: 'Unknown'
  },
  availability: {
    type: String,
    enum: ['available', 'swapped', 'unavailable'],
    default: 'available'
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  swapPreferences: {
    lookingFor: [String], // Genres or specific books
    notes: String
  },
  stats: {
    views: {
      type: Number,
      default: 0
    },
    interested: {
      type: Number,
      default: 0
    },
    swapRequests: {
      type: Number,
      default: 0
    }
  },
  // Track users who liked this book
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  featured: {
    type: Boolean,
    default: false
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

// Index for location-based queries
bookSchema.index({ coordinates: '2dsphere' });
bookSchema.index({ owner: 1, availability: 1 });
bookSchema.index({ genre: 1, availability: 1 });
bookSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Book', bookSchema);
