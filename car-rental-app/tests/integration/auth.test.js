const request = require('supertest');
const app = require('../../app'); // Path to your Express app
const User = require('../../models/User');
const mongoose = require('mongoose');

describe('Auth API Endpoints', () => {
  let agent; // For persisting cookies (session) across requests
  let csrfToken; // To store and reuse CSRF token

  beforeEach(async () => {
    agent = request.agent(app); // Create an agent for each test to have fresh cookies
    // Fetch CSRF token before relevant tests that need it for POST/PUT etc.
    const response = await agent.get('/api/csrf-token');
    expect(response.statusCode).toBe(200);
    expect(response.body.csrfToken).toBeDefined();
    csrfToken = response.body.csrfToken;
  });
  
  afterEach(async () => {
    // Optional: Could clear specific cookies or logout if agent is reused,
    // but creating a new agent per test is cleaner.
  });


  // --- Registration ---
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully and return user data', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        })
        // For APIs, CSRF on public registration/login is less common than on authenticated state-changing endpoints.
        // If your app.js applies CSRF to all POST requests without exception, you'd need this.
        // Let's assume for now it's not needed on the very first anonymous POSTs like register,
        // or that the test setup needs a way to get a token before this if it is.
        // .set('X-CSRF-Token', csrfToken) // If CSRF is enforced on POST /register
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.body.data.user.email).toBe('test@example.com');
      
      // Verify user is in DB
      const dbUser = await User.findOne({ email: 'test@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.username).toBe('testuser');
    });

    it('should return 409 if email already exists', async () => {
      // First, create a user
      await User.create({ username: 'existinguser', email: 'existing@example.com', password: 'password123' });
      
      const res = await agent
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'existing@example.com', // Duplicate email
          password: 'password456',
          confirmPassword: 'password456'
        })
        .expect(409);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('User with that email already exists');
    });
    
    it('should return 400 for missing required fields', async () => {
        const res = await agent
            .post('/api/auth/register')
            .send({ email: 'test@example.com' }) // Missing username, password, confirmPassword
            .expect(400);
        expect(res.body.status).toBe('error');
        expect(res.body.message).toContain('Please fill in all fields');
    });
  });

  // --- Login ---
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.deleteOne({ email: 'login@example.com' });
      // Create a user to login with
      const user = new User({ username: 'loginuser', email: 'login@example.com', password: 'password123' });
      await user.save(); // Password gets hashed
    });

    it('should login an existing user successfully and set session cookie', async () => {
      const res = await agent
        .post('/api/auth/login')
        // .set('X-CSRF-Token', csrfToken) // If CSRF enforced on login
        .send({ email: 'login@example.com', password: 'password123' })
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('login@example.com');
      // Check for session cookie (superagent handles this by default with agent)
      // e.g. expect(res.headers['set-cookie']).toBeDefined(); 
    });

    it('should return 401 for incorrect password', async () => {
      const res = await agent
        .post('/api/auth/login')
        // .set('X-CSRF-Token', csrfToken) // If CSRF enforced
        .send({ email: 'login@example.com', password: 'wrongpassword' })
        .expect(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid credentials');
    });
    
    it('should return 401 for non-existent user', async () => {
      const res = await agent
        .post('/api/auth/login')
        // .set('X-CSRF-Token', csrfToken) // If CSRF enforced
        .send({ email: 'nouser@example.com', password: 'password123' })
        .expect(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid credentials');
    });
  });
  
  // --- Get Current User ---
  describe('GET /api/auth/current-user', () => {
    it('should return null user if not logged in', async () => {
        // New agent, no session
        const freshAgent = request.agent(app);
        const res = await freshAgent.get('/api/auth/current-user').expect(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.user).toBeNull();
    });

    it('should return current user data if logged in', async () => {
        // Create and log in a user first using the 'agent'
        const testUser = new User({ username: 'authtest', email: 'authtest@example.com', password: 'password123' });
        await testUser.save();
        await agent.post('/api/auth/login')
            // .set('X-CSRF-Token', csrfToken) // If CSRF enforced on login
            .send({ email: 'authtest@example.com', password: 'password123' })
            .expect(200);

        // Now get current user
        const res = await agent.get('/api/auth/current-user').expect(200);
        expect(res.body.status).toBe('success');
        expect(res.body.data.user).toBeDefined();
        expect(res.body.data.user.email).toBe('authtest@example.com');
    });
  });

  // --- Logout ---
  describe('POST /api/auth/logout', () => {
    beforeEach(async () => {
        await User.deleteOne({ email: 'logout@example.com' });
        // Ensure a user is logged in using the 'agent'
        const user = new User({ username: 'logoutuser', email: 'logout@example.com', password: 'password123' });
        await user.save();
        await agent.post('/api/auth/login')
            // .set('X-CSRF-Token', csrfToken) // If CSRF enforced
            .send({ email: 'logout@example.com', password: 'password123' }).expect(200);
        // Fetch CSRF token again after login, as it might be tied to session, or ensure it's passed if needed
         const csrfRes = await agent.get('/api/csrf-token');
         csrfToken = csrfRes.body.csrfToken; // Update CSRF token for this agent's session
    });

    it('should logout a logged-in user successfully', async () => {
      const res = await agent
        .post('/api/auth/logout')
        .set('CSRF-Token', csrfToken) // CSRF protection on logout
        .expect(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('Logout successful');

      // Verify user is no longer current
      const currentUserRes = await agent.get('/api/auth/current-user').expect(200);
      expect(currentUserRes.body.data.user).toBeNull();
    });
    
    it('should return 403 if CSRF token is missing or invalid for logout', async () => {
        const res = await agent
            .post('/api/auth/logout')
            // No CSRF token or invalid one
            .set('CSRF-Token', 'invalidOrMissingToken') 
            .expect(403); 
        // The exact message depends on your app's error handler for EBADCSRFTOKEN
        expect(res.body.message).toContain('Invalid CSRF token');
    });
  });
  
  // --- CSRF Token Endpoint ---
  describe('GET /api/csrf-token', () => {
    it('should return a CSRF token', async () => {
        // Use a fresh agent or the existing one
        const res = await request(app).get('/api/csrf-token').expect(200); // No agent needed if session not strictly required for token
        expect(res.body.csrfToken).toBeDefined();
        expect(typeof res.body.csrfToken).toBe('string');
    });
  });

});
