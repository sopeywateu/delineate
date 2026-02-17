const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

const getSession = () => {
  return driver.session({ database: process.env.NEO4J_DATABASE });
};

module.exports = { driver, getSession };