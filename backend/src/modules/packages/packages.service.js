const { sql, connectDB } = require("../../config/db");
const crypto = require("crypto");
const { getPayOS } = require("../../config/payos.config");
const { findAvailableTechnician } = require("../appointments/availability.service");

function formatVnpDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = obj[key];
    });
  return sorted;
}

function buildQuery(obj) {
  return Object.keys(obj)
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(obj[key]).replace(/%20/g, "+")}`,
    )
    .join("&");
}

function createVnpHash(params) {
  const secret = process.env.VNP_HASH_SECRET;
  if (!secret) throw new Error("Thiếu VNP_HASH_SECRET trong file .env");

  const signData = buildQuery(sortObject(params));
  return crypto
    .createHmac("sha512", secret)
    .update(Buffer.from(signData, "utf-8"))
    .digest("hex");
}

async function checkAndExpirePackages() {
  try {
    const pool = await connectDB();
    const expiredPkgs = await pool.request().query(`
      SELECT cp.CustomerPackageId, cp.CustomerId, cp.EndDate, cp.Status, p.PackageName, u.UserId, u.Email, u.FullName
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      JOIN Customers c ON cp.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE cp.Status = 'ACTIVE'
        AND cp.EndDate < CAST(GETDATE() AS DATE)
    `);

    if (!expiredPkgs.recordset || expiredPkgs.recordset.length === 0) return;

    const sendMail = require("../../utils/sendMail");
    const { create: createNotification } = require("../notifications/notifications.service");

    for (const pkg of expiredPkgs.recordset) {
      await pool.request()
        .input("CustomerPackageId", sql.Int, pkg.CustomerPackageId)
        .query(`UPDATE CustomerPackages SET Status = 'EXPIRED', UpdatedAt = GETDATE() WHERE CustomerPackageId = @CustomerPackageId`);

      // 1. Web Notification
      await createNotification({
        userId: pkg.UserId,
        title: "⏳ Gói Combo đã hết hạn sử dụng",
        content: `Gói Combo '${pkg.PackageName}' (#CP-${pkg.CustomerPackageId}) của bạn đã hết thời hạn sử dụng. Gói Combo đã tự động thanh lý và không thể đặt thêm lịch mới.`,
        type: "COMBO_EXPIRED"
      });

      // 2. Email Notification
      if (pkg.Email) {
        const endDateStr = pkg.EndDate ? new Date(pkg.EndDate).toLocaleDateString("vi-VN") : "—";
        sendMail({
          to: pkg.Email,
          subject: "Beauty Salon - Thông báo gói Combo đã hết hạn sử dụng",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; background: #fff1f2; border-radius: 12px;">
              <h2 style="color: #be123c;">Xin chào ${pkg.FullName},</h2>
              <p>Beauty Salon xin thông báo gói Combo <strong>${pkg.PackageName}</strong> của bạn đã hết thời hạn sử dụng.</p>
              <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #fecdd3; margin: 15px 0;">
                <p style="margin: 4px 0;">📍 <strong>Mã gói Combo:</strong> #CP-${pkg.CustomerPackageId}</p>
                <p style="margin: 4px 0;">📅 <strong>Hạn cuối sử dụng:</strong> ${endDateStr}</p>
              </div>
              <p>Theo quy định của Salon, các gói Combo quá hạn sẽ tự động thanh lý và không thể tiếp tục đăng ký đặt lịch mới.</p>
              <p style="color: #881337; font-size: 13px; margin-top: 20px;">Trân trọng,<br/>Đội ngũ Beauty Salon</p>
            </div>
          `
        }).catch(err => console.error("Send mail expired combo error:", err.message));
      }
    }
  } catch (err) {
    console.error("Error in checkAndExpirePackages:", err.message);
  }
}

function verifyVnpParams(query) {
  const params = {};
  for (const key in query) {
    if (key.startsWith("vnp_") && key !== "vnp_SecureHash" && key !== "vnp_SecureHashType") {
      params[key] = query[key];
    }
  }

  const generated = createVnpHash(params);
  return String(generated).toLowerCase() === String(query.vnp_SecureHash).toLowerCase();
}

async function getCustomerByUserId(pool, userId) {
  const result = await pool.request().input("UserId", sql.Int, userId).query(`
      SELECT CustomerId
      FROM Customers
      WHERE UserId = @UserId
    `);

  return result.recordset[0];
}

function calcDiscount(originalPrice, salePrice) {
  const original = Number(originalPrice || 0);
  const sale = Number(salePrice || original);

  return {
    originalPrice: original,
    discountAmount: Math.max(original - sale, 0),
    finalPrice: sale,
  };
}

async function getAll(filters = {}) {
  const pool = await connectDB();

  const request = pool
    .request()
    .input("Search", sql.NVarChar, `%${filters.search || ""}%`)
    .input("Category", sql.NVarChar, filters.category || null)
    .input(
      "MinPrice",
      sql.Decimal(18, 2),
      filters.minPrice ? Number(filters.minPrice) : null,
    )
    .input(
      "MaxPrice",
      sql.Decimal(18, 2),
      filters.maxPrice ? Number(filters.maxPrice) : null,
    );

  const orderBy =
    {
      priceAsc: "FinalPrice ASC, PackageId DESC",
      priceDesc: "FinalPrice DESC, PackageId DESC",
      sessionsDesc: "TotalSessions DESC, PackageId DESC",
      newest: "PackageId DESC",
    }[filters.sort] || "PackageId DESC";

  const result = await request.query(`
    SELECT *
    FROM (
      SELECT
        p.PackageId,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName,
        ISNULL(p.TotalSessions, 1) AS TotalSessions,
        CAST(p.SalePrice AS DECIMAL(18,2)) AS FinalPrice,
        COUNT(ps.ServiceId) AS ServiceCount,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM Packages p
      LEFT JOIN PackageCategories pc
        ON p.PackageCategoryId = pc.PackageCategoryId
      LEFT JOIN PackageServices ps
        ON p.PackageId = ps.PackageId
      LEFT JOIN Services s
        ON ps.ServiceId = s.ServiceId
      WHERE p.Status = 'ACTIVE'
        AND (@Category IS NULL OR pc.CategoryName = @Category)
        AND (
          p.PackageName LIKE @Search
          OR p.Description LIKE @Search
          OR s.ServiceName LIKE @Search
          OR pc.CategoryName LIKE @Search
        )
      GROUP BY
        p.PackageId,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        pc.CategoryName,
        p.TotalSessions
    ) x
    WHERE (@MinPrice IS NULL OR x.FinalPrice >= @MinPrice)
      AND (@MaxPrice IS NULL OR x.FinalPrice <= @MaxPrice)
    ORDER BY ${orderBy}
  `);

  return result.recordset.map(pkg => {
    const original = Number(pkg.OriginalPrice || 0);
    const sale = Number(pkg.SalePrice || 0);
    const discountPercent = original > 0 ? Math.round(((original - sale) / original) * 100) : 0;
    return {
      ...pkg,
      Price: original,
      FinalPrice: sale,
      DiscountPercent: discountPercent
    };
  });
}

async function getCategories() {
  const pool = await connectDB();

  const result = await pool.request().query(`
    SELECT
      ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName,
      COUNT(p.PackageId) AS Total
    FROM Packages p
    LEFT JOIN PackageCategories pc
      ON p.PackageCategoryId = pc.PackageCategoryId
    WHERE p.Status = 'ACTIVE'
    GROUP BY ISNULL(pc.CategoryName, N'Liệu trình')
    ORDER BY CategoryName
  `);

  return result.recordset;
}

async function getById(id) {
  const pool = await connectDB();

  const packageResult = await pool.request().input("PackageId", sql.Int, id)
    .query(`
      SELECT
        p.PackageId,
        p.PackageCategoryId,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.TotalSessions,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        p.CreatedAt,
        p.UpdatedAt,
        ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName,
        CAST(p.SalePrice AS DECIMAL(18,2)) AS FinalPrice
      FROM Packages p
      LEFT JOIN PackageCategories pc
        ON p.PackageCategoryId = pc.PackageCategoryId
      WHERE p.PackageId = @PackageId
        AND p.Status = 'ACTIVE'
    `);

  const item = packageResult.recordset[0];
  if (!item) throw new Error("Không tìm thấy combo / liệu trình");

  const services = await pool.request().input("PackageId", sql.Int, id).query(`
      SELECT
        s.ServiceId,
        s.ServiceName,
        s.Description,
        s.Price,
        s.DurationMinutes,
        s.ImageUrl,
        s.CategoryId,
        ps.SessionCount
      FROM PackageServices ps
      JOIN Services s
        ON ps.ServiceId = s.ServiceId
      WHERE ps.PackageId = @PackageId
      ORDER BY s.ServiceName
    `);

  item.Services = services.recordset;
  item.ServiceNames = services.recordset.map((x) => x.ServiceName).join(", ");

  const original = Number(item.OriginalPrice || 0);
  const sale = Number(item.SalePrice || 0);
  item.Price = original;
  item.FinalPrice = sale;
  item.DiscountPercent = original > 0 ? Math.round(((original - sale) / original) * 100) : 0;

  return item;
}

async function getMine(userId, customerId = null) {
  const pool = await connectDB();

  let customer;
  if (customerId) {
    customer = { CustomerId: customerId };
  } else {
    customer = await getCustomerByUserId(pool, userId);
  }
  if (!customer) return [];

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      WITH LatestPayments AS (
        SELECT 
          PackagePaymentId,
          CustomerPackageId,
          Amount,
          PaymentMethod,
          Status AS PaymentStatus,
          TransactionCode,
          PaidAt,
          ROW_NUMBER() OVER (PARTITION BY CustomerPackageId ORDER BY PackagePaymentId DESC) as rn
        FROM PackagePayments
      )
      SELECT
        cp.CustomerPackageId,
        cp.CustomerId,
        cp.PackageId,
        cp.StartDate,
        cp.EndDate,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.Status,
        CAST(CASE WHEN cp.CustomerId = @CustomerId THEN 1 ELSE 0 END AS BIT) AS IsOwner,

        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.ImageUrl,
        p.ValidityDays,
        ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName,

        pp.PackagePaymentId,
        pp.Amount,
        pp.PaymentMethod,
        pp.PaymentStatus,
        pp.TransactionCode,
        pp.PaidAt,

        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM CustomerPackages cp
      JOIN Packages p
        ON cp.PackageId = p.PackageId
      LEFT JOIN PackageCategories pc
        ON p.PackageCategoryId = pc.PackageCategoryId
      LEFT JOIN LatestPayments pp
        ON cp.CustomerPackageId = pp.CustomerPackageId AND pp.rn = 1
      LEFT JOIN PackageServices ps
        ON p.PackageId = ps.PackageId
      LEFT JOIN Services s
        ON ps.ServiceId = s.ServiceId
      WHERE cp.CustomerId = @CustomerId
         OR EXISTS (
           SELECT 1 FROM PackageMembers pm
           WHERE pm.CustomerPackageId = cp.CustomerPackageId
             AND pm.FamilyCustomerId = @CustomerId
         )
      GROUP BY
        cp.CustomerPackageId,
        cp.CustomerId,
        cp.PackageId,
        cp.StartDate,
        cp.EndDate,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.Status,

        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.ImageUrl,
        p.ValidityDays,
        pc.CategoryName,

        pp.PackagePaymentId,
        pp.Amount,
        pp.PaymentMethod,
        pp.PaymentStatus,
        pp.TransactionCode,
        pp.PaidAt
      ORDER BY cp.CustomerPackageId DESC
    `);

  return result.recordset;
}

async function getUsageHistory(userId, customerPackageId) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("CustomerPackageId", sql.Int, Number(customerPackageId)).query(`
      SELECT
        u.UsageId,
        u.CustomerPackageId,
        u.AppointmentId,
        u.ServiceId,
        s.ServiceName,
        u.SessionsUsed,
        u.Status,
        u.UsedAt,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status AS AppointmentStatus,
        eu.FullName AS TechnicianName,
        eu.FullName AS EmployeeName,
        a.AppointmentDate AS UsedDate,
        uu.FullName AS UsedByName
      FROM CustomerPackageUsages u
      JOIN CustomerPackages cp
        ON u.CustomerPackageId = cp.CustomerPackageId
      JOIN Appointments a
        ON u.AppointmentId = a.AppointmentId
      JOIN Services s
        ON u.ServiceId = s.ServiceId
      LEFT JOIN Employees e
        ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu
        ON e.UserId = eu.UserId
      LEFT JOIN Users uu
        ON u.UsedBy = uu.UserId
      WHERE u.CustomerPackageId = @CustomerPackageId
        AND (cp.CustomerId = @CustomerId
          OR EXISTS (
            SELECT 1 FROM PackageMembers pm
            WHERE pm.CustomerPackageId = cp.CustomerPackageId
              AND pm.FamilyCustomerId = @CustomerId
          ))
      ORDER BY u.UsedAt DESC, u.UsageId DESC
    `);

  return result.recordset;
}

