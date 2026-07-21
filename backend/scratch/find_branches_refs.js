const { connectDB } = require('../src/config/db');
require('dotenv').config();

(async () => {
  try {
    const pool = await connectDB();
    const result = await pool.query(`
      SELECT 
          f.name AS foreign_key_name,
          OBJECT_NAME(f.parent_object_id) AS table_name,
          COL_NAME(fc.parent_object_id, fc.parent_column_id) AS constraint_column_name,
          OBJECT_NAME(f.referenced_object_id) AS referenced_table_name,
          COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS referenced_column_name
      FROM 
          sys.foreign_keys AS f
      INNER JOIN 
          sys.foreign_key_columns AS fc 
          ON f.object_id = fc.constraint_object_id
      WHERE 
          OBJECT_NAME(f.referenced_object_id) = 'Branches';
    `);
    console.log("Foreign keys referencing Branches:");
    console.log(result.recordset);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
