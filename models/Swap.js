const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requesterName: {
    type: String,
    required: true
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
  requestedBook: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true
    },
    title: String,
    author: String
  },
  offeredBooks: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    title: String,
    author: String
  }],
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Declined', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  message: {
    type: String,
    trim: true
  },
  negotiationHistory: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    fromName: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['Message', 'Counter Offer', 'Accept', 'Decline', 'Complete', 'Cancel']
    }
  }],
  meetingDetails: {
    location: String,
    datetime: Date,
    notes: String,
    confirmed: {
      type: Boolean,
      default: false
    }
  },
  rating: {
    requesterRating: {
      stars: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      timestamp: Date
    },
    ownerRating: {
      stars: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      timestamp: Date
    }
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
swapSchema.index({ requester: 1, status: 1 });
swapSchema.index({ owner: 1, status: 1 });
swapSchema.index({ status: 1, createdAt: -1 });
swapSchema.index({ 'requestedBook.id': 1 });

module.exports = mongoose.model('Swap', swapSchema);
