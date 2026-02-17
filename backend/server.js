require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectMongo = require('./config/mongo');
const { driver, verifyConnectivity } = require('./config/neo4j');
const packagesRouter = require('./routes/packages');
const feedbackRouter = require('./routes/feedback');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration: prefer an explicit FRONTEND_URL environment variable in production
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || null;
const corsOptions = FRONTEND_URL ? { origin: FRONTEND_URL, optionsSuccessStatus: 200 } : {};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
// Serve static frontend only when explicitly enabled (avoid coupling in cloud)
if (process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '../frontend')));
}

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
    // Connect to MongoDB (if configured)
    await connectMongo();

    // Verify Neo4j connectivity (will throw if misconfigured)
    await verifyConnectivity();
    console.log('Neo4j connected');

    // Start server - bind to 0.0.0.0 for cloud environments
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();