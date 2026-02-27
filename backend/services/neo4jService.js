const fs = require('fs');
const path = require('path');
const { getSession } = require('../config/neo4j');

// Load recommendation lists (newline-separated) from backend/config/recommendations/*.txt
const recommendationsDir = path.join(__dirname, '..', 'config', 'recommendations');
let npmRecommendations = [];
let pypiRecommendations = [];
try {
  const npmPath = path.join(recommendationsDir, 'npm.txt');
  const pypiPath = path.join(recommendationsDir, 'pypi.txt');
  if (fs.existsSync(npmPath)) {
    npmRecommendations = fs.readFileSync(npmPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
  if (fs.existsSync(pypiPath)) {
    pypiRecommendations = fs.readFileSync(pypiPath, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }
} catch (err) {
  console.warn('Could not load recommendation lists:', err);
}

class Neo4jService {
  async searchPackages(query, ecosystem = 'npm') {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const eco = (ecosystem || 'npm').toLowerCase();

    // Use only the provided recommendation lists (case-insensitive contains match)
    if (eco === 'npm') {
      return npmRecommendations.filter(n => n.toLowerCase().includes(q)).slice(0, 10);
    }
    if (eco === 'pypi' || eco === 'py' || eco === 'pip') {
      return pypiRecommendations.filter(n => n.toLowerCase().includes(q)).slice(0, 10);
    }

    // Unknown ecosystem: return empty list
    return [];
  }

  async getPackageVersions(packageName, ecosystem = 'npm') {
    const session = getSession();
    try {
      const result = await session.run(
        'MATCH (p:Package {name: $name, ecosystem: $ecosystem})-[:HAS_VERSION]->(v:Version) RETURN v.version AS version ORDER BY v.version DESC LIMIT 3',
        { name: packageName, ecosystem }
      );
      return result.records.map(record => record.get('version'));
    } finally {
      await session.close();
    }
  }

  async getPackageAnalysis(packageName, selectedVersion = null, ecosystem = 'npm') {
    const session = getSession();
    try {
      console.log(`Analyzing package: ${packageName}, version: ${selectedVersion || 'latest'}, ecosystem: ${ecosystem}`);
      
      // Step 1: Get all versions
      const versionsResult = await session.run(
        'MATCH (p:Package {name: $name, ecosystem: $ecosystem})-[:HAS_VERSION]->(v:Version) RETURN v.version AS version ORDER BY toInteger(split(v.version,".")[0]) DESC, toInteger(split(v.version,".")[1]) DESC, toInteger(split(v.version,".")[2]) DESC',
        { name: packageName, ecosystem }
      );

      const versions = [...new Set(
        versionsResult.records.map(r => r.get('version'))
      )];

      if (versions.length === 0) {
        // Check if package exists without versions
        const pkgCheck = await session.run(
          'MATCH (p:Package {name: $name, ecosystem: $ecosystem}) RETURN p LIMIT 1',
          { name: packageName, ecosystem }
        );

        if (pkgCheck.records.length === 0) {
          return null; // Truly not found
        }

        // Package exists but has no versions
        return {
          package: {
            name: packageName,
            selectedVersion: null,
            versions: []
          },
          stats: {
            directDependencies: 0,
            directDependents: 0
          },
          dependencies: [],
          dependents: []
        };
      }

      // Determine which version to use
      let versionToUse = null;

      if (selectedVersion && versions.includes(selectedVersion)) {
        versionToUse = selectedVersion;
      } else if (!selectedVersion && versions.length > 0) {
        versionToUse = versions[0];
      }

      // Step 2: Get dependencies for the selected version (with specifier)
      const depsResult = await session.run(
        `MATCH (p:Package {name: $name, ecosystem: $ecosystem})-[:HAS_VERSION]->(v:Version {version: $version})-[r:DEPENDS_ON]->(dep:Package {ecosystem: $ecosystem})
         RETURN dep.name AS name, r.specifier AS specifier`,
        { name: packageName, version: versionToUse, ecosystem }
      );

      const dependencies = depsResult.records.map(r => ({
        name: r.get('name'),
        specifier: r.get('specifier')
      }));

      // Step 3: Get dependents (packages that depend on this one, with all their versions)
      const dependentsResult = await session.run(
        `MATCH (other:Package {ecosystem: $ecosystem})-[:HAS_VERSION]->(ov:Version)-[r:DEPENDS_ON]->(p:Package {name: $name, ecosystem: $ecosystem})
         RETURN other.name AS package, ov.version AS version, r.specifier AS specifier`,
        { name: packageName, ecosystem }
      );

      const dependents = dependentsResult.records.map(r => ({
        package: r.get('package'),
        version: r.get('version'),
        specifier: r.get('specifier')
      }));

      // Return structured object
      return {
        package: {
          name: packageName,
          selectedVersion: versionToUse,
          versions: versions
        },
        stats: {
          directDependencies: dependencies.length,
          directDependents: new Set(dependents.map(d => d.package)).size // Count unique packages
        },
        dependencies: dependencies,
        dependents: dependents
      };
    } finally {
      await session.close();
    }
  }

  async getDependencies(packageName) {
    const session = getSession();
    try {
      // First, get the latest version
      const versionResult = await session.run(
        'MATCH (p:Package {name: $name})-[:HAS_VERSION]->(v:Version) RETURN v.version AS version ORDER BY v.version DESC LIMIT 1',
        { name: packageName }
      );
      if (versionResult.records.length === 0) return [];

      const latestVersion = versionResult.records[0].get('version');

      const result = await session.run(
        'MATCH (p:Package {name: $name})-[:HAS_VERSION]->(v:Version {version: $version})-[:DEPENDS_ON]->(d:Package) RETURN d.name AS name',
        { name: packageName, version: latestVersion }
      );
      return result.records.map(record => record.get('name'));
    } finally {
      await session.close();
    }
  }

  async getDependents(packageName) {
    const session = getSession();
    try {
      const result = await session.run(
        'MATCH (d:Package)-[:HAS_VERSION]->(dv:Version)-[:DEPENDS_ON]->(p:Package {name: $name}) RETURN DISTINCT d.name AS name',
        { name: packageName }
      );
      return result.records.map(record => record.get('name'));
    } finally {
      await session.close();
    }
  }

  async getRecommendations(packageName) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (p:Package {name: $name})<-[:DEPENDS_ON]-(v:Version)<-[:HAS_VERSION]-(parent:Package)-[:HAS_VERSION]->(pv:Version)-[:DEPENDS_ON]->(rec:Package)
         WHERE rec <> p
         RETURN rec.name AS name, count(*) AS frequency
         ORDER BY frequency DESC LIMIT 5`,
        { name: packageName }
      );
      return result.records.map(record => ({
        name: record.get('name'),
        frequency: record.get('frequency').toNumber()
      }));
    } finally {
      await session.close();
    }
  }
  //for whole graph
  async getEcosystemGraph(ecosystem) {
  const session = getSession();
  try {
    const result = await session.run(
      `// Step 1: Find the Top 30 'Hub' packages (highest in-degree)
       MATCH (target:Package {ecosystem: $ecosystem})
       MATCH ()-[:HAS_VERSION]->()-[r:DEPENDS_ON]->(target)
       WITH target, count(r) AS inDegree
       ORDER BY inDegree DESC
       LIMIT 30
       
       // Step 2: Collect them into a list
       WITH collect(target) AS hubs
       
       // Step 3: Find all relationships connected to these hubs
       MATCH (p:Package {ecosystem: $ecosystem})-[:HAS_VERSION]->(v:Version)-[rel:DEPENDS_ON]->(dep:Package {ecosystem: $ecosystem})
       WHERE p IN hubs OR dep IN hubs
       
       RETURN p.name AS source, dep.name AS target, rel.specifier AS specifier
       LIMIT 300`, // Cap at 300 edges to keep the UI smooth
      { ecosystem }
    );
    
    return result.records.map(record => ({
      source: record.get('source'),
      target: record.get('target'),
      specifier: record.get('specifier') || '—'
    }));
  } finally {
    await session.close();
  }
}
}




module.exports = new Neo4jService();