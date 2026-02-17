const { getSession } = require('../config/neo4j');

class Neo4jService {
  async searchPackages(query) {
    const session = getSession();
    try {
      const result = await session.run(
        'MATCH (p:Package) WHERE toLower(p.name) CONTAINS toLower($query) RETURN p.name AS name LIMIT 10',
        { query }
      );
      return result.records.map(record => record.get('name'));
    } finally {
      await session.close();
    }
  }

  async getPackageVersions(packageName) {
    const session = getSession();
    try {
      const result = await session.run(
        'MATCH (p:Package {name: $name})-[:HAS_VERSION]->(v:Version) RETURN v.version AS version ORDER BY v.version DESC LIMIT 3',
        { name: packageName }
      );
      return result.records.map(record => record.get('version'));
    } finally {
      await session.close();
    }
  }

  async getPackageAnalysis(packageName, selectedVersion = null) {
    const session = getSession();
    try {
      // Step 1: Get all versions
      const versionsResult = await session.run(
        'MATCH (p:Package {name: $name})-[:HAS_VERSION]->(v:Version) RETURN v.version AS version ORDER BY toInteger(split(v.version,".")[0]) DESC, toInteger(split(v.version,".")[1]) DESC, toInteger(split(v.version,".")[2]) DESC',
        { name: packageName }
      );

      const versions = [...new Set(
        versionsResult.records.map(r => r.get('version'))
      )];

      if (versions.length === 0) {
        // Check if package exists without versions
        const pkgCheck = await session.run(
          'MATCH (p:Package {name: $name}) RETURN p LIMIT 1',
          { name: packageName }
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
        `MATCH (p:Package {name: $name})-[:HAS_VERSION]->(v:Version {version: $version})-[r:DEPENDS_ON]->(dep:Package)
         RETURN dep.name AS name, r.specifier AS specifier`,
        { name: packageName, version: versionToUse }
      );

      const dependencies = depsResult.records.map(r => ({
        name: r.get('name'),
        specifier: r.get('specifier')
      }));

      // Step 3: Get dependents (packages that depend on this one, with all their versions)
      const dependentsResult = await session.run(
        `MATCH (other:Package)-[:HAS_VERSION]->(ov:Version)-[r:DEPENDS_ON]->(p:Package {name: $name})
         RETURN other.name AS package, ov.version AS version, r.specifier AS specifier`,
        { name: packageName }
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
}

module.exports = new Neo4jService();