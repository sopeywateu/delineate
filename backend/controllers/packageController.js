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

// Helper function to fetch data from PyPI registry
const fetchPyPiData = (packageName) => {
  return new Promise((resolve, reject) => {
    const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;
    
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
          reject(new Error('Invalid JSON response from PyPI registry'));
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

// Helper function to fetch data from Maven Central registry
const fetchMavenData = (packageName) => {
  return new Promise((resolve, reject) => {
    const url = `https://central.maven.org/search/solrsearch/select?q=a:${encodeURIComponent(packageName)}&rows=1&wt=json`;
    
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
          reject(new Error('Invalid JSON response from Maven registry'));
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

const getPackageData = async (packageName, version = null, ecosystem = 'npm') => {
  // Default to npm if ecosystem not specified (fallback behavior)
  const targetEcosystem = ecosystem || 'npm';
  console.log(`Fetching data for package: ${packageName}, version: ${version || 'latest'}, ecosystem: ${targetEcosystem}`);
  
  try {
    // Get package analysis from Neo4j (includes all versions, dependencies, and dependents)
    const analysisData = await neo4jService.getPackageAnalysis(packageName, version, targetEcosystem);

    if (!analysisData) {
      console.log(`Package ${packageName} not found in ${targetEcosystem} ecosystem`);
      return null;
    }

    // Build response with structured data
    const data = {
      package: analysisData.package,
      stats: analysisData.stats,
      dependencies: analysisData.dependencies,
      dependents: analysisData.dependents,
      ecosystem: targetEcosystem
    };

    // Fetch additional metadata based on ecosystem
    try {
      let registryData = null;

      if (targetEcosystem === 'npm') {
        registryData = await fetchNpmData(packageName);
        
        if (registryData) {
          const latestDist = registryData.versions?.[registryData['dist-tags']?.latest];
          
          // Add npm metadata to the package info
          data.package.description = registryData.description;
          data.package.license = latestDist?.license || registryData.license;
          data.package.homepage = registryData.homepage;
          data.package.repository = registryData.repository;
          data.package.keywords = registryData.keywords;
          data.package.author = registryData.author;
          data.package.maintainers = registryData.maintainers;
          
          // Add additional stats
          data.stats.lastPublish = registryData.time?.modified;
          data.stats.weeklyDownloads = 0; // Would need separate API call
          data.stats.bundleSize = latestDist?.dist?.unpackedSize;
          data.stats.hasTypes = !!latestDist?.types || !!latestDist?.typings;
          
          console.log(`Fetched npm metadata for ${packageName}`);
        }
      } else if (targetEcosystem === 'pypi') {
        registryData = await fetchPyPiData(packageName);
        
        if (registryData && registryData.info) {
          const info = registryData.info;
          
          // Add PyPI metadata to the package info
          data.package.description = info.summary || info.description;
          data.package.license = info.license;
          data.package.homepage = info.home_page;
          data.package.author = info.author;
          data.package.authorEmail = info.author_email;
          
          // Add additional stats
          data.stats.lastPublish = registryData.releases ? Object.keys(registryData.releases).pop() : null;
          data.stats.hasTypes = false; // PyPI doesn't have TypeScript types
          
          console.log(`Fetched PyPI metadata for ${packageName}`);
        }
      } else if (targetEcosystem === 'maven') {
        registryData = await fetchMavenData(packageName);
        
        if (registryData && registryData.response?.docs?.[0]) {
          const doc = registryData.response.docs[0];
          
          // Add Maven metadata to the package info
          data.package.description = packageName; // Maven response doesn't include description
          data.package.groupId = doc.g;
          data.package.artifactId = doc.a;
          data.package.latestVersion = doc.latestVersion;
          
          // Add additional stats
          data.stats.lastPublish = doc.timestamp ? new Date(doc.timestamp).toISOString() : null;
          
          console.log(`Fetched Maven metadata for ${packageName}`);
        }
      }
    } catch (registryError) {
      console.warn(`Could not fetch ${targetEcosystem} metadata for ${packageName}:`, registryError.message);
      // Continue without registry data - it's not critical
    }

    console.log(`Returning structured data for ${packageName} from ${targetEcosystem} ecosystem`);
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${packageName}:`, error);
    throw error;
  }
};

module.exports = { getPackageData };