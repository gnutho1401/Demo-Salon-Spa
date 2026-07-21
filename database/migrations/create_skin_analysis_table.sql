IF OBJECT_ID('AISkinAnalysisHistory', 'U') IS NULL
BEGIN
    CREATE TABLE AISkinAnalysisHistory (
        AnalysisId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId INT NOT NULL,
        ImageUrl NVARCHAR(MAX) NOT NULL,
        SkinType NVARCHAR(50) NOT NULL,
        AcneLevel NVARCHAR(50) NOT NULL,
        WrinkleLevel NVARCHAR(50) NOT NULL,
        DarkSpots NVARCHAR(50) NOT NULL,
        Redness NVARCHAR(50) NOT NULL,
        SkinScore INT NOT NULL,
        Summary NVARCHAR(MAX) NOT NULL,
        RoutineSuggestion NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        CONSTRAINT FK_SkinAnalysis_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId) ON DELETE CASCADE
    );
END
GO
