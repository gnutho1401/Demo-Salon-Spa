USE BeautySalonSystem1;
GO

IF COL_LENGTH('dbo.Reviews', 'TechnicianRating') IS NULL
BEGIN
    ALTER TABLE Reviews
    ADD TechnicianRating INT NULL;
END
GO

ALTER TABLE Reviews
ADD CONSTRAINT CK_Reviews_TechnicianRating
CHECK (TechnicianRating IS NULL OR TechnicianRating BETWEEN 1 AND 5);
GO
