require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {Pool} = require('pg');

const connectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Set DATABASE_URL in the root .env file before applying the schema.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
});

async function applySchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('UniOsunPulse schema applied successfully.');
}

applySchema()
  .catch(error => {
    console.error('Failed to apply the database schema:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