async function getUsageHistoryPaginated(userId, customerPackageId, page = 1, limit = 5) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const p = Math.max(1, Number(page) || 1);
  const l = Math.max(1, Number(limit) || 5);
  const offset = (p - 1) * l;

  const countRes = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("CustomerPackageId", sql.Int, Number(customerPackageId)).query(`
      SELECT COUNT(*) AS Total
      FROM CustomerPackageUsages u
      JOIN CustomerPackages cp ON u.CustomerPackageId = cp.CustomerPackageId
      WHERE u.CustomerPackageId = @CustomerPackageId
        AND (cp.CustomerId = @CustomerId OR EXISTS (
          SELECT 1 FROM PackageMembers pm WHERE pm.CustomerPackageId = cp.CustomerPackageId AND pm.FamilyCustomerId = @CustomerId
        ))
    `);

  const total = countRes.recordset[0]?.Total || 0;

  const result = await pool
    .request()
    .input("CustomerId", sql.Int, customer.CustomerId)
    .input("CustomerPackageId", sql.Int, Number(customerPackageId))
    .input("Offset", sql.Int, offset)
    .input("Limit", sql.Int, l).query(`
      SELECT
        u.UsageId,
        u.CustomerPackageId,
        u.AppointmentId,
        u.ServiceId,
        s.ServiceName,
        u.SessionsUsed,
        u.Status,
        u.UsedAt,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status AS AppointmentStatus,
        eu.FullName AS TechnicianName,
        eu.FullName AS EmployeeName,
        a.AppointmentDate AS UsedDate,
        uu.FullName AS UsedByName
      FROM CustomerPackageUsages u
      JOIN CustomerPackages cp ON u.CustomerPackageId = cp.CustomerPackageId
      JOIN Appointments a ON u.AppointmentId = a.AppointmentId
      JOIN Services s ON u.ServiceId = s.ServiceId
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Users uu ON u.UsedBy = uu.UserId
      WHERE u.CustomerPackageId = @CustomerPackageId
        AND (cp.CustomerId = @CustomerId OR EXISTS (
          SELECT 1 FROM PackageMembers pm WHERE pm.CustomerPackageId = cp.CustomerPackageId AND pm.FamilyCustomerId = @CustomerId
        ))
      ORDER BY u.UsedAt DESC, u.UsageId DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

  return {
    data: result.recordset,
    pagination: {
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l)
    }
  };
}

async function getActivePackage(pool, packageId) {
  const result = await pool.request().input("PackageId", sql.Int, packageId)
    .query(`
      SELECT
        p.PackageId,
        p.PackageCategoryId,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.TotalSessions,
        p.ValidityDays,
        p.ImageUrl,
        p.IsHot,
        p.Status,
        ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName
      FROM Packages p
      LEFT JOIN PackageCategories pc
        ON p.PackageCategoryId = pc.PackageCategoryId
      WHERE p.PackageId = @PackageId
        AND p.Status = 'ACTIVE'
    `);

  return result.recordset[0];
}

async function createCustomerPackageTransaction(
  transaction,
  customerId,
  pkg,
  paymentMethod,
  status,
  transactionCode,
) {
  const totalSessions = Math.max(Number(pkg.TotalSessions || 1), 1);
  const prices = calcDiscount(pkg.OriginalPrice, pkg.SalePrice);

  const packageStatus = status === "PAID" ? "ACTIVE" : "PENDING_PAYMENT";
  const remainingSessions = status === "PAID" ? totalSessions : 0;

  const customerPackage = await new sql.Request(transaction)
    .input("CustomerId", sql.Int, customerId)
    .input("PackageId", sql.Int, pkg.PackageId)
    .input("ValidityDays", sql.Int, pkg.ValidityDays || 30)
    .input("TotalSessions", sql.Int, totalSessions)
    .input("RemainingSessions", sql.Int, remainingSessions)
    .input("PackageStatus", sql.NVarChar, packageStatus).query(`
      INSERT INTO CustomerPackages
      (
        CustomerId,
        PackageId,
        StartDate,
        EndDate,
        TotalSessions,
        UsedSessions,
        RemainingSessions,
        Status
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @CustomerId,
        @PackageId,
        CAST(GETDATE() AS DATE),
        CAST(GETDATE() AS DATE) + CAST(@ValidityDays AS INT),
        @TotalSessions,
        0,
        @RemainingSessions,
        @PackageStatus
      )
    `);

  const cp = customerPackage.recordset[0];

  const payment = await new sql.Request(transaction)
    .input("CustomerPackageId", sql.Int, cp.CustomerPackageId)
    .input("Amount", sql.Decimal(18, 2), prices.finalPrice)
    .input("PaymentMethod", sql.NVarChar, paymentMethod)
    .input("Status", sql.NVarChar, status)
    .input("TransactionCode", sql.NVarChar, transactionCode).query(`
      INSERT INTO PackagePayments
      (
        CustomerPackageId,
        Amount,
        PaymentMethod,
        Status,
        TransactionCode,
        PaidAt
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @CustomerPackageId,
        @Amount,
        @PaymentMethod,
        @Status,
        @TransactionCode,
        CASE WHEN CAST(@Status AS VARCHAR) = 'PAID' THEN GETDATE() ELSE NULL END
      )
    `);

  if (status === "PAID") {
    await new sql.Request(transaction)
      .input("CustomerId", sql.Int, customerId)
      .input(
        "Points",
        sql.Int,
        Math.floor(Number(prices.finalPrice || 0) / 10000),
      ).query(`
        UPDATE Customers
        SET LoyaltyPoints = LoyaltyPoints + @Points
        WHERE CustomerId = @CustomerId
      `);
  }

  return {
    customerPackage: cp,
    payment: payment.recordset[0],
  };
}

async function checkExistingPackage(pool, customerId, packageId) {
  const existingPkg = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("PackageId", sql.Int, packageId)
    .query(`
      SELECT TOP 1 Status
      FROM CustomerPackages
      WHERE CustomerId = @CustomerId 
        AND PackageId = @PackageId 
        AND Status IN ('ACTIVE', 'PENDING_PAYMENT', 'FROZEN')
    `);
  if (existingPkg.recordset.length > 0) {
    const status = existingPkg.recordset[0].Status;
    if (status === 'PENDING_PAYMENT') {
      throw new Error("Bạn đã đăng ký combo này và đang chờ thanh toán. Vui lòng thanh toán gói hiện tại hoặc hủy để đăng ký lại.");
    } else {
      throw new Error("Bạn đang sở hữu combo này ở trạng thái hoạt động hoặc tạm khóa.");
    }
  }
}

async function checkPendingPackage(pool, customerId, packageId) {
  const existingPkg = await pool.request()
    .input("CustomerId", sql.Int, customerId)
    .input("PackageId", sql.Int, packageId)
    .query(`
      SELECT TOP 1 CustomerPackageId
      FROM CustomerPackages
      WHERE CustomerId = @CustomerId 
        AND PackageId = @PackageId 
        AND Status = 'PENDING_PAYMENT'
    `);
  if (existingPkg.recordset.length > 0) {
    throw new Error("Bạn đã đăng ký combo này và đang chờ thanh toán. Vui lòng thanh toán gói hiện tại hoặc hủy giao dịch cũ trong mục 'Liệu trình của tôi'.");
  }
}

async function buyPackage(userId, packageId, payload = {}) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const pkg = await getActivePackage(pool, packageId);
  if (!pkg)
    throw new Error("Combo / liệu trình không tồn tại hoặc đã ngừng bán");

  await checkPendingPackage(pool, customer.CustomerId, packageId);

  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();

    const result = await createCustomerPackageTransaction(
      transaction,
      customer.CustomerId,
      pkg,
      payload.paymentMethod || "CASH",
      "PAID",
      `PKG${Date.now()}`,
    );

    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function createVnpayPackageUrl(
  userId,
  packageId,
  payload = {},
  ipAddr = "127.0.0.1",
) {
  const vnpUrl =
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const tmnCode = process.env.VNP_TMN_CODE;
  const returnUrl =
    process.env.VNP_PACKAGE_RETURN_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/api/packages/vnpay-return`;

  if (!tmnCode) throw new Error("Thiếu VNP_TMN_CODE trong file .env");

  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const pkg = await getActivePackage(pool, packageId);
  if (!pkg)
    throw new Error("Combo / liệu trình không tồn tại hoặc đã ngừng bán");

  await checkPendingPackage(pool, customer.CustomerId, packageId);

  const prices = calcDiscount(pkg.OriginalPrice, pkg.SalePrice);
  const txnRef = `PKG${packageId}_${Date.now()}`;

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await createCustomerPackageTransaction(
      transaction,
      customer.CustomerId,
      pkg,
      "VNPAY",
      "PENDING",
      txnRef,
    );

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(Number(prices.finalPrice || 0) * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Thanh toan combo lieu trinh ${packageId}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: formatVnpDate(),
  };

  const sorted = sortObject(params);
  sorted.vnp_SecureHash = createVnpHash(sorted);

  return {
    paymentUrl: `${vnpUrl}?${buildQuery(sorted)}`,
    amount: prices.finalPrice,
    transactionCode: txnRef,
  };
}

