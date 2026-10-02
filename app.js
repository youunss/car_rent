require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./config/database');
const session = require('express-session');
const MongoStore = require('connect-mongo');
// const flash = require('connect-flash'); // REMOVED
const csrf = require('csurf');
// const methodOverride = require('method-override'); // If it was added by worker

// Require route files
const authApiRoutes = require('./routes/authRoutes'); 
const adminCarApiRoutes = require('./routes/admin/carRoutes'); 
const publicCarApiRoutes = require('./routes/carRoutes');
const bookingApiRoutes = require('./routes/bookingRoutes'); 
const adminBookingApiRoutes = require('./routes/admin/bookingRoutes'); 
const adminDashboardApiRoutes = require('./routes/admin/dashboardRoutes'); // New

if (process.env.NODE_ENV !== 'test') {
  connectDB();
}
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(methodOverride('_method')); // If used

// Static files (will serve HTML, CSS, JS from public)
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup - NO LONGER NEEDED
// ... (EJS setup commented out)

// Session Configuration
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'car-rental-default-session-secret-key-99',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, 
    httpOnly: true, 
  }
};

if (process.env.NODE_ENV !== 'test' && process.env.MONGO_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions'
  });
}

app.use(session(sessionConfig));

// CSRF Protection
const csrfProtection = csrf();
app.use((req, res, next) => {
  if (req.path === '/api/auth/register' || req.path === '/api/auth/login') {
    return next();
  }
  if (req.path.startsWith('/api/bookings') && (!req.session || !req.session.user)) {
    return res.status(401).json({ status: 'error', message: 'Authentication required. Please log in.' });
  }
  csrfProtection(req, res, next);
});

// Global variables for session state
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user;
  res.locals.userRole = req.session.role;
  next();
});

// API Routes
app.use('/api/auth', authApiRoutes);
app.use('/api/admin/cars', adminCarApiRoutes);
app.use('/api/cars', publicCarApiRoutes); 
app.use('/api/bookings', bookingApiRoutes); 
app.use('/api/admin/bookings', adminBookingApiRoutes); 
app.use('/api/admin/dashboard', adminDashboardApiRoutes); // Mount Admin Dashboard API routes


// GET CSRF Token Endpoint
app.get('/api/csrf-token', (req, res) => {
  if (typeof req.csrfToken !== 'function') {
    return res.status(500).json({ status: 'error', message: 'CSRF token function not available.'});
  }
  res.json({ csrfToken: req.csrfToken() });
});

// Basic HTML serving for root (SPA shell or static homepage)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.status(500).send("Error serving index.html. Ensure it's in the public directory.");
        }
    });
});


// Error Handlers (API-centric)
app.use((req, res, next) => {
  res.status(404).json({ 
    status: 'error',
    message: 'Not Found - The requested API endpoint does not exist.' 
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('-------------------- ERROR START --------------------');
  console.error(err.stack); 
  console.error('-------------------- ERROR END ----------------------');

  const statusCode = err.status || 500;
  let errorMessage = 'Server Error'; 

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid CSRF token. Please refresh and try again or ensure your client is sending the correct token.'
    });
  }
  
  if (statusCode !== 500 || process.env.NODE_ENV === 'development') {
      errorMessage = err.message || errorMessage;
  }

  const errorResponse = {
    status: 'error',
    message: errorMessage,
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack; 
  }

  res.status(statusCode).json(errorResponse);
});


const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
