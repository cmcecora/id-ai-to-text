const { fromNodeHeaders } = require('better-auth/node');

/**
 * Better Auth session validation middleware
 * Validates the user's session and attaches user info to the request
 *
 * @param {Object} auth - The Better Auth instance
 * @returns {Function} Express middleware function
 */
const requireAuth = (auth) => async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Unauthenticated. Please sign in.'
      });
    }

    // Attach user and session to request for use in controllers
    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed. Please sign in again.'
    });
  }
};

/**
 * Optional auth middleware - allows unauthenticated requests but attaches user if present
 * Useful for endpoints that work differently for authenticated vs anonymous users
 *
 * @param {Object} auth - The Better Auth instance
 * @returns {Function} Express middleware function
 */
const optionalAuth = (auth) => async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (session) {
      req.user = session.user;
      req.session = session.session;
    } else {
      req.user = null;
      req.session = null;
    }
    next();
  } catch (error) {
    // Continue without auth on error
    req.user = null;
    req.session = null;
    next();
  }
};

module.exports = { requireAuth, optionalAuth };
