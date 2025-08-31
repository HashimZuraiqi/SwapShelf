// models/Activity.js
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // what happened
    action: {
      type: String,
      enum: [
        'ADD_BOOK',
        'UPDATE_BOOK',
        'DELETE_BOOK',
        'ADD_WISHLIST',
        'REMOVE_WISHLIST',
        'MATCH_SWAP',
        'COMPLETE_SWAP',
        'EARN_POINTS'
      ],
      required: true
    },

    // human-readable line shown on the dashboard
    message: { type: String, required: true, trim: true },

    // optional linking back to the thing that changed
    entityType: { type: String, default: null },    // e.g. 'Book'
    entityId:   { type: mongoose.Schema.Types.ObjectId, default: null },

    // anything extra you may want later
    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);


activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
