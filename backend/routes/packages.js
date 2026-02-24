const express = require('express');
const { getPackageData } = require('../controllers/packageController');

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

module.exports = router;