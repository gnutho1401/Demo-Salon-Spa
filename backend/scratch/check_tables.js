const { connectDB, sql } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = await connectDB();
  
  try {
    console.log('Checking for CustomerFavoriteServices...');
    await pool.request().query('SELECT TOP 1 * FROM CustomerFavoriteServices');
    console.log('✅ CustomerFavoriteServices table exists!');
  } catch (err) {
    console.log('❌ CustomerFavoriteServices table does not exist or has errors. Running migration...');
    const sqlPath = path.join(__dirname, '../../database/migrations/create_customer_favorites.sql');
    let rawSql = fs.readFileSync(sqlPath, 'utf8');
    
    // Remove USE statement and GO statements for direct node-mssql execution
    rawSql = rawSql.replace(/USE\s+\w+;/gi, '');
    const statements = rawSql
      .split(/\bGO\b/gi)
      .map(s => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      console.log('Executing statement:', statement.substring(0, 50) + '...');
      await pool.request().query(statement);
    }
    console.log('✅ Migration executed successfully!');
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
