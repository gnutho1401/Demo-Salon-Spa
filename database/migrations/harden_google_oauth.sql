/* Prevent one Google identity from being linked to multiple local users. */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.Users')
      AND name = 'UX_Users_GoogleId_NotNull'
)
AND NOT EXISTS (
    SELECT GoogleId
    FROM dbo.Users
    WHERE GoogleId IS NOT NULL
    GROUP BY GoogleId
    HAVING COUNT(*) > 1
)
BEGIN
    CREATE UNIQUE INDEX UX_Users_GoogleId_NotNull
        ON dbo.Users(GoogleId)
        WHERE GoogleId IS NOT NULL;
END;

COMMIT TRANSACTION;
