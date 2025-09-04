const express = require('express');
const SwapController = require('../controllers/swapController');
const { requireAuth, requireSwapParticipation, rateLimit } = require('../middleware/auth');

const router = express.Router();

// Apply rate limiting
router.use(rateLimit(30, 15 * 60 * 1000)); // 30 requests per 15 minutes

/**
 * @route   POST /api/swaps
 * @desc    Create a new swap request
 * @access  Private
 */
router.post('/', requireAuth, SwapController.createSwapRequest);

/**
 * @route   GET /api/swaps
 * @desc    Get user's swap requests (sent and received)
 * @access  Private
 */
router.get('/', requireAuth, SwapController.getUserSwaps);

/**
 * @route   POST /api/swaps/:swapId/respond
 * @desc    Respond to a swap request (accept/decline)
 * @access  Private (Participants only)
 */
router.post('/:swapId/respond', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.respondToSwap
);

/**
 * @route   POST /api/swaps/:swapId/message
 * @desc    Add message to swap negotiation
 * @access  Private (Participants only)
 */
router.post('/:swapId/message', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.addNegotiationMessage
);

/**
 * @route   POST /api/swaps/:swapId/complete
 * @desc    Complete a swap
 * @access  Private (Participants only)
 */
router.post('/:swapId/complete', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.completeSwap
);

/**
 * @route   POST /api/swaps/:swapId/cancel
 * @desc    Cancel a swap
 * @access  Private (Participants only)
 */
router.post('/:swapId/cancel', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.cancelSwap
);

/**
 * @route   POST /api/swaps/:swapId/rate
 * @desc    Rate a completed swap
 * @access  Private (Participants only)
 */
router.post('/:swapId/rate', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.rateSwap
);

module.exports = router;
