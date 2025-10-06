const express = require('express');
const SwapController = require('../controllers/swapController');
const { requireAuth, requireSwapParticipation, rateLimit } = require('../middleware/auth');

const router = express.Router();

// Simple test route
router.get('/test', async (req, res) => {
    console.log('🧪 SWAP TEST ROUTE HIT');
    try {
        const Book = require('../models/Book');
        
        // Test book lookup with the exact IDs we're using
        const offeredBookId = '68bee97fa3c8eb5494ee6d5d';
        const requestedBookId = '68bee97fa3c8eb5494ee6d5f';
        
        console.log('🔍 Testing book lookup...');
        console.log('Offered book ID:', offeredBookId);
        console.log('Requested book ID:', requestedBookId);
        
        const offeredBook = await Book.findById(offeredBookId);
        const requestedBook = await Book.findById(requestedBookId);
        
        console.log('Offered book found:', !!offeredBook, offeredBook ? {
            title: offeredBook.title,
            availability: offeredBook.availability,
            owner: offeredBook.owner
        } : 'NOT FOUND');
        
        console.log('Requested book found:', !!requestedBook, requestedBook ? {
            title: requestedBook.title, 
            availability: requestedBook.availability,
            owner: requestedBook.owner
        } : 'NOT FOUND');
        
        res.json({ 
            message: 'Book lookup test complete',
            offeredBook: offeredBook ? {
                title: offeredBook.title,
                availability: offeredBook.availability,
                owner: offeredBook.owner
            } : null,
            requestedBook: requestedBook ? {
                title: requestedBook.title,
                availability: requestedBook.availability, 
                owner: requestedBook.owner
            } : null
        });
        
    } catch (error) {
        console.error('❌ Test route error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Apply rate limiting - DISABLED FOR TESTING
// router.use(rateLimit(30, 15 * 60 * 1000)); // 30 requests per 15 minutes

/**
 * @route   POST /api/swaps
 * @desc    Create a new swap request
 * @access  Private
 */
// Temporarily disable auth for testing
router.post('/', (req, res, next) => {
    console.log('🚀 SWAP ROUTE HIT - POST /api/swaps');
    console.log('📋 Request body:', req.body);
    next();
}, SwapController.createSwapRequest);

/**
 * @route   GET /api/swaps
 * @desc    Get user's swap requests (sent and received)
 * @access  Private
 */
router.get('/', requireAuth, SwapController.getUserSwaps);

/**
 * @route GET /api/swaps/:swapId
 * @desc  Get swap details
 * @access Private (Participants only)
 */
router.get('/:swapId', requireAuth, requireSwapParticipation, SwapController.getSwapDetails);

// Aliases used by frontend UI
router.put('/:swapId/accept', requireAuth, requireSwapParticipation, (req, res) => {
  // Ensure req.body exists before setting properties
  if (!req.body) {
    req.body = {};
  }
  req.body.action = 'accept';
  return SwapController.respondToSwap(req, res);
});

router.put('/:swapId/reject', requireAuth, requireSwapParticipation, (req, res) => {
  // Ensure req.body exists before setting properties
  if (!req.body) {
    req.body = {};
  }
  req.body.action = 'decline';
  return SwapController.respondToSwap(req, res);
});

router.post('/:swapId/confirm', requireAuth, requireSwapParticipation, SwapController.completeSwap);

router.delete('/:swapId', requireAuth, requireSwapParticipation, SwapController.cancelSwap);

/**
 * @route   PUT /api/swaps/:swapId/meeting
 * @desc    Schedule a meeting for book exchange
 * @access  Private (Participants only)
 */
router.put('/:swapId/meeting', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.scheduleMeeting
);

/**
 * @route   PUT /api/swaps/:swapId/meeting/confirm
 * @desc    Confirm meeting attendance
 * @access  Private (Participants only)
 */
router.put('/:swapId/meeting/confirm', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.confirmMeeting
);

/**
 * @route   PUT /api/swaps/:swapId/received
 * @desc    Confirm book received from swap
 * @access  Private (Participants only)
 */
router.put('/:swapId/received', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.confirmBookReceived
);

/**
 * @route   PUT /api/swaps/:swapId/progress
 * @desc    Mark swap as In Progress
 * @access  Private (Participants only)
 */
router.put('/:swapId/progress', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.markAsInProgress
);

/**
 * @route   GET /api/swaps/:swapId/details
 * @desc    Get swap details including meeting information
 * @access  Private (Participants only)
 */
router.get('/:swapId/details', 
    requireAuth, 
    requireSwapParticipation, 
    SwapController.getSwapDetails
);

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
