const sql = require("mssql");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "sa",
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_DATABASE || "BeautySalonSystem1",
  port: parseInt(process.env.DB_PORT || "1433"),
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_CERT === "true",
  }
};

async function main() {
  let pool;
  try {
    console.log("Connecting to SQL Server:", dbConfig.server, "Database:", dbConfig.database);
    pool = await sql.connect(dbConfig);
    console.log("Connected successfully!");

    const requestedPath = process.argv[2];
    if (!requestedPath) {
      throw new Error("Usage: node migrate_db.js <path-to-migration.sql>");
    }
    const sqlFilePath = path.resolve(process.cwd(), requestedPath);
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`Migration file not found: ${sqlFilePath}`);
    }
    const rawSql = fs.readFileSync(sqlFilePath, "utf8");
    const migrationName = path.basename(sqlFilePath);
    const checksum = crypto.createHash("sha256").update(rawSql).digest("hex");

    await pool.request().query(`
      IF OBJECT_ID('dbo.SchemaMigrationHistory', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.SchemaMigrationHistory (
          MigrationId INT IDENTITY(1,1) PRIMARY KEY,
          MigrationName NVARCHAR(260) NOT NULL UNIQUE,
          Checksum CHAR(64) NOT NULL,
          AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
        );
      END
    `);

    const lockResult = await pool
      .request()
      .input("Resource", sql.NVarChar, `schema-migration:${dbConfig.database}`)
      .query(`
        DECLARE @LockResult INT;
        EXEC @LockResult = sp_getapplock
          @Resource = @Resource,
          @LockMode = 'Exclusive',
          @LockOwner = 'Session',
          @LockTimeout = 30000;
        SELECT @LockResult AS LockResult;
      `);
    if (Number(lockResult.recordset[0]?.LockResult) < 0) {
      throw new Error("Could not acquire the database migration lock");
    }

    const applied = await pool
      .request()
      .input("MigrationName", sql.NVarChar, migrationName)
      .query(`
        SELECT MigrationName, Checksum, AppliedAt
        FROM dbo.SchemaMigrationHistory
        WHERE MigrationName = @MigrationName
      `);
    if (applied.recordset.length) {
      if (applied.recordset[0].Checksum !== checksum) {
        throw new Error(
          `Migration ${migrationName} was already applied with a different checksum`
        );
      }
      console.log(`Migration ${migrationName} was already applied; nothing to do.`);
      return;
    }

    // Split SQL by GO keyword
    const statements = rawSql
      .split(/^\s*GO\s*;?\s*$/gim)
      .map(s => s.trim())
      .filter(Boolean);

    console.log(`Found ${statements.length} sql statements to execute.`);

    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}...`);
      await pool.request().query(statements[i]);
    }

    await pool
      .request()
      .input("MigrationName", sql.NVarChar, migrationName)
      .input("Checksum", sql.Char(64), checksum)
      .query(`
        INSERT INTO dbo.SchemaMigrationHistory (MigrationName, Checksum)
        VALUES (@MigrationName, @Checksum)
      `);

    console.log("Database migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

main();