async function createVnpayRepayUrl(
  userId,
  customerPackageId,
  ipAddr = "127.0.0.1",
) {
  const vnpUrl =
    process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  const tmnCode = process.env.VNP_TMN_CODE;
  const returnUrl =
    process.env.VNP_PACKAGE_RETURN_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/api/packages/vnpay-return`;

  if (!tmnCode) throw new Error("Thiếu VNP_TMN_CODE trong file .env");

  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  // Lấy chi tiết liệu trình hiện tại và kiểm tra quyền sở hữu
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT cp.*, p.PackageName, p.OriginalPrice, p.SalePrice
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerPackageId = @CustomerPackageId AND cp.CustomerId = @CustomerId
    `);

  const cp = pkgResult.recordset[0];
  if (!cp) {
    throw new Error("Không tìm thấy liệu trình này hoặc bạn không có quyền sở hữu");
  }

  if (cp.Status !== "PENDING_PAYMENT") {
    throw new Error("Liệu trình này không ở trạng thái chờ thanh toán");
  }

  const prices = calcDiscount(cp.OriginalPrice, cp.SalePrice);
  const txnRef = `REPKG${customerPackageId}_${Date.now()}`;

  // Tạo một bản ghi thanh toán PENDING mới cho lần thanh toán này
  await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("Amount", sql.Decimal(18, 2), prices.finalPrice)
    .input("PaymentMethod", sql.NVarChar, "VNPAY")
    .input("Status", sql.NVarChar, "PENDING")
    .input("TransactionCode", sql.NVarChar, txnRef).query(`
      INSERT INTO PackagePayments
      (
        CustomerPackageId,
        Amount,
        PaymentMethod,
        Status,
        TransactionCode,
        PaidAt
      )
      VALUES
      (
        @CustomerPackageId,
        @Amount,
        @PaymentMethod,
        @Status,
        @TransactionCode,
        NULL
      )
    `);

  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(Number(prices.finalPrice || 0) * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: `Thanh toan lai combo lieu trinh ${customerPackageId}`,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: formatVnpDate(),
  };

  const sorted = sortObject(params);
  sorted.vnp_SecureHash = createVnpHash(sorted);

  return {
    paymentUrl: `${vnpUrl}?${buildQuery(sorted)}`,
    amount: prices.finalPrice,
    transactionCode: txnRef,
  };
}

async function createPayosRepayUrl(userId, customerPackageId) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  // Get customer package details and check ownership
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT cp.*, p.PackageName, p.OriginalPrice, p.SalePrice
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerPackageId = @CustomerPackageId AND cp.CustomerId = @CustomerId
    `);

  const cp = pkgResult.recordset[0];
  if (!cp) {
    throw new Error("Không tìm thấy liệu trình này hoặc bạn không có quyền sở hữu");
  }

  if (cp.Status !== "PENDING_PAYMENT") {
    throw new Error("Liệu trình này không ở trạng thái chờ thanh toán");
  }

  const prices = calcDiscount(cp.OriginalPrice, cp.SalePrice);
  const orderCode = Number(`${customerPackageId}${Date.now() % 1000000}`);

  // Create a new PENDING PackagePayments record
  await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("Amount", sql.Decimal(18, 2), prices.finalPrice)
    .input("PaymentMethod", sql.NVarChar, "PAYOS")
    .input("Status", sql.NVarChar, "PENDING")
    .input("TransactionCode", sql.NVarChar, String(orderCode)).query(`
      INSERT INTO PackagePayments
      (
        CustomerPackageId,
        Amount,
        PaymentMethod,
        Status,
        TransactionCode,
        PaidAt
      )
      VALUES
      (
        @CustomerPackageId,
        @Amount,
        @PaymentMethod,
        @Status,
        @TransactionCode,
        NULL
      )
    `);

  const payos = getPayOS();

  const returnUrl =
    process.env.PAYOS_PACKAGE_RETURN_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/api/packages/payos-return`;

  const cancelUrl =
    `${process.env.FRONTEND_URL || "http://localhost:5173"}/customer/packages?cancel=1`;

  const paymentData = {
    orderCode: orderCode,
    amount: Math.round(Number(prices.finalPrice || 0)),
    description: `Tra combo #${customerPackageId}`.slice(0, 25),
    returnUrl: returnUrl,
    cancelUrl: cancelUrl,
    items: [
      {
        name: cp.PackageName.slice(0, 50),
        quantity: 1,
        price: Math.round(Number(prices.finalPrice || 0)),
      },
    ],
  };

  const paymentLink = await payos.paymentRequests.create(paymentData);

  return {
    paymentUrl: paymentLink.checkoutUrl,
    amount: prices.finalPrice,
    transactionCode: String(orderCode),
  };
}

async function handleVnpayReturn(query) {
  const isValid = verifyVnpParams(query);
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  const txnRef = query.vnp_TxnRef;
  const responseCode = query.vnp_ResponseCode;
  const transactionNo = query.vnp_TransactionNo;
  const paidAmount = Number(query.vnp_Amount || 0) / 100;

  const pool = await connectDB();

  const found = await pool
    .request()
    .input("TransactionCode", sql.NVarChar, txnRef).query(`
      SELECT TOP 1
        pp.PackagePaymentId,
        pp.Amount,
        pp.Status,
        cp.CustomerPackageId,
        cp.CustomerId,
        cp.PackageId,
        p.ValidityDays,
        p.TotalSessions
      FROM PackagePayments pp
      JOIN CustomerPackages cp
        ON pp.CustomerPackageId = cp.CustomerPackageId
      JOIN Packages p
        ON cp.PackageId = p.PackageId
      WHERE pp.TransactionCode = @TransactionCode
    `);

  const payment = found.recordset[0];

  if (!payment) {
    return `${frontendUrl}/customer/packages?error=payment_not_found`;
  }

  const failUrl = `${frontendUrl}/customer/packages?error=vnpay_failed`;

  if (
    !isValid ||
    responseCode !== "00" ||
    Math.round(Number(payment.Amount || 0)) !== Math.round(paidAmount)
  ) {
    await pool
      .request()
      .input("PackagePaymentId", sql.Int, payment.PackagePaymentId).query(`
        UPDATE PackagePayments
        SET Status = 'FAILED'
        WHERE PackagePaymentId = @PackagePaymentId
          AND Status = 'PENDING';

        UPDATE CustomerPackages
        SET Status = 'CANCELLED'
        WHERE CustomerPackageId = (
          SELECT CustomerPackageId
          FROM PackagePayments
          WHERE PackagePaymentId = @PackagePaymentId
        )
        AND Status = 'PENDING_PAYMENT';
      `);

    return failUrl;
  }

  if (String(payment.Status).toUpperCase() !== "PAID") {
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      await new sql.Request(transaction)
        .input("PackagePaymentId", sql.Int, payment.PackagePaymentId)
        .input("TransactionNo", sql.NVarChar, transactionNo || txnRef).query(`
          UPDATE PackagePayments
          SET
            Status = 'PAID',
            PaidAt = GETDATE(),
            VnpTransactionNo = @TransactionNo
          WHERE PackagePaymentId = @PackagePaymentId
        `);

      await new sql.Request(transaction)
        .input("CustomerPackageId", sql.Int, payment.CustomerPackageId)
        .input("ValidityDays", sql.Int, payment.ValidityDays || 30)
        .input(
          "TotalSessions",
          sql.Int,
          Math.max(Number(payment.TotalSessions || 1), 1),
        ).query(`
          UPDATE CustomerPackages
          SET
            Status = 'ACTIVE',
            StartDate = CAST(GETDATE() AS DATE),
            EndDate = CAST(GETDATE() AS DATE) + CAST(@ValidityDays AS INT),
            TotalSessions = @TotalSessions,
            RemainingSessions = @TotalSessions,
            UpdatedAt = GETDATE()
          WHERE CustomerPackageId = @CustomerPackageId
        `);

      await new sql.Request(transaction)
        .input("CustomerId", sql.Int, payment.CustomerId)
        .input(
          "Points",
          sql.Int,
          Math.floor(Number(payment.Amount || 0) / 10000),
        ).query(`
          UPDATE Customers
          SET LoyaltyPoints = LoyaltyPoints + @Points
          WHERE CustomerId = @CustomerId
        `);

      await transaction.commit();
    } catch (err) {
      try {
        await transaction.rollback();
      } catch (_) {}
      throw err;
    }
  }

  return `${frontendUrl}/customer/packages?paid=1`;
}

async function create(data) {
  const pool = await connectDB();

  const result = await pool
    .request()
    .input(
      "PackageCategoryId",
      sql.Int,
      data.packageCategoryId || data.PackageCategoryId || null,
    )
    .input("PackageName", sql.NVarChar, data.packageName || data.PackageName)
    .input(
      "Description",
      sql.NVarChar,
      data.description || data.Description || null,
    )
    .input(
      "OriginalPrice",
      sql.Decimal(18, 2),
      data.originalPrice || data.OriginalPrice || data.price || data.Price || 0,
    )
    .input(
      "SalePrice",
      sql.Decimal(18, 2),
      data.salePrice || data.SalePrice || data.price || data.Price || 0,
    )
    .input(
      "TotalSessions",
      sql.Int,
      data.totalSessions || data.TotalSessions || 1,
    )
    .input(
      "ValidityDays",
      sql.Int,
      data.validityDays || data.ValidityDays || 30,
    )
    .input("ImageUrl", sql.NVarChar, data.imageUrl || data.ImageUrl || null)
    .input("IsHot", sql.Bit, data.isHot || data.IsHot || 0).query(`
      INSERT INTO Packages
      (
        PackageCategoryId,
        PackageName,
        Description,
        OriginalPrice,
        SalePrice,
        TotalSessions,
        ValidityDays,
        ImageUrl,
        IsHot
      )
      OUTPUT INSERTED.*
      VALUES
      (
        @PackageCategoryId,
        @PackageName,
        @Description,
        @OriginalPrice,
        @SalePrice,
        @TotalSessions,
        @ValidityDays,
        @ImageUrl,
        @IsHot
      )
    `);

  return result.recordset[0];
}

async function update(id, data) {
  const pool = await connectDB();

  await pool
    .request()
    .input("PackageId", sql.Int, id)
    .input(
      "PackageCategoryId",
      sql.Int,
      data.packageCategoryId || data.PackageCategoryId || null,
    )
    .input(
      "PackageName",
      sql.NVarChar,
      data.packageName || data.PackageName || null,
    )
    .input(
      "Description",
      sql.NVarChar,
      data.description || data.Description || null,
    )
    .input(
      "OriginalPrice",
      sql.Decimal(18, 2),
      data.originalPrice ||
        data.OriginalPrice ||
        data.price ||
        data.Price ||
        null,
    )
    .input(
      "SalePrice",
      sql.Decimal(18, 2),
      data.salePrice || data.SalePrice || data.price || data.Price || null,
    )
    .input(
      "TotalSessions",
      sql.Int,
      data.totalSessions || data.TotalSessions || null,
    )
    .input(
      "ValidityDays",
      sql.Int,
      data.validityDays || data.ValidityDays || null,
    )
    .input("ImageUrl", sql.NVarChar, data.imageUrl || data.ImageUrl || null)
    .input("IsHot", sql.Bit, data.isHot ?? data.IsHot ?? null)
    .input("Status", sql.NVarChar, data.status || data.Status || null).query(`
      UPDATE Packages
      SET
        PackageCategoryId = COALESCE(@PackageCategoryId, PackageCategoryId),
        PackageName = COALESCE(@PackageName, PackageName),
        Description = COALESCE(@Description, Description),
        OriginalPrice = COALESCE(@OriginalPrice, OriginalPrice),
        SalePrice = COALESCE(@SalePrice, SalePrice),
        TotalSessions = COALESCE(@TotalSessions, TotalSessions),
        ValidityDays = COALESCE(@ValidityDays, ValidityDays),
        ImageUrl = COALESCE(@ImageUrl, ImageUrl),
        IsHot = COALESCE(@IsHot, IsHot),
        Status = COALESCE(@Status, Status),
        UpdatedAt = GETDATE()
      WHERE PackageId = @PackageId
    `);

  return getById(id);
}

