const { connectDB } = require('../src/config/db');

async function main() {
  const pool = await connectDB();
  const res = await pool.request().query(`
    SELECT 
      fk.name AS FK_Name,
      tp.name AS ParentTable,
      tr.name AS ReferencedTable
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
    INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
    WHERE tr.name IN ('Appointments', 'Invoices', 'Customers', 'Users')
  `);
  console.log('FKs referencing Appointments/Invoices/Customers/Users:', res.recordset);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
