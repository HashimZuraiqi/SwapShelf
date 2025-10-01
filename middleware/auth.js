/**
 * Authentication and Authorization Middleware
 */

/**
 * Check if user is authenticated
 */
const requireAuth = (req, res, next) => {
    console.log('🔐 Auth middleware called for:', req.method, req.originalUrl);
    console.log('🔐 Auth check - Session exists:', !!req.session);
    console.log('🔐 Auth check - User in session:', !!req.session?.user);
    console.log('🔐 Auth check - Session ID:', req.sessionID);
    console.log('🔐 Auth check - Headers:', {
        'user-agent': req.headers['user-agent']?.substring(0, 50),
        'accept': req.headers.accept,
        'xhr': req.xhr
    });
    
    if (!req.session || !req.session.user) {
        console.log('❌ Authentication failed - no session or user');
        console.log('❌ Session:', req.session ? 'exists but no user' : 'missing');
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            console.log('❌ Returning 401 JSON error');
            return res.status(401).json({ error: 'Authentication required' });
        }
        console.log('❌ Redirecting to login');
        return res.redirect('/login?error=auth_required');
    }
    
    console.log('✅ Authentication successful for user:', req.session.user.email);
    next();
};

/**
 * Check if user is not authenticated (for login/register pages)
 */
const requireGuest = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

/**
 * Validate user ownership of resource
 */
const requireOwnership = (model, paramName = 'id', ownerField = 'owner') => {
    return async (req, res, next) => {
        try {
            const userId = req.session.user._id || req.session.user.id;
            const resourceId = req.params[paramName];
            
            const resource = await model.findById(resourceId);
            if (!resource) {
                return res.status(404).json({ error: 'Resource not found' });
            }
            
            if (resource[ownerField].toString() !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            req.resource = resource;
            next();
        } catch (error) {
            console.error('Ownership check error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    };
};

/**
 * Validate swap participation
 */
const requireSwapParticipation = async (req, res, next) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        const swapId = req.params.swapId || req.params.id;
        
        const Swap = require('../models/Swap');
        const swap = await Swap.findById(swapId);
        
        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }
        
        if (swap.requester.toString() !== userId && swap.owner.toString() !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        req.swap = swap;
        next();
    } catch (error) {
        console.error('Swap participation check error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Rate limiting middleware
 */
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const identifier = req.session?.user?.id || req.ip;
        const now = Date.now();
        
        if (!requests.has(identifier)) {
            requests.set(identifier, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const userRequests = requests.get(identifier);
        
        if (now > userRequests.resetTime) {
            userRequests.count = 1;
            userRequests.resetTime = now + windowMs;
            return next();
        }
        
        if (userRequests.count >= maxRequests) {
            return res.status(429).json({ error: 'Too many requests' });
        }
        
        userRequests.count++;
        next();
    };
};

/**
 * Validation middleware
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: error.details.map(d => d.message)
            });
        }
        next();
    };
};

/**
 * Error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        return res.status(400).json({ error: 'Duplicate entry' });
    }
    
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Default error
    res.status(500).json({ error: 'Internal server error' });
};

/**
 * CORS middleware for API routes
 */
const corsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
};

module.exports = {
    requireAuth,
    requireGuest,
    requireOwnership,
    requireSwapParticipation,
    rateLimit,
    validateRequest,
    errorHandler,
    corsMiddleware
};