async function remove(id) {
  const pool = await connectDB();

  await pool.request().input("PackageId", sql.Int, id).query(`
      UPDATE Packages
      SET Status = 'INACTIVE', UpdatedAt = GETDATE()
      WHERE PackageId = @PackageId
    `);

  return {
    PackageId: Number(id),
    Status: "INACTIVE",
  };
}

/* ===========================================================
   ENTERPRISE PACKAGE MANAGEMENT FUNCTIONS
   =========================================================== */

/**
 * Yêu cầu gia hạn liệu trình
 */
async function requestExtension(userId, customerPackageId, days, reason) {
  throw new Error("Tính năng gia hạn liệu trình đã bị bãi bỏ");

  days = Number(days);
  if (!days || days <= 0 || days > 365) {
    throw new Error("Số ngày gia hạn phải từ 1 đến 365");
  }

  // Kiểm tra gói thuộc về khách hàng và đang ACTIVE/FROZEN
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT cp.CustomerPackageId, cp.Status, cp.EndDate
      FROM CustomerPackages cp
      WHERE cp.CustomerPackageId = @CustomerPackageId
        AND cp.CustomerId = @CustomerId
    `);

  const pkg = pkgResult.recordset[0];
  if (!pkg) throw new Error("Không tìm thấy liệu trình này");
  if (!["ACTIVE", "FROZEN"].includes(pkg.Status)) {
    throw new Error("Liệu trình phải ở trạng thái ACTIVE hoặc FROZEN để gia hạn");
  }

  // Kiểm tra số lần đã gia hạn thành công (tối đa 2 lần)
  const approvedCheck = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT COUNT(*) AS ApprovedCount
      FROM PackageExtensions
      WHERE CustomerPackageId = @CustomerPackageId AND Status = 'APPROVED'
    `);

  if (approvedCheck.recordset[0].ApprovedCount >= 2) {
    throw new Error("Liệu trình này đã đạt giới hạn tối đa 2 lần gia hạn thành công");
  }

  // Kiểm tra không có yêu cầu gia hạn PENDING nào
  const pendingCheck = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT COUNT(*) AS PendingCount
      FROM PackageExtensions
      WHERE CustomerPackageId = @CustomerPackageId AND Status = 'PENDING'
    `);

  if (pendingCheck.recordset[0].PendingCount > 0) {
    throw new Error("Bạn đã có yêu cầu gia hạn đang chờ duyệt cho liệu trình này");
  }

  const result = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("DaysToExtend", sql.Int, days)
    .input("Reason", sql.NVarChar, reason || null).query(`
      INSERT INTO PackageExtensions
      (CustomerPackageId, DaysToExtend, Reason)
      OUTPUT INSERTED.*
      VALUES (@CustomerPackageId, @DaysToExtend, @Reason)
    `);

  return result.recordset[0];
}

/**
 * Yêu cầu đóng băng liệu trình
 */
async function requestFreeze(userId, customerPackageId, startDate, reason) {
  throw new Error("Tính năng đóng băng liệu trình đã bị bãi bỏ");
}

/**
 * Hủy đóng băng (Customer hoặc Staff)
 * - Cộng thêm số ngày đã đóng băng vào EndDate
 * - Chuyển trạng thái gói về ACTIVE
 */
async function unfreezePackage(userId, customerPackageId) {
  throw new Error("Tính năng đóng băng liệu trình đã bị bãi bỏ");
}

/**
 * Thêm thành viên gia đình sử dụng chung liệu trình
 */
async function addFamilyMember(userId, customerPackageId, phoneOrEmail, relationship) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  if (!phoneOrEmail || !relationship) {
    throw new Error("Vui lòng cung cấp số điện thoại/email và mối quan hệ");
  }

  // Kiểm tra gói thuộc về khách hàng
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT cp.CustomerPackageId, cp.Status
      FROM CustomerPackages cp
      WHERE cp.CustomerPackageId = @CustomerPackageId
        AND cp.CustomerId = @CustomerId
    `);

  const pkg = pkgResult.recordset[0];
  if (!pkg) throw new Error("Không tìm thấy liệu trình này");
  if (!["ACTIVE", "FROZEN"].includes(pkg.Status)) {
    throw new Error("Liệu trình phải ở trạng thái ACTIVE hoặc FROZEN");
  }

  // Kiểm tra số lượng thành viên gia đình (tối đa 2 người)
  const countResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT COUNT(*) AS TotalCount FROM PackageMembers
      WHERE CustomerPackageId = @CustomerPackageId
    `);
  if (countResult.recordset[0].TotalCount >= 2) {
    throw new Error("Liệu trình này chỉ được chia sẻ tối đa cho 2 thành viên gia đình");
  }

  // Tìm Customer theo phone hoặc email
  const familyResult = await pool
    .request()
    .input("PhoneOrEmail", sql.NVarChar, phoneOrEmail).query(`
      SELECT c.CustomerId
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE u.Phone = @PhoneOrEmail OR u.Email = @PhoneOrEmail
    `);

  const familyCustomer = familyResult.recordset[0];
  if (!familyCustomer) {
    throw new Error("Không tìm thấy khách hàng với thông tin đã cung cấp");
  }

  if (familyCustomer.CustomerId === customer.CustomerId) {
    throw new Error("Không thể thêm chính mình làm thành viên gia đình");
  }

  // Kiểm tra đã thêm chưa
  const existCheck = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("FamilyCustomerId", sql.Int, familyCustomer.CustomerId).query(`
      SELECT PackageMemberId FROM PackageMembers
      WHERE CustomerPackageId = @CustomerPackageId AND FamilyCustomerId = @FamilyCustomerId
    `);

  if (existCheck.recordset.length > 0) {
    throw new Error("Thành viên này đã được thêm vào liệu trình");
  }

  const result = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("FamilyCustomerId", sql.Int, familyCustomer.CustomerId)
    .input("Relationship", sql.NVarChar, relationship).query(`
      INSERT INTO PackageMembers
      (CustomerPackageId, FamilyCustomerId, Relationship, AddedAt)
      OUTPUT INSERTED.*
      VALUES (@CustomerPackageId, @FamilyCustomerId, @Relationship, GETDATE())
    `);

  return result.recordset[0];
}

/**
 * Xóa thành viên gia đình khỏi liệu trình
 */
async function removeFamilyMember(userId, customerPackageId, memberId) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  // Kiểm tra gói thuộc về khách hàng
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT cp.CustomerPackageId
      FROM CustomerPackages cp
      WHERE cp.CustomerPackageId = @CustomerPackageId
        AND cp.CustomerId = @CustomerId
    `);

  if (!pkgResult.recordset[0]) throw new Error("Không tìm thấy liệu trình này");

  await pool
    .request()
    .input("PackageMemberId", sql.Int, memberId)
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      DELETE FROM PackageMembers
      WHERE PackageMemberId = @PackageMemberId
        AND CustomerPackageId = @CustomerPackageId
    `);

  return { success: true };
}

/**
 * Lấy lịch sử sử dụng có phân trang
 */
async function getUsageHistoryPaginated(userId, customerPackageId, page = 1, limit = 10) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  page = Math.max(1, Number(page) || 1);
  limit = Math.min(50, Math.max(1, Number(limit) || 10));
  const offset = (page - 1) * limit;

  // Kiểm tra quyền: chủ sở hữu hoặc thành viên gia đình
  const accessCheck = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT 1 FROM CustomerPackages
      WHERE CustomerPackageId = @CustomerPackageId AND CustomerId = @CustomerId
      UNION
      SELECT 1 FROM PackageMembers
      WHERE CustomerPackageId = @CustomerPackageId AND FamilyCustomerId = @CustomerId
    `);

  if (accessCheck.recordset.length === 0) {
    throw new Error("Bạn không có quyền xem lịch sử liệu trình này");
  }

  const countResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT COUNT(*) AS TotalCount
      FROM CustomerPackageUsages
      WHERE CustomerPackageId = @CustomerPackageId
    `);

  const total = countResult.recordset[0].TotalCount;

  const result = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("Offset", sql.Int, offset)
    .input("Limit", sql.Int, limit).query(`
      SELECT
        u.UsageId,
        u.CustomerPackageId,
        u.AppointmentId,
        u.ServiceId,
        s.ServiceName,
        u.SessionsUsed,
        u.Status,
        u.UsedAt,
        a.AppointmentDate,
        a.StartTime,
        a.EndTime,
        a.Status AS AppointmentStatus,
        eu.FullName AS TechnicianName,
        uu.FullName AS UsedByName
      FROM CustomerPackageUsages u
      JOIN Services s ON u.ServiceId = s.ServiceId
      LEFT JOIN Appointments a ON u.AppointmentId = a.AppointmentId
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users eu ON e.UserId = eu.UserId
      LEFT JOIN Users uu ON u.UsedBy = uu.UserId
      WHERE u.CustomerPackageId = @CustomerPackageId
      ORDER BY u.UsedAt DESC, u.UsageId DESC
      OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY
    `);

  return {
    data: result.recordset,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Lấy chi tiết liệu trình enterprise (bao gồm members, freeze history, extension history)
 */
async function getMyPackageDetail(userId, customerPackageId, customerId = null) {
  const pool = await connectDB();
  let customer;
  if (customerId) {
    customer = { CustomerId: customerId };
  } else {
    customer = await getCustomerByUserId(pool, userId);
  }
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  // Lấy thông tin gói
  const pkgResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("CustomerId", sql.Int, customer.CustomerId).query(`
      SELECT
        cp.*,
        CAST(CASE WHEN cp.CustomerId = @CustomerId THEN 1 ELSE 0 END AS BIT) AS IsOwner,
        p.PackageName,
        p.Description,
        p.OriginalPrice,
        p.SalePrice,
        p.ImageUrl,
        p.ValidityDays,
        ISNULL(pc.CategoryName, N'Liệu trình') AS CategoryName,
        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      LEFT JOIN PackageCategories pc ON p.PackageCategoryId = pc.PackageCategoryId
      LEFT JOIN PackageServices ps ON p.PackageId = ps.PackageId
      LEFT JOIN Services s ON ps.ServiceId = s.ServiceId
      WHERE cp.CustomerPackageId = @CustomerPackageId
        AND (cp.CustomerId = @CustomerId
          OR EXISTS (SELECT 1 FROM PackageMembers pm WHERE pm.CustomerPackageId = @CustomerPackageId AND pm.FamilyCustomerId = @CustomerId))
      GROUP BY
        cp.CustomerPackageId, cp.CustomerId, cp.PackageId, cp.StartDate, cp.EndDate,
        cp.TotalSessions, cp.UsedSessions, cp.RemainingSessions, cp.Status,
        cp.FreezeDays, cp.ExtensionDays, cp.MembershipLevelAtPurchase, cp.PurchasePrice,
        cp.CreatedAt, cp.UpdatedAt,
        p.PackageName, p.Description, p.OriginalPrice, p.SalePrice, p.ImageUrl, p.ValidityDays,
        pc.CategoryName
    `);

  const pkg = pkgResult.recordset[0];
  if (!pkg) throw new Error("Không tìm thấy liệu trình này");

  // Lấy danh sách thành viên gia đình
  const membersResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT pm.PackageMemberId, pm.FamilyCustomerId, pm.Relationship, pm.AddedAt,
        u.FullName, u.Email, u.Phone, u.AvatarUrl
      FROM PackageMembers pm
      JOIN Customers c ON pm.FamilyCustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE pm.CustomerPackageId = @CustomerPackageId
    `);

  // Lấy lịch sử đóng băng
  const freezeResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT * FROM PackageFreezeRequests
      WHERE CustomerPackageId = @CustomerPackageId
      ORDER BY RequestedAt DESC
    `);

  // Lấy lịch sử gia hạn
  const extensionResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT * FROM PackageExtensions
      WHERE CustomerPackageId = @CustomerPackageId
      ORDER BY RequestedAt DESC
    `);

  // Lấy benefits
  const benefitsResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT b.*, v.Code AS VoucherCode, v.DiscountType, v.DiscountValue
      FROM PackageBenefits b
      LEFT JOIN Vouchers v ON b.VoucherId = v.VoucherId
      WHERE b.CustomerPackageId = @CustomerPackageId
    `);

  // Payment info
  const paymentResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT * FROM PackagePayments
      WHERE CustomerPackageId = @CustomerPackageId
      ORDER BY CreatedAt DESC
    `);

  // Lấy chi tiết dịch vụ và hạn mức sử dụng trong gói
  const servicesResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId)
    .input("PackageId", sql.Int, pkg.PackageId).query(`
      SELECT 
        ps.ServiceId,
        s.ServiceName,
        s.DurationMinutes,
        s.ImageUrl,
        s.Description,
        s.Price,
        ps.SessionCount AS MaxSessions,
        (
          SELECT ISNULL(SUM(u.SessionsUsed), 0)
          FROM CustomerPackageUsages u
          WHERE u.CustomerPackageId = @CustomerPackageId
            AND u.ServiceId = ps.ServiceId
            AND u.Status <> 'CANCELLED'
        ) AS UsedSessions,
        (
          SELECT COUNT(*)
          FROM Appointments a
          JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
          WHERE a.CustomerPackageId = @CustomerPackageId
            AND aps.ServiceId = ps.ServiceId
            AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        ) AS ActiveBookings,
        (
          SELECT TOP 1 u.FullName
          FROM Appointments a
          JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
          JOIN Customers c ON a.CustomerId = c.CustomerId
          JOIN Users u ON c.UserId = u.UserId
          WHERE a.CustomerPackageId = @CustomerPackageId
            AND aps.ServiceId = ps.ServiceId
            AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
        ) AS ActiveBookingName,
        (
          SELECT STRING_AGG(CONCAT(activeGroup.FullName, N' đặt ', activeGroup.ActiveCount, N' buổi'), N', ')
          FROM (
            SELECT u.FullName, COUNT(*) AS ActiveCount
            FROM Appointments a
            JOIN AppointmentServices aps ON a.AppointmentId = aps.AppointmentId
            JOIN Customers c ON a.CustomerId = c.CustomerId
            JOIN Users u ON c.UserId = u.UserId
            WHERE a.CustomerPackageId = @CustomerPackageId
              AND aps.ServiceId = ps.ServiceId
              AND a.Status IN ('PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
            GROUP BY u.FullName
          ) activeGroup
        ) AS ActiveBookingDetails
      FROM PackageServices ps
      JOIN Services s ON ps.ServiceId = s.ServiceId
      WHERE ps.PackageId = @PackageId
    `);

  const activeApptResult = await pool
    .request()
    .input("CustomerPackageId", sql.Int, customerPackageId).query(`
      SELECT TOP 1
        a.AppointmentId,
        CONVERT(VARCHAR(10), a.AppointmentDate, 120) AS AppointmentDate,
        CAST(a.StartTime AS VARCHAR(8)) AS StartTime,
        CAST(a.EndTime AS VARCHAR(8)) AS EndTime,
        a.Status,
        a.Notes,
        u.FullName AS PrimaryTechName,
        u.AvatarUrl AS PrimaryTechAvatar
      FROM Appointments a
      LEFT JOIN Employees e ON a.EmployeeId = e.EmployeeId
      LEFT JOIN Users u ON e.UserId = u.UserId
      WHERE a.CustomerPackageId = @CustomerPackageId
        AND a.Status IN ('CONFIRMED', 'PENDING', 'CHECKED_IN')
      ORDER BY a.CreatedAt DESC
    `);


  let activeAppointment = activeApptResult.recordset[0] || null;
  if (activeAppointment) {
    const apptServicesRes = await pool
      .request()
      .input("AppointmentId", sql.Int, activeAppointment.AppointmentId)
      .query(`
        SELECT 
          aps.AppointmentServiceId,
          aps.ServiceId,
          s.ServiceName,
          s.DurationMinutes,
          s.ImageUrl,
          aps.EmployeeId,
          u.FullName AS TechnicianName,
          u.Phone AS TechnicianPhone,
          ISNULL(u.AvatarUrl, e.ImageUrl) AS TechnicianAvatar
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        LEFT JOIN Employees e ON aps.EmployeeId = e.EmployeeId
        LEFT JOIN Users u ON e.UserId = u.UserId
        WHERE aps.AppointmentId = @AppointmentId
        ORDER BY aps.AppointmentServiceId ASC
      `);
    activeAppointment.Services = apptServicesRes.recordset || [];
  }

  return {
    ...pkg,
    ActiveAppointment: activeAppointment,
    Members: membersResult.recordset,

    FreezeHistory: freezeResult.recordset,
    ExtensionHistory: extensionResult.recordset,
    Benefits: benefitsResult.recordset,
    Payments: paymentResult.recordset,
    Services: servicesResult.recordset,
  };
}


