require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectMongo = require('./config/mongo');
const { getSession } = require('./config/neo4j');
const packagesRouter = require('./routes/packages');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api', packagesRouter);
app.use('/api', feedbackRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Connect to databases and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectMongo();

    // Verify Neo4j connection
    const session = getSession();
    await session.run('RETURN 1');
    await session.close();
    console.log('Neo4j connected');

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();