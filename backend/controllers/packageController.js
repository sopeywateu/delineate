const neo4jService = require('../services/neo4jService');
const https = require('https');

// Helper function to fetch data from npm registry
const fetchNpmData = (packageName) => {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    
    const request = https.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'delineate-dependency-analyzer/1.0.0'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error('Invalid JSON response from npm registry'));
        }
      });
    });
    
    request.on('error', (error) => {
      reject(error);
    });
    
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
};

const getPackageData = async (packageName, version = null) => {
  console.log(`Fetching data for package: ${packageName}, version: ${version || 'latest'}`);
  
  try {
    // Get package analysis from Neo4j (includes all versions, dependencies, and dependents)
    const analysisData = await neo4jService.getPackageAnalysis(packageName, version);

    if (!analysisData) {
      console.log(`Package ${packageName} not found`);
      return null;
    }

    // Build response with structured data
    const data = {
      package: analysisData.package,
      stats: analysisData.stats,
      dependencies: analysisData.dependencies,
      dependents: analysisData.dependents
    };

    // Fetch additional metadata from npm registry
    try {
      const npmData = await fetchNpmData(packageName);
      
      if (npmData) {
        const latestDist = npmData.versions?.[npmData['dist-tags']?.latest];
        
        // Add npm metadata to the package info
        data.package.description = npmData.description;
        data.package.license = latestDist?.license || npmData.license;
        data.package.homepage = npmData.homepage;
        data.package.repository = npmData.repository;
        data.package.keywords = npmData.keywords;
        data.package.author = npmData.author;
        data.package.maintainers = npmData.maintainers;
        
        // Add additional stats
        data.stats.lastPublish = npmData.time?.modified;
        data.stats.weeklyDownloads = 0; // Would need separate API call
        data.stats.bundleSize = latestDist?.dist?.unpackedSize;
        data.stats.hasTypes = !!latestDist?.types || !!latestDist?.typings;
        
        console.log(`Fetched npm metadata for ${packageName}`);
      }
    } catch (npmError) {
      console.warn(`Could not fetch npm metadata for ${packageName}:`, npmError.message);
      // Continue without npm data - it's not critical
    }

    console.log(`Returning structured data for ${packageName}`);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${packageName}:`, error);
    throw error;
  }
};

module.exports = { getPackageData };