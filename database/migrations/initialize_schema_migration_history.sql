IF OBJECT_ID('dbo.SchemaMigrationHistory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.SchemaMigrationHistory (
    MigrationId INT IDENTITY(1,1) PRIMARY KEY,
    MigrationName NVARCHAR(260) NOT NULL UNIQUE,
    Checksum CHAR(64) NOT NULL,
    AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
