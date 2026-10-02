// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageProvider: 'v8',
  clearMocks: true,
  // You might want to add setup files later, e.g., for global beforeAll/afterAll for DB connection
  setupFilesAfterEnv: ['./tests/setup.js'], 
};
