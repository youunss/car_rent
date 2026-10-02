module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.session && req.session.user) {
      return next();
    }
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json')) || req.originalUrl.startsWith('/api')) {
      return res.status(401).json({ status: 'error', message: 'Authentication required. Please log in.' });
    }
    res.redirect('/auth/login');
  },

  isAdmin: function(req, res, next) {
    if (req.session && req.session.user && req.session.role === 'admin') {
      return next();
    }
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json')) || req.originalUrl.startsWith('/api')) {
      return res.status(403).json({ status: 'error', message: 'Forbidden. Admin role required.' });
    }
    res.redirect('/'); 
  },

  forwardAuthenticated: function(req, res, next) {
    if (req.session && !req.session.user) {
      return next();
    }
    res.redirect('/'); 
  }
};