/**
 * [Staff] Lấy danh sách yêu cầu chờ duyệt (gia hạn + đóng băng)
 */
async function getApprovals(filters = {}) {
  const pool = await connectDB();
  const statusFilter = filters.status || "PENDING";

  const result = await pool
    .request()
    .input("Status", sql.NVarChar, statusFilter).query(`
      SELECT
        'EXTENSION' AS RequestType,
        e.ExtensionId AS RequestId,
        e.CustomerPackageId,
        e.DaysToExtend,
        NULL AS FreezeStartDate,
        e.Reason,
        e.Status,
        e.RequestedAt,
        e.ApprovedBy,
        e.ApprovedAt,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.EndDate,
        cp.Status AS PackageStatus,
        p.PackageName,
        u.FullName AS CustomerName,
        u.Email AS CustomerEmail,
        u.Phone AS CustomerPhone
      FROM PackageExtensions e
      JOIN CustomerPackages cp ON e.CustomerPackageId = cp.CustomerPackageId
      JOIN Packages p ON cp.PackageId = p.PackageId
      JOIN Customers c ON cp.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE e.Status = @Status

      UNION ALL

      SELECT
        'FREEZE' AS RequestType,
        f.FreezeRequestId AS RequestId,
        f.CustomerPackageId,
        NULL AS DaysToExtend,
        f.FreezeStartDate,
        f.Reason,
        f.Status,
        f.RequestedAt,
        f.ApprovedBy,
        f.ApprovedAt,
        cp.TotalSessions,
        cp.UsedSessions,
        cp.RemainingSessions,
        cp.EndDate,
        cp.Status AS PackageStatus,
        p.PackageName,
        u.FullName AS CustomerName,
        u.Email AS CustomerEmail,
        u.Phone AS CustomerPhone
      FROM PackageFreezeRequests f
      JOIN CustomerPackages cp ON f.CustomerPackageId = cp.CustomerPackageId
      JOIN Packages p ON cp.PackageId = p.PackageId
      JOIN Customers c ON cp.CustomerId = c.CustomerId
      JOIN Users u ON c.UserId = u.UserId
      WHERE f.Status = @Status

      ORDER BY RequestedAt DESC
    `);

  return result.recordset;
}

/**
 * [Staff] Duyệt hoặc từ chối yêu cầu gia hạn/đóng băng
 */
async function approveRequest(staffUserId, requestType, requestId, action) {
  const pool = await connectDB();

  if (!["APPROVED", "REJECTED"].includes(action)) {
    throw new Error("Hành động không hợp lệ. Chọn APPROVED hoặc REJECTED");
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    if (requestType === "EXTENSION") {
      throw new Error("Tính năng gia hạn liệu trình đã bị bãi bỏ");
    } else if (requestType === "FREEZE") {
      throw new Error("Tính năng đóng băng liệu trình đã bị bãi bỏ");
    } else {
      throw new Error("Loại yêu cầu không hợp lệ. Chọn EXTENSION hoặc FREEZE");
    }

    await transaction.commit();
  } catch (err) {
    try { await transaction.rollback(); } catch (_) {}
    throw err;
  }

  return { success: true, action, requestType, requestId };
}

/**
 * [Admin] Lấy báo cáo thống kê combo/liệu trình
 */
