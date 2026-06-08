const { sql, connectDB } = require('../../config/db');

async function getAll() {
  const pool = await connectDB();
  const result = await pool.request().query(`
    SELECT
      c.CustomerId,
      u.UserId,
      u.FullName,
      u.Email,
      u.Phone,
      u.AvatarUrl,
      c.Gender,
      c.DateOfBirth,
      c.Address,
      c.LoyaltyPoints,
      COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
    FROM Customers c
    JOIN Users u ON c.UserId = u.UserId
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    ORDER BY c.CustomerId DESC
  `);
  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input('CustomerId', sql.Int, id)
    .query(`
      SELECT
        c.CustomerId,
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE c.CustomerId = @CustomerId
    `);

  if (result.recordset.length === 0) throw new Error('Không tìm thấy khách hàng');
  return result.recordset[0];
}

async function getMyProfile(userId) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT
        u.UserId,
        u.FullName,
        u.Email,
        u.Phone,
        u.AvatarUrl,
        u.RoleId,
        u.Status,
        u.IsVerified,
        r.RoleName,
        c.CustomerId,
        c.Gender,
        c.DateOfBirth,
        c.Address,
        c.LoyaltyPoints,
        COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel,
        COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent
      FROM Users u
      JOIN Roles r ON u.RoleId = r.RoleId
      LEFT JOIN Customers c ON u.UserId = c.UserId
      LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
      OUTER APPLY (
        SELECT TOP 1 * FROM MembershipLevels x
        WHERE x.MinPoints <= c.LoyaltyPoints
        ORDER BY x.MinPoints DESC
      ) currentLevel
      WHERE u.UserId = @UserId
    `);

  if (result.recordset.length === 0) throw new Error('Không tìm thấy hồ sơ người dùng');
  return result.recordset[0];
}

async function updateMyProfile(userId, data) {
  const pool = await connectDB();

  const fullName = data.fullName?.trim();
  const phone = data.phone?.trim() || null;
  const gender = data.gender?.trim() || null;
  const dateOfBirth = data.dateOfBirth || null;
  const address = data.address?.trim() || null;

  if (!fullName) throw new Error('Họ tên không được để trống');

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    await new sql.Request(transaction)
      .input('UserId', sql.Int, userId)
      .input('FullName', sql.NVarChar, fullName)
      .input('Phone', sql.NVarChar, phone)
      .query(`
        UPDATE Users
        SET FullName = @FullName,
            Phone = @Phone,
            UpdatedAt = GETDATE()
        WHERE UserId = @UserId
      `);

    const customerResult = await new sql.Request(transaction)
      .input('UserId', sql.Int, userId)
      .query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');

    if (customerResult.recordset.length === 0) {
      await new sql.Request(transaction)
        .input('UserId', sql.Int, userId)
        .input('Gender', sql.NVarChar, gender)
        .input('DateOfBirth', sql.Date, dateOfBirth)
        .input('Address', sql.NVarChar, address)
        .query(`
          INSERT INTO Customers (UserId, Gender, DateOfBirth, Address, LoyaltyPoints, MembershipLevelId)
          VALUES (@UserId, @Gender, @DateOfBirth, @Address, 0, (SELECT TOP 1 MembershipLevelId FROM MembershipLevels WHERE LevelName = N'Normal'))
        `);
    } else {
      await new sql.Request(transaction)
        .input('UserId', sql.Int, userId)
        .input('Gender', sql.NVarChar, gender)
        .input('DateOfBirth', sql.Date, dateOfBirth)
        .input('Address', sql.NVarChar, address)
        .query(`
          UPDATE Customers
          SET Gender = @Gender,
              DateOfBirth = @DateOfBirth,
              Address = @Address
          WHERE UserId = @UserId
        `);
    }

    await transaction.commit();
    return getMyProfile(userId);
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    if (err.message && err.message.includes('UNIQUE')) throw new Error('Số điện thoại đã tồn tại');
    throw err;
  }
}

async function updateMyAvatar(userId, avatarUrl) {
  const pool = await connectDB();
  await pool
    .request()
    .input('UserId', sql.Int, userId)
    .input('AvatarUrl', sql.NVarChar, avatarUrl)
    .query(`
      UPDATE Users
      SET AvatarUrl = @AvatarUrl,
          UpdatedAt = GETDATE()
      WHERE UserId = @UserId
    `);
  return getMyProfile(userId);
}


async function getMyDashboard(userId) {
  const pool = await connectDB();
  const customerResult = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT
      c.CustomerId,
      c.LoyaltyPoints,
      COALESCE(ml.LevelName, currentLevel.LevelName, N'Normal') AS MembershipLevel,
      COALESCE(ml.DiscountPercent, currentLevel.DiscountPercent, 0) AS DiscountPercent
    FROM Customers c
    LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
    OUTER APPLY (
      SELECT TOP 1 * FROM MembershipLevels x
      WHERE x.MinPoints <= c.LoyaltyPoints
      ORDER BY x.MinPoints DESC
    ) currentLevel
    WHERE c.UserId = @UserId
  `);
  const customer = customerResult.recordset[0];
  if (!customer) throw new Error('Không tìm thấy hồ sơ khách hàng');

  const counts = await pool.request().input('CustomerId', sql.Int, customer.CustomerId).query(`
    SELECT
      (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')) AS ActiveAppointments,
      (SELECT COUNT(*) FROM Appointments WHERE CustomerId = @CustomerId AND Status = 'COMPLETED') AS CompletedAppointments,
      (SELECT COUNT(*) FROM CustomerPackages WHERE CustomerId = @CustomerId AND Status = 'ACTIVE') AS ActivePackages,
      (SELECT COUNT(*) FROM Notifications n JOIN Users u ON n.UserId = u.UserId WHERE u.UserId = @UserId AND n.IsRead = 0) AS UnreadNotifications
  `);

  const upcoming = await pool.request().input('CustomerId', sql.Int, customer.CustomerId).query(`
    SELECT TOP 3
      a.AppointmentId, a.AppointmentDate, CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
      a.Status, eu.FullName AS EmployeeName, STRING_AGG(s.ServiceName, N', ') AS ServiceNames
    FROM Appointments a
    JOIN Employees e ON a.EmployeeId = e.EmployeeId
    JOIN Users eu ON e.UserId = eu.UserId
    LEFT JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
    LEFT JOIN Services s ON aps.ServiceId = s.ServiceId
    WHERE a.CustomerId = @CustomerId AND a.Status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
    GROUP BY a.AppointmentId, a.AppointmentDate, a.StartTime, a.Status, eu.FullName
    ORDER BY a.AppointmentDate ASC, a.StartTime ASC
  `);

  return { ...customer, ...counts.recordset[0], UpcomingAppointments: upcoming.recordset };
}

