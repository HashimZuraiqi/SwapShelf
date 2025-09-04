const express = require('express');
const DashboardController = require('../controllers/dashboardController');
const { requireAuth, rateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply rate limiting
router.use(rateLimit(30, 10 * 60 * 1000)); // 30 requests per 10 minutes

/**
 * @route   GET /api/dashboard
 * @desc    Get complete dashboard data
 * @access  Private
 */
router.get('/', requireAuth, DashboardController.getDashboardAPI);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get user statistics and swap insights
 * @access  Private
 */
router.get('/stats', requireAuth, DashboardController.getUserStatsAPI);

/**
 * @route   GET /api/dashboard/nearby
 * @desc    Get nearby available books
 * @access  Private
 */
router.get('/nearby', requireAuth, DashboardController.getNearbyBooksAPI);

module.exports = router;