async function getPackageReport(filters = {}) {
  const pool = await connectDB();

  const startDate = filters.startDate && filters.startDate !== "" ? filters.startDate : null;
  const endDate = filters.endDate && filters.endDate !== "" ? filters.endDate : null;

  const result = await pool
    .request()
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
      -- Tổng quan
      SELECT
        COUNT(*) AS TotalPackagesSold,
        SUM(CASE WHEN cp.Status = 'ACTIVE' THEN 1 ELSE 0 END) AS ActivePackages,
        SUM(CASE WHEN cp.Status = 'FROZEN' THEN 1 ELSE 0 END) AS FrozenPackages,
        SUM(CASE WHEN cp.Status = 'USED_UP' OR cp.Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedPackages,
        SUM(CASE WHEN cp.Status = 'EXPIRED' THEN 1 ELSE 0 END) AS ExpiredPackages,
        SUM(CASE WHEN cp.Status = 'CANCELLED' THEN 1 ELSE 0 END) AS CancelledPackages,
        SUM(CASE WHEN cp.EndDate >= CAST(GETDATE() AS DATE) 
                  AND cp.EndDate <= DATEADD(day, 7, CAST(GETDATE() AS DATE))
                  AND cp.Status = 'ACTIVE' THEN 1 ELSE 0 END) AS ExpiringSoonPackages,
        ISNULL(SUM(pp.Amount), 0) AS TotalRevenue,
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cp.Status IN ('USED_UP','COMPLETED') THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2))
          ELSE 0
        END AS CompletionRate,
        CASE WHEN SUM(cp.TotalSessions) > 0
          THEN CAST(SUM(cp.UsedSessions) * 100.0 / SUM(cp.TotalSessions) AS DECIMAL(5,2))
          ELSE 0
        END AS UsageRate
      FROM CustomerPackages cp
      LEFT JOIN PackagePayments pp ON cp.CustomerPackageId = pp.CustomerPackageId AND pp.Status = 'PAID'
      WHERE (@StartDate IS NULL OR cp.CreatedAt >= @StartDate)
        AND (@EndDate IS NULL OR cp.CreatedAt < DATEADD(day, 1, @EndDate))
    `);

  // Top packages by revenue
  const topPackages = await pool
    .request()
    .input("StartDate", sql.Date, startDate)
    .input("EndDate", sql.Date, endDate).query(`
      SELECT TOP 10
        p.PackageId,
        p.PackageName,
        COUNT(cp.CustomerPackageId) AS SoldCount,
        ISNULL(SUM(pp.Amount), 0) AS Revenue,
        SUM(cp.UsedSessions) AS TotalUsedSessions,
        SUM(cp.TotalSessions) AS TotalSessionsSold
      FROM Packages p
      LEFT JOIN CustomerPackages cp ON p.PackageId = cp.PackageId
      LEFT JOIN PackagePayments pp ON cp.CustomerPackageId = pp.CustomerPackageId AND pp.Status = 'PAID'
      WHERE (@StartDate IS NULL OR cp.CreatedAt >= @StartDate)
        AND (@EndDate IS NULL OR cp.CreatedAt < DATEADD(day, 1, @EndDate))
      GROUP BY p.PackageId, p.PackageName
      ORDER BY Revenue DESC
    `);

  // Monthly revenue trend (last 12 months)
  const monthlyTrend = await pool.request().query(`
    SELECT
      FORMAT(pp.PaidAt, 'yyyy-MM') AS Month,
      COUNT(DISTINCT cp.CustomerPackageId) AS PackagesSold,
      SUM(pp.Amount) AS Revenue
    FROM PackagePayments pp
    JOIN CustomerPackages cp ON pp.CustomerPackageId = cp.CustomerPackageId
    WHERE pp.Status = 'PAID'
      AND pp.PaidAt >= DATEADD(MONTH, -12, GETDATE())
    GROUP BY FORMAT(pp.PaidAt, 'yyyy-MM')
    ORDER BY Month DESC
  `);

  return {
    summary: result.recordset[0],
    topPackages: topPackages.recordset,
    monthlyTrend: monthlyTrend.recordset,
  };
}

async function createPayosPackageUrl(userId, packageId, payload = {}) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const pkg = await getActivePackage(pool, packageId);
  if (!pkg)
    throw new Error("Combo / liệu trình không tồn tại hoặc đã ngừng bán");

  await checkPendingPackage(pool, customer.CustomerId, packageId);

  const prices = calcDiscount(pkg.OriginalPrice, pkg.SalePrice);

  // orderCode must be a unique positive integer
  const orderCode = Number(`${packageId}${Date.now() % 1000000}`);

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    await createCustomerPackageTransaction(
      transaction,
      customer.CustomerId,
      pkg,
      "PAYOS",
      "PENDING",
      String(orderCode),
    );

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }

  const payos = getPayOS();

  const returnUrl =
    process.env.PAYOS_PACKAGE_RETURN_URL ||
    `${process.env.BACKEND_URL || "http://localhost:5000"}/api/packages/payos-return`;

  const cancelUrl =
    `${process.env.FRONTEND_URL || "http://localhost:5173"}/packages/${packageId}?cancel=1`;

  const paymentData = {
    orderCode: orderCode,
    amount: Math.round(Number(prices.finalPrice || 0)),
    description: `Mua combo #${packageId}`.slice(0, 25),
    returnUrl: returnUrl,
    cancelUrl: cancelUrl,
    items: [
      {
        name: pkg.PackageName.slice(0, 50),
        quantity: 1,
        price: Math.round(Number(prices.finalPrice || 0)),
      },
    ],
  };

  const paymentLink = await payos.paymentRequests.create(paymentData);

  return {
    paymentUrl: paymentLink.checkoutUrl,
    amount: prices.finalPrice,
    transactionCode: String(orderCode),
  };
}

async function handlePayosReturn(query = {}) {
  const orderCode = query.orderCode || query.code;
  const status = query.status; // PAID, CANCELLED
  const cancel = query.cancel === "true" || status === "CANCELLED";
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  if (!orderCode) {
    return `${frontendUrl}/customer/packages?error=missing_order_code`;
  }

  const pool = await connectDB();

  // Search package payment by orderCode
  const found = await pool
    .request()
    .input("TransactionCode", sql.NVarChar, String(orderCode)).query(`
      SELECT TOP 1
        pp.PackagePaymentId,
        pp.Amount,
        pp.Status,
        cp.CustomerPackageId,
        cp.CustomerId,
        cp.PackageId,
        p.ValidityDays,
        p.TotalSessions
      FROM PackagePayments pp
      JOIN CustomerPackages cp
        ON pp.CustomerPackageId = cp.CustomerPackageId
      JOIN Packages p
        ON cp.PackageId = p.PackageId
      WHERE pp.TransactionCode = @TransactionCode
        AND pp.PaymentMethod = 'PAYOS'
    `);

  const payment = found.recordset[0];

  if (!payment) {
    return `${frontendUrl}/customer/packages?error=payment_not_found`;
  }

  const failUrl = `${frontendUrl}/customer/packages?error=payos_failed`;

  if (cancel) {
    await pool
      .request()
      .input("PackagePaymentId", sql.Int, payment.PackagePaymentId).query(`
        UPDATE PackagePayments
        SET Status = 'FAILED'
        WHERE PackagePaymentId = @PackagePaymentId
          AND Status = 'PENDING';

        UPDATE CustomerPackages
        SET Status = 'CANCELLED'
        WHERE CustomerPackageId = (
          SELECT CustomerPackageId
          FROM PackagePayments
          WHERE PackagePaymentId = @PackagePaymentId
        )
        AND Status = 'PENDING_PAYMENT';
      `);

    return failUrl;
  }

  // Verify actual status from PayOS
  try {
    const payos = getPayOS();
    const info = await payos.paymentRequests.get(String(orderCode));

    if (info && info.status === "PAID") {
      if (String(payment.Status).toUpperCase() !== "PAID") {
        const transaction = new sql.Transaction(pool);

        try {
          await transaction.begin();

          await new sql.Request(transaction)
            .input("PackagePaymentId", sql.Int, payment.PackagePaymentId)
            .input("VnpTransactionNo", sql.NVarChar, String(info.id || info.paymentLinkId || "")).query(`
              UPDATE PackagePayments
              SET
                Status = 'PAID',
                PaidAt = GETDATE(),
                VnpTransactionNo = @VnpTransactionNo
              WHERE PackagePaymentId = @PackagePaymentId
            `);

          await new sql.Request(transaction)
            .input("CustomerPackageId", sql.Int, payment.CustomerPackageId)
            .input("ValidityDays", sql.Int, payment.ValidityDays || 30)
            .input(
              "TotalSessions",
              sql.Int,
              Math.max(Number(payment.TotalSessions || 1), 1),
            ).query(`
              UPDATE CustomerPackages
              SET
                Status = 'ACTIVE',
                StartDate = CAST(GETDATE() AS DATE),
                EndDate = CAST(GETDATE() AS DATE) + CAST(@ValidityDays AS INT),
                TotalSessions = @TotalSessions,
                RemainingSessions = @TotalSessions,
                UpdatedAt = GETDATE()
              WHERE CustomerPackageId = @CustomerPackageId
            `);

          await new sql.Request(transaction)
            .input("CustomerId", sql.Int, payment.CustomerId)
            .input(
              "Points",
              sql.Int,
              Math.floor(Number(payment.Amount || 0) / 10000),
            ).query(`
              UPDATE Customers
              SET LoyaltyPoints = LoyaltyPoints + @Points
              WHERE CustomerId = @CustomerId
            `);

          await transaction.commit();
        } catch (err) {
          try {
            await transaction.rollback();
          } catch (_) {}
          throw err;
        }
      }
      return `${frontendUrl}/customer/packages?paid=1`;
    }
  } catch (err) {
    console.error("PayOS package verify error:", err.message);
  }

  return failUrl;
}

module.exports = {
  getAll,
  getCategories,
  getById,
  getMine,
  getUsageHistory,
  buyPackage,
  createVnpayPackageUrl,
  createVnpayRepayUrl,
  handleVnpayReturn,
  createPayosPackageUrl,
  createPayosRepayUrl,
  handlePayosReturn,
  create,
  update,
  remove,
  // Enterprise functions
  requestExtension,
  requestFreeze,
  unfreezePackage,
  addFamilyMember,
  removeFamilyMember,
  getUsageHistoryPaginated,
  getMyPackageDetail,
  getApprovals,
  approveRequest,
  getPackageReport,
  findMember,
  bookCustomerPackage,
};

