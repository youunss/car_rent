// tests/setup.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    // useNewUrlParser: true, // no longer needed
    // useUnifiedTopology: true, // no longer needed
  });
});



afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
