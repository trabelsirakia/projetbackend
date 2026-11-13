const mongoose = require('mongoose');
const logger = require('./utils/logger');

mongoose.set('strictQuery', true);

async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const { host, port, name } = mongoose.connection;
  logger.info(`MongoDB connecté (${host}:${port}/${name})`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
