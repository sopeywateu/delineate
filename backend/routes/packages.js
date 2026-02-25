const express = require('express');
const { getPackageData } = require('../controllers/packageController');
const neo4jService = require('../services/neo4jService');

const router = express.Router();

// GET /api/package/:name/details?version=...&ecosystem=...
router.get('/package/:name/details', async (req, res) => {
  try {
    const { name } = req.params;
    const { version, ecosystem } = req.query; // Accept optional version and ecosystem parameters
    
    const data = await getPackageData(name, version, ecosystem);
    if (!data) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/package/search?query=...&ecosystem=...
// Returns a short list of package names that match the query from Neo4j, filtered by ecosystem
router.get('/package/search', async (req, res) => {
  try {
    const { query = '', ecosystem = 'npm' } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const results = await neo4jService.searchPackages(query.trim(), ecosystem);
    // Ensure we always return an array
    res.json(Array.isArray(results) ? results : []);
  } catch (error) {
    console.error('Error in package search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;