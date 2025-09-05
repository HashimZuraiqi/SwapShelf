// models/Activity.js
const mongoose = require('mongoose');

const ACTIONS = [
  'ADD_BOOK',
  'UPDATE_BOOK',
  'DELETE_BOOK',
  'ADD_WISHLIST',
  'REMOVE_WISHLIST',
  'MATCH_SWAP',
  'COMPLETE_SWAP',
  'EARN_POINTS',
  'UPDATE_PROFILE'
];

// Optional alias map (accept legacy names, store canonical)
const ACTION_ALIASES = {
  WISHLIST_ADD: 'ADD_WISHLIST',
  PROFILE_UPDATE: 'UPDATE_PROFILE',
  SWAP_COMPLETED: 'COMPLETE_SWAP'
};

const normalizeAction = (val) => {
  if (!val) return val;
  const up = String(val).toUpperCase();
  return ACTION_ALIASES[up] || up;
};

const activitySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    action: {
      type: String,
      enum: ACTIONS,
      required: true,
      set: normalizeAction,        // normalize on assignment
    },

    message: { type: String, required: true, trim: true },

    entityType: { type: String, default: null },
    entityId:   { type: mongoose.Schema.Types.ObjectId, default: null },

    meta: { type: Object, default: {} }
  },
  { timestamps: true }
);

// As an extra safety net (e.g., updates bypassing setters):
activitySchema.pre('validate', function(next) {
  if (this.isModified('action')) {
    this.action = normalizeAction(this.action);
  }
  next();
});

// Indexes for your feed queries
activitySchema.index({ user: 1, createdAt: -1 });
// Optional: if you filter by action often, add this too:
// activitySchema.index({ user: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