async function createMyFeedback(userId, data) {
  const pool = await connectDB();
  const customer = await pool.request().input('UserId', sql.Int, userId).query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  if (!customer.recordset[0]) throw new Error('Không tìm thấy hồ sơ khách hàng');
  const subject = String(data.subject || '').trim();
  const content = String(data.content || '').trim();
  if (!subject || !content) throw new Error('Vui lòng nhập tiêu đề và nội dung phản hồi');
  const result = await pool.request()
    .input('CustomerId', sql.Int, customer.recordset[0].CustomerId)
    .input('Subject', sql.NVarChar, subject)
    .input('Content', sql.NVarChar, content)
    .query(`
      INSERT INTO Feedbacks (CustomerId, Subject, Content)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @Subject, @Content)
    `);
  return result.recordset[0];
}

async function getMyFeedbacks(userId) {
  const pool = await connectDB();
  const result = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT f.*
    FROM Feedbacks f
    JOIN Customers c ON f.CustomerId = c.CustomerId
    WHERE c.UserId = @UserId
    ORDER BY f.CreatedAt DESC
  `);
  return result.recordset;
}

async function createMyReview(userId, data) {
  const pool = await connectDB();
  const customer = await pool.request().input('UserId', sql.Int, userId).query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  if (!customer.recordset[0]) throw new Error('Không tìm thấy hồ sơ khách hàng');

  const customerId = customer.recordset[0].CustomerId;
  const appointmentId = Number(data.appointmentId);
  const serviceId = Number(data.serviceId);
  const rating = Number(data.rating);
  const comment = String(data.comment || '').trim() || null;

  if (!appointmentId || !serviceId || rating < 1 || rating > 5) {
    throw new Error('Vui lòng chọn dịch vụ đã trải nghiệm và đánh giá từ 1 đến 5 sao');
  }

  const serviceCheck = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .input('AppointmentId', sql.Int, appointmentId)
    .input('ServiceId', sql.Int, serviceId)
    .query(`
      SELECT TOP 1 a.AppointmentId, a.Status, a.EmployeeId, s.ServiceName
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      WHERE a.AppointmentId = @AppointmentId
        AND a.CustomerId = @CustomerId
        AND aps.ServiceId = @ServiceId
    `);

  const item = serviceCheck.recordset[0];
  if (!item) throw new Error('Dịch vụ này không thuộc lịch hẹn của bạn');
  if (String(item.Status).toUpperCase() !== 'COMPLETED') {
    throw new Error('Chỉ được đánh giá dịch vụ sau khi lịch hẹn đã hoàn thành');
  }

  const existed = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .input('AppointmentId', sql.Int, appointmentId)
    .input('ServiceId', sql.Int, serviceId)
    .query(`
      SELECT TOP 1 ReviewId
      FROM Reviews
      WHERE CustomerId = @CustomerId
        AND AppointmentId = @AppointmentId
        AND ServiceId = @ServiceId
    `);
  if (existed.recordset[0]) throw new Error('Bạn đã đánh giá dịch vụ này rồi');

  const result = await pool.request()
    .input('CustomerId', sql.Int, customerId)
    .input('AppointmentId', sql.Int, appointmentId)
    .input('ServiceId', sql.Int, serviceId)
    .input('EmployeeId', sql.Int, item.EmployeeId || null)
    .input('Rating', sql.Int, rating)
    .input('Comment', sql.NVarChar, comment)
    .query(`
      INSERT INTO Reviews (CustomerId, AppointmentId, ServiceId, EmployeeId, Rating, Comment)
      OUTPUT INSERTED.*
      VALUES (@CustomerId, @AppointmentId, @ServiceId, @EmployeeId, @Rating, @Comment)
    `);
  return result.recordset[0];
}

async function getMyReviews(userId) {
  const pool = await connectDB();
  const result = await pool.request().input('UserId', sql.Int, userId).query(`
    SELECT r.*, s.ServiceName
    FROM Reviews r
    JOIN Customers c ON r.CustomerId = c.CustomerId
    LEFT JOIN Services s ON r.ServiceId = s.ServiceId
    WHERE c.UserId = @UserId
    ORDER BY r.CreatedAt DESC
  `);
  return result.recordset;
}

async function getMyReviewableServices(userId) {
  const pool = await connectDB();
  const customer = await pool.request().input('UserId', sql.Int, userId).query('SELECT CustomerId FROM Customers WHERE UserId = @UserId');
  if (!customer.recordset[0]) throw new Error('Không tìm thấy hồ sơ khách hàng');

  const result = await pool.request()
    .input('CustomerId', sql.Int, customer.recordset[0].CustomerId)
    .query(`
      SELECT
        a.AppointmentId,
        a.AppointmentDate,
        CONVERT(VARCHAR(5), a.StartTime, 108) AS StartTime,
        aps.ServiceId,
        s.ServiceName,
        aps.Price,
        eu.FullName AS EmployeeName
      FROM Appointments a
      JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
      JOIN Services s ON aps.ServiceId = s.ServiceId
      JOIN Employees e ON a.EmployeeId = e.EmployeeId
      JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Reviews r
        ON r.CustomerId = a.CustomerId
       AND r.AppointmentId = a.AppointmentId
       AND r.ServiceId = aps.ServiceId
      WHERE a.CustomerId = @CustomerId
        AND a.Status = 'COMPLETED'
        AND r.ReviewId IS NULL
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);
  return result.recordset;
}