async function findMember(keyword, currentUserId) {
  if (!keyword) throw new Error("Vui lòng cung cấp thông tin tìm kiếm");
  
  const pool = await connectDB();
  const currentCustomer = await getCustomerByUserId(pool, currentUserId);
  if (!currentCustomer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const result = await pool
    .request()
    .input("Keyword", sql.NVarChar, keyword.trim())
    .input("CurrentCustomerId", sql.Int, currentCustomer.CustomerId)
    .query(`
      SELECT TOP 10 c.CustomerId, u.FullName, u.Email, u.Phone, u.AvatarUrl
      FROM Customers c
      JOIN Users u ON c.UserId = u.UserId
      WHERE (
          u.FullName LIKE '%' + @Keyword + '%'
          OR u.Phone LIKE '%' + @Keyword + '%'
          OR u.Email LIKE '%' + @Keyword + '%'
        )
        AND u.Status = 'ACTIVE'
        AND c.CustomerId <> @CurrentCustomerId
    `);

  return result.recordset || [];
}

async function bookCustomerPackage(userId, customerPackageId, bookingData = {}) {
  const pool = await connectDB();
  const { appointmentDate, startTime, notes } = bookingData;

  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn");
  if (!startTime) throw new Error("Vui lòng chọn giờ bắt đầu");

  // 1. Get Customer profile
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy thông tin hồ sơ khách hàng");

  // 2. Fetch CustomerPackage details
  const pkgRes = await pool
    .request()
    .input("CustomerPackageId", sql.Int, Number(customerPackageId))
    .input("CustomerId", sql.Int, customer.CustomerId)
    .query(`
      SELECT cp.*, p.PackageName, p.Description
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerPackageId = @CustomerPackageId
        AND (
          cp.CustomerId = @CustomerId
          OR EXISTS (
            SELECT 1 FROM PackageMembers pm
            WHERE pm.CustomerPackageId = cp.CustomerPackageId
              AND pm.FamilyCustomerId = @CustomerId
          )
        )
    `);

  const cp = pkgRes.recordset[0];
  if (!cp) throw new Error("Gói Combo không tồn tại hoặc bạn không có quyền dùng gói này");

  if (cp.Status === "CANCELLED" || cp.Status === "EXPIRED") {
    throw new Error(`Gói Combo '${cp.PackageName}' của bạn đã hết hạn hoặc đã bị hủy. Không thể đăng ký đặt lịch mới!`);
  }
  if (cp.RemainingSessions <= 0 && cp.TotalSessions > 0) {
    throw new Error("Gói Combo này đã được sử dụng hết số lượt");
  }

  // Check end date expiry
  if (cp.EndDate) {
    const today = new Date().toISOString().slice(0, 10);
    const endDateStr = new Date(cp.EndDate).toISOString().slice(0, 10);
    if (today > endDateStr) {
      await pool.request()
        .input("CustomerPackageId", sql.Int, cp.CustomerPackageId)
        .query(`UPDATE CustomerPackages SET Status = 'EXPIRED', UpdatedAt = GETDATE() WHERE CustomerPackageId = @CustomerPackageId`);
      throw new Error(`Gói Combo '${cp.PackageName}' của bạn đã hết thời hạn sử dụng (Hạn cuối: ${new Date(cp.EndDate).toLocaleDateString("vi-VN")}). Gói Combo đã tự động thanh lý và không thể đặt lịch mới!`);
    }
  }

  // 3. Lifetime Single-Use Limit Check (1 time total per purchased combo package)
  const lifetimeCheck = await pool
    .request()
    .input("CustomerPackageId", sql.Int, Number(customerPackageId))
    .query(`
      SELECT COUNT(*) AS BookedCount
      FROM Appointments
      WHERE CustomerPackageId = @CustomerPackageId
        AND Status NOT IN ('CANCELLED', 'NO_SHOW', 'REFUNDED')
    `);

  if (lifetimeCheck.recordset[0]?.BookedCount >= 1) {
    throw new Error("Gói Combo này chỉ được áp dụng 1 lần duy nhất trong suốt thời hạn sử dụng. Bạn đã có lịch hẹn hoặc đã sử dụng gói Combo này!");
  }

  // 4. Fetch Services in Combo & Calculate total duration
  const svcsRes = await pool
    .request()
    .input("PackageId", sql.Int, cp.PackageId)
    .query(`
      SELECT s.ServiceId, s.ServiceName, s.DurationMinutes, s.Price
      FROM PackageServices ps
      JOIN Services s ON ps.ServiceId = s.ServiceId
      WHERE ps.PackageId = @PackageId
    `);

  const services = svcsRes.recordset || [];
  if (services.length === 0) throw new Error("Không có dịch vụ nào trong gói Combo này");

  const totalDurationMinutes = services.reduce((acc, s) => acc + (Number(s.DurationMinutes) || 30), 0);

  // Calculate endTime
  const pad = (n) => String(n).padStart(2, "0");
  const [h, m] = startTime.split(":").map(Number);
  const startD = new Date();
  startD.setHours(h, m, 0, 0);
  const endD = new Date(startD.getTime() + totalDurationMinutes * 60 * 1000);
  const endTime = `${pad(endD.getHours())}:${pad(endD.getMinutes())}:00`;

  // 5. Calculate step-by-step times and auto-assign dedicated technician for EACH service step in combo
  let currentStepStart = startD;
  const serviceAssignments = [];

  for (const svc of services) {
    const durMins = Number(svc.DurationMinutes) || 30;
    const stepEnd = new Date(currentStepStart.getTime() + durMins * 60 * 1000);

    const stepStartStr = `${pad(currentStepStart.getHours())}:${pad(currentStepStart.getMinutes())}:00`;
    const stepEndStr = `${pad(stepEnd.getHours())}:${pad(stepEnd.getMinutes())}:00`;

    // Bắt buộc tìm KTV có chuyên môn đúng với dịch vụ này và đang rảnh trong khung giờ đó
    let stepTech;
    try {
      stepTech = await findAvailableTechnician(appointmentDate, stepStartStr, stepEndStr, svc.ServiceId);
    } catch (err) {
      // Không fallback sang KTV không có chuyên môn — thông báo lỗi rõ ràng
      throw new Error(
        `Không tìm được kỹ thuật viên phù hợp cho dịch vụ "${svc.ServiceName}" trong khung giờ ${stepStartStr} - ${stepEndStr}. ` +
        `Vui lòng chọn khung giờ khác hoặc thử lại vào ngày khác.`
      );
    }

    serviceAssignments.push({
      serviceId: svc.ServiceId,
      serviceName: svc.ServiceName,
      durationMinutes: durMins,
      startTime: stepStartStr,
      endTime: stepEndStr,
      technician: stepTech
    });

    currentStepStart = stepEnd;
  }

  const primaryTechnician = serviceAssignments[0]?.technician || await findAvailableTechnician(appointmentDate, startTime, endTime);

  // 6. DB Transaction for appointment creation & package usage update
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // Insert Appointment
    const apptReq = new sql.Request(transaction);
    apptReq.input("CustomerId", sql.Int, customer.CustomerId);
    apptReq.input("EmployeeId", sql.Int, primaryTechnician.EmployeeId);
    apptReq.input("AppointmentDate", sql.Date, appointmentDate);
    apptReq.input("StartTime", sql.VarChar, startTime.length === 5 ? startTime + ":00" : startTime);
    apptReq.input("EndTime", sql.VarChar, endTime);
    apptReq.input("Status", sql.NVarChar, "CONFIRMED");
    apptReq.input("Notes", sql.NVarChar, notes ? `[Gói Combo: ${cp.PackageName}] ${notes}` : `[Gói Combo: ${cp.PackageName}]`);
    apptReq.input("CustomerPackageId", sql.Int, cp.CustomerPackageId);

    const apptResult = await apptReq.query(`
      INSERT INTO Appointments (
        CustomerId, EmployeeId, AppointmentDate, StartTime, EndTime,
        Status, Notes, CustomerPackageId, CreatedAt
      )
      OUTPUT INSERTED.AppointmentId
      VALUES (
        @CustomerId, @EmployeeId, @AppointmentDate, @StartTime, @EndTime,
        @Status, @Notes, @CustomerPackageId, GETDATE()
      )
    `);

    const appointmentId = apptResult.recordset[0].AppointmentId;

    // Insert AppointmentServices with dedicated EmployeeId + StartTime + EndTime for each service step
    for (const step of serviceAssignments) {
      const svcReq = new sql.Request(transaction);
      svcReq.input("AppointmentId", sql.Int, appointmentId);
      svcReq.input("ServiceId", sql.Int, step.serviceId);
      svcReq.input("Price", sql.Decimal(18, 2), 0);
      svcReq.input("EmployeeId", sql.Int, step.technician.EmployeeId);
      svcReq.input("StartTime", sql.VarChar, step.startTime);
      svcReq.input("EndTime", sql.VarChar, step.endTime);
      await svcReq.query(`
        INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price, EmployeeId, Status, StartTime, EndTime)
        VALUES (@AppointmentId, @ServiceId, @Price, @EmployeeId, 'PENDING', @StartTime, @EndTime)
      `);
    }

    await transaction.commit();

    return {
      appointmentId,
      packageName: cp.PackageName,
      appointmentDate,
      startTime,
      endTime,
      totalDurationMinutes,
      technician: {
        employeeId: primaryTechnician.EmployeeId,
        fullName: primaryTechnician.FullName,
        phone: primaryTechnician.Phone,
        avatarUrl: primaryTechnician.AvatarUrl
      },
      serviceAssignments: serviceAssignments.map(s => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        technician: {
          employeeId: s.technician.EmployeeId,
          fullName: s.technician.FullName,
          phone: s.technician.Phone,
          avatarUrl: s.technician.AvatarUrl
        }
      })),
      services: services.map(s => s.ServiceName)
    };

  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {}
    throw err;
  }
}

async function rescheduleCustomerPackageAppointment(userId, customerPackageId, bookingData = {}) {
  const pool = await connectDB();
  const { appointmentDate, startTime, notes } = bookingData;

  if (!appointmentDate) throw new Error("Vui lòng chọn ngày hẹn mới");
  if (!startTime) throw new Error("Vui lòng chọn giờ bắt đầu mới");

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy thông tin hồ sơ khách hàng");

  const apptRes = await pool.request()
    .input("CustomerPackageId", sql.Int, Number(customerPackageId))
    .input("CustomerId", sql.Int, customer.CustomerId)
    .query(`
      SELECT TOP 1 *
      FROM Appointments
      WHERE CustomerPackageId = @CustomerPackageId
        AND CustomerId = @CustomerId
        AND Status IN ('CONFIRMED', 'PENDING', 'BOOKED')
      ORDER BY CreatedAt DESC
    `);

  const currentAppt = apptRes.recordset[0];
  if (!currentAppt) {
    throw new Error("Không tìm thấy lịch hẹn Combo ở trạng thái chờ để đổi lịch (Khách hàng đã check-in hoặc chưa đặt lịch)!");
  }

  const pkgRes = await pool.request()
    .input("CustomerPackageId", sql.Int, Number(customerPackageId))
    .query(`
      SELECT cp.*, p.PackageName
      FROM CustomerPackages cp
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE cp.CustomerPackageId = @CustomerPackageId
    `);
  const cp = pkgRes.recordset[0];

  const svcsRes = await pool.request()
    .input("PackageId", sql.Int, cp.PackageId)
    .query(`
      SELECT s.ServiceId, s.ServiceName, s.DurationMinutes, s.Price
      FROM PackageServices ps
      JOIN Services s ON ps.ServiceId = s.ServiceId
      WHERE ps.PackageId = @PackageId
    `);
  const services = svcsRes.recordset || [];
  const totalDurationMinutes = services.reduce((acc, s) => acc + (Number(s.DurationMinutes) || 30), 0);

  const pad = (n) => String(n).padStart(2, "0");
  const [h, m] = startTime.split(":").map(Number);
  const startD = new Date();
  startD.setHours(h, m, 0, 0);
  const endD = new Date(startD.getTime() + totalDurationMinutes * 60 * 1000);
  const endTime = `${pad(endD.getHours())}:${pad(endD.getMinutes())}:00`;

  let currentStepStart = startD;
  const serviceAssignments = [];

  for (const svc of services) {
    const durMins = Number(svc.DurationMinutes) || 30;
    const stepEnd = new Date(currentStepStart.getTime() + durMins * 60 * 1000);

    const stepStartStr = `${pad(currentStepStart.getHours())}:${pad(currentStepStart.getMinutes())}:00`;
    const stepEndStr = `${pad(stepEnd.getHours())}:${pad(stepEnd.getMinutes())}:00`;

    // Bắt buộc tìm KTV có chuyên môn đúng với dịch vụ này và đang rảnh trong khung giờ đó
    let stepTech;
    try {
      stepTech = await findAvailableTechnician(appointmentDate, stepStartStr, stepEndStr, svc.ServiceId);
    } catch (err) {
      // Không fallback sang KTV không có chuyên môn — thông báo lỗi rõ ràng
      throw new Error(
        `Không tìm được kỹ thuật viên phù hợp cho dịch vụ "${svc.ServiceName}" trong khung giờ ${stepStartStr} - ${stepEndStr}. ` +
        `Vui lòng chọn khung giờ khác hoặc thử lại vào ngày khác.`
      );
    }

    serviceAssignments.push({
      serviceId: svc.ServiceId,
      serviceName: svc.ServiceName,
      durationMinutes: durMins,
      startTime: stepStartStr,
      endTime: stepEndStr,
      technician: stepTech
    });

    currentStepStart = stepEnd;
  }

  const primaryTechnician = serviceAssignments[0]?.technician;

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const apptReq = new sql.Request(transaction);
    apptReq.input("AppointmentId", sql.Int, currentAppt.AppointmentId);
    apptReq.input("EmployeeId", sql.Int, primaryTechnician.EmployeeId);
    apptReq.input("AppointmentDate", sql.Date, appointmentDate);
    apptReq.input("StartTime", sql.VarChar, startTime.length === 5 ? startTime + ":00" : startTime);
    apptReq.input("EndTime", sql.VarChar, endTime);
    apptReq.input("Notes", sql.NVarChar, notes ? `[Đổi lịch Combo: ${cp.PackageName}] ${notes}` : `[Đổi lịch Combo: ${cp.PackageName}]`);

    await apptReq.query(`
      UPDATE Appointments
      SET EmployeeId = @EmployeeId,
          AppointmentDate = @AppointmentDate,
          StartTime = @StartTime,
          EndTime = @EndTime,
          Notes = @Notes,
          UpdatedAt = GETDATE()
      WHERE AppointmentId = @AppointmentId
    `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, currentAppt.AppointmentId)
      .query(`DELETE FROM AppointmentServices WHERE AppointmentId = @AppointmentId`);

    for (const step of serviceAssignments) {
      const svcReq = new sql.Request(transaction);
      svcReq.input("AppointmentId", sql.Int, currentAppt.AppointmentId);
      svcReq.input("ServiceId", sql.Int, step.serviceId);
      svcReq.input("Price", sql.Decimal(18, 2), 0);
      svcReq.input("EmployeeId", sql.Int, step.technician.EmployeeId);
      svcReq.input("StartTime", sql.VarChar, step.startTime);
      svcReq.input("EndTime", sql.VarChar, step.endTime);
      await svcReq.query(`
        INSERT INTO AppointmentServices (AppointmentId, ServiceId, Price, EmployeeId, Status, StartTime, EndTime)
        VALUES (@AppointmentId, @ServiceId, @Price, @EmployeeId, 'PENDING', @StartTime, @EndTime)
      `);
    }

    await transaction.commit();

    return {
      appointmentId: currentAppt.AppointmentId,
      packageName: cp.PackageName,
      appointmentDate,
      startTime,
      endTime,
      totalDurationMinutes,
      technician: {
        employeeId: primaryTechnician.EmployeeId,
        fullName: primaryTechnician.FullName,
        phone: primaryTechnician.Phone,
        avatarUrl: primaryTechnician.AvatarUrl
      },
      serviceAssignments: serviceAssignments.map(s => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        technician: {
          employeeId: s.technician.EmployeeId,
          fullName: s.technician.FullName,
          phone: s.technician.Phone,
          avatarUrl: s.technician.AvatarUrl
        }
      }))
    };
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    throw err;
  }
}

