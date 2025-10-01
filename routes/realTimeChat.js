const express = require('express');
const router = express.Router();
const RealTimeChatController = require('../controllers/realTimeChatController');
const User = require('../models/User');

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
};

// Search users for chat
router.get('/search-users', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.session.user._id || req.session.user.id;
    
    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('username email avatar').limit(10);

    res.json({ success: true, users });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Chat room endpoints
router.post('/rooms', requireAuth, RealTimeChatController.findOrCreateRoom);
router.get('/rooms', requireAuth, RealTimeChatController.getUserRooms);
router.get('/rooms/:roomId/messages', requireAuth, RealTimeChatController.getRoomMessages);
router.post('/messages', requireAuth, RealTimeChatController.sendMessage);

module.exports = router;