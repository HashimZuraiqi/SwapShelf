const express = require('express');
const RewardsController = require('../controllers/rewardsController');
const { requireAuth, rateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply rate limiting
router.use(rateLimit(50, 10 * 60 * 1000)); // 50 requests per 10 minutes

/**
 * @route   GET /api/rewards
 * @desc    Get user's complete rewards data
 * @access  Private
 */
router.get('/', requireAuth, RewardsController.getUserRewards);

/**
 * @route   GET /api/rewards/debug
 * @desc    Debug user's badges (troubleshooting)
 * @access  Private
 */
router.get('/debug', requireAuth, RewardsController.debugUserBadges);

/**
 * @route   GET /api/rewards/leaderboard
 * @desc    Get leaderboard data
 * @access  Private
 */
router.get('/leaderboard', requireAuth, RewardsController.getLeaderboard);

/**
 * @route   POST /api/rewards/claim-quest
 * @desc    Claim quest reward
 * @access  Private
 */
router.post('/claim-quest', requireAuth, RewardsController.claimQuestReward);

module.exports = router;
