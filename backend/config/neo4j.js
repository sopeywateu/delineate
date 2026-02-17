const neo4j = require('neo4j-driver');

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE;

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  // Fail fast with a clear message in production if credentials are not provided
  throw new Error('Missing Neo4j configuration: set NEO4J_URI, NEO4J_USER and NEO4J_PASSWORD');
}

// Expect the URI to be provided by environment (use neo4j+s:// for Aura)
const driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
);

const getSession = (options = {}) => {
  // Allow callers to override database when needed; otherwise use env or default
  const db = options.database || NEO4J_DATABASE || undefined;
  return driver.session({ database: db });
};

const verifyConnectivity = async () => {
  try {
    await driver.verifyConnectivity();
    return true;
  } catch (err) {
    console.error('Neo4j connectivity check failed:', err.message || err);
    throw err;
  }
};

module.exports = { driver, getSession, verifyConnectivity };