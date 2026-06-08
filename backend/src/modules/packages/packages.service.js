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
  const params = { ...query };
  const secureHash = params.vnp_SecureHash;

  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  return createVnpHash(params) === secureHash;
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

async function getMine(userId) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
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
        DATEADD(DAY, @ValidityDays, CAST(GETDATE() AS DATE)),
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
        CASE WHEN @Status = 'PAID' THEN GETDATE() ELSE NULL END
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

async function buyPackage(userId, packageId, payload = {}) {
  const pool = await connectDB();

  const customer = await getCustomerByUserId(pool, userId);
  if (!customer) throw new Error("Không tìm thấy hồ sơ khách hàng");

  const pkg = await getActivePackage(pool, packageId);
  if (!pkg)
    throw new Error("Combo / liệu trình không tồn tại hoặc đã ngừng bán");

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
            EndDate = DATEADD(DAY, @ValidityDays, CAST(GETDATE() AS DATE)),
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

module.exports = {
  getAll,
  getCategories,
  getById,
  getMine,
  buyPackage,
  createVnpayPackageUrl,
  handleVnpayReturn,
  create,
  update,
  remove,
};
