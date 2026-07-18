const mssql = require('mssql');
require('dotenv').config({ path: '.env' });

async function check() {
  const conn = await mssql.connect({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
      encrypt: false,
      trustServerCertificate: true
    }
  });

  const res = await conn.query(`
    SELECT c.CustomerId, u.FullName, u.Email, u.Phone 
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
  `);
  console.log('Customers in database:');
  console.table(res.recordset);
  await conn.close();
}

check();
