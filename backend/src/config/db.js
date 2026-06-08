const sql = require('mssql');
const { db } = require('./env');

let pool;

async function connectDB() {
  if (pool) return pool;
  pool = await sql.connect(db);
  console.log('Connected to SQL Server');
  return pool;
}

module.exports = { sql, connectDB };
