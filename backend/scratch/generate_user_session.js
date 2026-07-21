const { connectDB } = require('../src/config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const jwtSecret = process.env.JWT_SECRET || 'dev_secret_key';

async function main() {
  const pool = await connectDB();
  
  try {
    const result = await pool.query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.RoleId,
        u.Status,
        u.IsVerified,
        u.AvatarUrl,
        u.GoogleId,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        N'Normal' AS MembershipLevel
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON u.UserId = c.UserId
      WHERE u.Email = 'dgkkienkji@gmail.com'
    `);
    
    const user = result.recordset[0];
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }
    
    const token = jwt.sign(
      {
        userId: user.UserId,
        role: user.RoleName,
      },
      jwtSecret,
      { expiresIn: '1d' }
    );
    
    console.log('--- SESSION DATA ---');
    console.log('TOKEN:', token);
    console.log('USER:', JSON.stringify(user));
  } catch (err) {
    console.error('Error:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