async function createGuestContact(data) {
  const pool = await connectDB();
  const fullName = String(data.fullName || data.name || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const subject = String(data.subject || 'Liên hệ từ khách').trim();
  const content = String(data.content || data.message || '').trim();

  if (!fullName || !content) throw new Error('Vui lòng nhập họ tên và nội dung liên hệ');

  const detail = [
    fullName ? `Họ tên: ${fullName}` : '',
    email ? `Email: ${email}` : '',
    phone ? `SĐT: ${phone}` : '',
    '',
    content,
  ].filter(Boolean).join('\n');

  const result = await pool.request()
    .input('Subject', sql.NVarChar, subject)
    .input('Content', sql.NVarChar, detail)
    .query(`
      INSERT INTO Feedbacks (CustomerId, Subject, Content)
      OUTPUT INSERTED.*
      VALUES (NULL, @Subject, @Content)
    `);
  return result.recordset[0];
}

async function create(data) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input('UserId', sql.Int, data.userId)
    .input('Gender', sql.NVarChar, data.gender || null)
    .input('DateOfBirth', sql.Date, data.dateOfBirth || null)
    .input('Address', sql.NVarChar, data.address || null)
    .query(`
      INSERT INTO Customers (UserId, Gender, DateOfBirth, Address)
      OUTPUT INSERTED.*
      VALUES (@UserId, @Gender, @DateOfBirth, @Address)
    `);
  return result.recordset[0];
}

async function update(id, data) {
  const pool = await connectDB();
  const result = await pool
    .request()
    .input('CustomerId', sql.Int, id)
    .input('Gender', sql.NVarChar, data.gender || null)
    .input('DateOfBirth', sql.Date, data.dateOfBirth || null)
    .input('Address', sql.NVarChar, data.address || null)
    .query(`
      UPDATE Customers
      SET Gender = @Gender,
          DateOfBirth = @DateOfBirth,
          Address = @Address
      OUTPUT INSERTED.*
      WHERE CustomerId = @CustomerId
    `);

  if (result.recordset.length === 0) throw new Error('Không tìm thấy khách hàng');
  return result.recordset[0];
}

async function remove(id) {
  const pool = await connectDB();
  await pool.request().input('CustomerId', sql.Int, id).query('DELETE FROM Customers WHERE CustomerId = @CustomerId');
  return { id };
}

module.exports = {
  getAll,
  getById,
  getMyProfile,
  getMyDashboard,
  createMyFeedback,
  getMyFeedbacks,
  createMyReview,
  getMyReviews,
  getMyReviewableServices,
  updateMyProfile,
  updateMyAvatar,
  createGuestContact,
  create,
  update,
  remove,
};
