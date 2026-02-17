const mongoose = require('mongoose');

const connectMongo = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('MONGO_URI not set; skipping MongoDB connection (stateless mode)');
    return;
  }

  try {
    await mongoose.connect(uri, {});
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectMongo;