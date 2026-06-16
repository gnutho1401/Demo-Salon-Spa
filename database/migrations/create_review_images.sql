IF OBJECT_ID('dbo.ReviewImages', 'U') IS NULL
BEGIN
    CREATE TABLE ReviewImages (
        ReviewImageId INT IDENTITY(1,1) PRIMARY KEY,
        ReviewId INT NOT NULL,
        ImageUrl NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ReviewImages_Reviews FOREIGN KEY (ReviewId) REFERENCES Reviews(ReviewId) ON DELETE CASCADE
    );

    CREATE INDEX IX_ReviewImages_ReviewId ON ReviewImages(ReviewId);
END
GO
