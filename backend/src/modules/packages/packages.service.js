const { sql, connectDB } = require("../../config/db");
const crypto = require("crypto");

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

  return result.recordset;
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
        pp.Status AS PaymentStatus,
        pp.TransactionCode,
        pp.PaidAt,

        STRING_AGG(s.ServiceName, N', ') AS ServiceNames
      FROM CustomerPackages cp
      JOIN Packages p
        ON cp.PackageId = p.PackageId
      LEFT JOIN PackageCategories pc
        ON p.PackageCategoryId = pc.PackageCategoryId
      LEFT JOIN PackagePayments pp
        ON cp.CustomerPackageId = pp.CustomerPackageId
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
        pp.Status,
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

async function buyPackage(userId, packageId, payload = {}) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const pkg = await getActivePackage(pool, packageId);
  if (!pkg)
    throw new Error("Combo / liệu trình không tồn tại hoặc đã ngừng bán");

  // Cho phép mua một combo nhiều lần, không chặn khi đang sở hữu gói hoạt động/tạm khóa nữa
  // await checkExistingPackage(pool, customer.CustomerId, packageId);

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

  // Cho phép mua một combo nhiều lần qua VNPAY, không chặn khi đang sở hữu gói hoạt động/tạm khóa nữa
  // await checkExistingPackage(pool, customer.CustomerId, packageId);

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

  return {
    ...pkg,
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

  const startDate = filters.startDate || null;
  const endDate = filters.endDate || null;

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
                  AND cp.EndDate <= CAST(GETDATE() AS DATE) + 7
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
      WHERE (CAST(@StartDate AS DATE) IS NULL OR cp.CreatedAt >= @StartDate)
        AND (CAST(@EndDate AS DATE) IS NULL OR cp.CreatedAt <= CAST(@EndDate AS DATE) + 1)
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
      WHERE (CAST(@StartDate AS DATE) IS NULL OR cp.CreatedAt >= @StartDate)
        AND (CAST(@EndDate AS DATE) IS NULL OR cp.CreatedAt <= CAST(@EndDate AS DATE) + 1)
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
