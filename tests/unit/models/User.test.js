const mongoose = require('mongoose');
const User = require('../../../models/User'); // Adjust path as per your structure

describe('User Model', () => {
  // Clean up User collection before each test in this describe block
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('should create a user successfully with valid data', async () => {
    const userData = { username: 'testuser', email: 'test@example.com', password: 'password123' };
    const user = new User(userData);
    const savedUser = await user.save();
    expect(savedUser._id).toBeDefined();
    expect(savedUser.username).toBe(userData.username);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.role).toBe('user'); // Default role
  });

  it('should hash the password before saving', async () => {
    const userData = { username: 'testuser2', email: 'test2@example.com', password: 'password123' };
    const user = new User(userData);
    const savedUser = await user.save();
    expect(savedUser.password).toBeDefined();
    expect(savedUser.password).not.toBe(userData.password);
  });

  it('should correctly compare passwords with comparePassword method', async () => {
    const userData = { username: 'testuser3', email: 'test3@example.com', password: 'password123' };
    const user = new User(userData);
    await user.save(); // Save to hash the password

    const isMatch = await user.comparePassword('password123');
    expect(isMatch).toBe(true);

    const isNotMatch = await user.comparePassword('wrongpassword');
    expect(isNotMatch).toBe(false);
  });

  it('should require username, email, and password', async () => {
    let user = new User({ email: 'test@example.com', password: 'password' });
    let err;
    try { await user.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.username).toBeDefined();

    user = new User({ username: 'test', password: 'password' });
    try { await user.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.email).toBeDefined();

    user = new User({ username: 'test', email: 'test@example.com' });
    try { await user.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.password).toBeDefined();
  });
  
  it('should enforce unique email', async () => {
    await new User({ username: 'user1', email: 'unique@example.com', password: 'password1' }).save();
    let user2 = new User({ username: 'user2', email: 'unique@example.com', password: 'password2' });
    let err;
    try { await user2.save(); } catch (error) { err = error; }
    expect(err).toBeDefined(); // Mongoose throws a MongoDB duplicate key error (code 11000)
    expect(err.code).toBe(11000); 
  });

  it('should enforce password min length (6 chars)', async () => {
    let user = new User({ username: 'testlen', email: 'len@example.com', password: '123' });
    let err;
    try { await user.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.password).toBeDefined();
    expect(err.errors.password.message).toContain('at least 6 characters long');
  });

  it('should reject invalid email format', async () => {
    let user = new User({ username: 'testmail', email: 'invalidmail', password: 'password123' });
    let err;
    try { await user.save(); } catch (error) { err = error; }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(err.errors.email).toBeDefined();
    expect(err.errors.email.message).toContain('valid email address');
  });
});