async function getComboHistoryAndReviews(customerId) {
  const pool = await connectDB();

  // 1. Fetch completed combo appointments for this customer
  const apptsRes = await pool
    .request()
    .input("CustomerId", sql.Int, customerId)
    .query(`
      SELECT 
        a.AppointmentId,
        a.CustomerPackageId,
        p.PackageName,
        CONVERT(VARCHAR(10), a.AppointmentDate, 120) AS AppointmentDate,
        CAST(a.StartTime AS VARCHAR(5)) AS StartTime,
        CAST(a.EndTime AS VARCHAR(5)) AS EndTime,
        a.Status,
        a.Notes
      FROM Appointments a
      JOIN CustomerPackages cp ON a.CustomerPackageId = cp.CustomerPackageId
      JOIN Packages p ON cp.PackageId = p.PackageId
      WHERE a.CustomerId = @CustomerId
        AND (
          a.Status = 'COMPLETED'
          OR EXISTS (
            SELECT 1 FROM CustomerPackageUsages u 
            WHERE u.AppointmentId = a.AppointmentId AND u.Status = 'USED'
          )
        )
      ORDER BY a.AppointmentDate DESC, a.StartTime DESC
    `);

  const appts = apptsRes.recordset || [];

  for (const appt of appts) {
    // 2. Fetch service steps + technicians for each combo appointment
    const servicesRes = await pool
      .request()
      .input("AppointmentId", sql.Int, appt.AppointmentId)
      .query(`
        SELECT 
          aps.AppointmentServiceId,
          aps.ServiceId,
          s.ServiceName,
          s.DurationMinutes,
          aps.EmployeeId,
          u.FullName AS TechnicianName,
          u.Phone AS TechnicianPhone,
          COALESCE(e.ImageUrl, u.AvatarUrl) AS TechnicianAvatar,
          r.Rating AS ServiceRating,
          r.TechnicianRating,
          r.Comment AS ServiceComment,
          r.CreatedAt AS ReviewCreatedAt
        FROM AppointmentServices aps
        JOIN Services s ON aps.ServiceId = s.ServiceId
        LEFT JOIN Employees e ON aps.EmployeeId = e.EmployeeId
        LEFT JOIN Users u ON e.UserId = u.UserId
        LEFT JOIN Reviews r ON r.AppointmentId = aps.AppointmentId AND r.ServiceId = aps.ServiceId
        WHERE aps.AppointmentId = @AppointmentId
        ORDER BY aps.AppointmentServiceId ASC
      `);

    appt.Services = servicesRes.recordset || [];

    // 3. Fetch Treatment Notes for this appointment
    const notesRes = await pool
      .request()
      .input("AppointmentId", sql.Int, appt.AppointmentId)
      .query(`
        SELECT TOP 1 Content AS NoteText, SkinCondition, CustomerFeedback
        FROM TreatmentNotes
        WHERE AppointmentId = @AppointmentId
        ORDER BY CreatedAt DESC
      `);

    appt.TreatmentNote = notesRes.recordset[0] || null;

    // Calculate overall combo rating and comments
    const reviewedSteps = appt.Services.filter(s => (s.ServiceRating > 0 || s.TechnicianRating > 0));
    appt.IsReviewed = reviewedSteps.length > 0;
    if (appt.IsReviewed) {
      const sumRating = reviewedSteps.reduce((acc, s) => acc + Number(s.ServiceRating || s.TechnicianRating || 5), 0);
      appt.OverallRating = Math.round(sumRating / reviewedSteps.length);
      const comments = reviewedSteps.map(s => s.ServiceComment).filter(Boolean);
      const uniqueComments = [...new Set(comments)];
      appt.OverallComment = uniqueComments.join(" • ");
    } else {
      appt.OverallRating = null;
      appt.OverallComment = null;
    }
  }

  return appts;
}

async function cancelCustomerPackageAppointment(userId, customerPackageId, reason = "", appointmentId = null) {
  const pool = await connectDB();
  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy thông tin hồ sơ khách hàng");

  let currentAppt;
  if (appointmentId) {
    const apptRes = await pool.request()
      .input("AppointmentId", sql.Int, Number(appointmentId))
      .query(`
        SELECT TOP 1 *
        FROM Appointments
        WHERE AppointmentId = @AppointmentId
      `);
    currentAppt = apptRes.recordset[0];
  }

  if (!currentAppt && customerPackageId) {
    const apptRes = await pool.request()
      .input("CustomerPackageId", sql.Int, Number(customerPackageId))
      .input("CustomerId", sql.Int, customer.CustomerId)
      .query(`
        SELECT TOP 1 *
        FROM Appointments
        WHERE CustomerPackageId = @CustomerPackageId
          AND (CustomerId = @CustomerId OR EXISTS (
            SELECT 1 FROM CustomerPackages cp WHERE cp.CustomerPackageId = @CustomerPackageId AND cp.CustomerId = @CustomerId
          ))
        ORDER BY CreatedAt DESC
      `);
    currentAppt = apptRes.recordset[0];
  }

  if (!currentAppt) {
    throw new Error("Không tìm thấy lịch hẹn Combo để thao tác!");
  }

  if (currentAppt.Status === 'CANCELLED') {
    return {
      success: true,
      message: "Lịch hẹn Combo này đã được hủy trước đó!",
      appointmentId: currentAppt.AppointmentId
    };
  }

  if (["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(String(currentAppt.Status).toUpperCase())) {
    throw new Error("Khách hàng đã check-in tại quầy salon, dịch vụ đang được thực hiện. Không thể hủy lịch hẹn này!");
  }

  const cancelReasonText = String(reason || "Khách hàng hủy lịch sử dụng Combo").trim();

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, currentAppt.AppointmentId)
      .input("Reason", sql.NVarChar, cancelReasonText)
      .query(`
        UPDATE Appointments
        SET Status = 'CANCELLED',
            CancelReason = @Reason,
            UpdatedAt = GETDATE()
        WHERE AppointmentId = @AppointmentId
      `);

    await new sql.Request(transaction)
      .input("AppointmentId", sql.Int, currentAppt.AppointmentId)
      .query(`
        DELETE FROM CustomerPackageUsages
        WHERE AppointmentId = @AppointmentId AND Status <> 'USED'
      `);

    await transaction.commit();
    return {
      success: true,
      message: "Hủy lịch hẹn Combo thành công! Số buổi của bạn vẫn được bảo lưu.",
      appointmentId: currentAppt.AppointmentId
    };
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    throw err;
  }
}

async function submitComboReview({ customerId, appointmentId, overallRating, overallComment, stepReviews = [] }) {
  const pool = await connectDB();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    for (const step of stepReviews) {
      const serviceId = step.serviceId;
      const employeeId = step.employeeId;
      const rating = step.rating || overallRating || 5;
      const comment = step.comment || overallComment || "";

      // Check if review already exists
      const checkRes = await new sql.Request(transaction)
        .input("CustomerId", sql.Int, customerId)
        .input("AppointmentId", sql.Int, appointmentId)
        .input("ServiceId", sql.Int, serviceId)
        .query(`
          SELECT ReviewId FROM Reviews 
          WHERE CustomerId = @CustomerId 
            AND AppointmentId = @AppointmentId 
            AND ServiceId = @ServiceId
        `);

      if (checkRes.recordset.length > 0) {
        await new sql.Request(transaction)
          .input("ReviewId", sql.Int, checkRes.recordset[0].ReviewId)
          .input("Rating", sql.Int, overallRating || rating)
          .input("TechnicianRating", sql.Int, rating)
          .input("Comment", sql.NVarChar, comment)
          .query(`
            UPDATE Reviews
            SET Rating = @Rating,
                TechnicianRating = @TechnicianRating,
                Comment = @Comment,
                UpdatedAt = CURRENT_TIMESTAMP
            WHERE ReviewId = @ReviewId
          `);
      } else {
        await new sql.Request(transaction)
          .input("CustomerId", sql.Int, customerId)
          .input("AppointmentId", sql.Int, appointmentId)
          .input("ServiceId", sql.Int, serviceId)
          .input("EmployeeId", sql.Int, employeeId || null)
          .input("Rating", sql.Int, overallRating || rating)
          .input("TechnicianRating", sql.Int, rating)
          .input("Comment", sql.NVarChar, comment)
          .input("Status", sql.NVarChar, "APPROVED")
          .query(`
            INSERT INTO Reviews (CustomerId, AppointmentId, ServiceId, EmployeeId, Rating, TechnicianRating, Comment, Status, CreatedAt)
            VALUES (@CustomerId, @AppointmentId, @ServiceId, @EmployeeId, @Rating, @TechnicianRating, @Comment, @Status, CURRENT_TIMESTAMP)
          `);
      }
    }

    await transaction.commit();
    return { success: true, message: "Cảm ơn bạn đã đánh giá Combo & Kỹ thuật viên!" };
  } catch (err) {
    try { await transaction.rollback(); } catch {}
    throw err;
  }
}

module.exports = {
  ...module.exports,
  getUsageHistoryPaginated,
  rescheduleCustomerPackageAppointment,
  cancelCustomerPackageAppointment,
  getComboHistoryAndReviews,
  submitComboReview
};



