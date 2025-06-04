// mayoristapro/backend/src/db.js
require('dotenv').config(); // Ensure environment variables are loaded

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'user',
  host: process.env.DB_HOST || 'db', // 'db' is the service name in docker-compose
  database: process.env.DB_NAME || 'mayoristapro_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database!');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export pool if direct access is needed, e.g. for transactions
};
