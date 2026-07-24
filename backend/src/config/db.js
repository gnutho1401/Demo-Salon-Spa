const mssql = require("mssql");
let mssqlPool;

class MssqlTransaction {
  constructor(connection) {
    if (connection && connection.pool) {
      this.tran = new mssql.Transaction(connection.pool);
    } else {
      this.tran = new mssql.Transaction(connection);
    }
  }
  begin(isolationLevel) {
    return this.tran.begin(isolationLevel);
  }
  commit() {
    return this.tran.commit();
  }
  rollback() {
    return this.tran.rollback();
  }
}

class MssqlRequest {
  constructor(connectionOrTransaction) {
    if (connectionOrTransaction instanceof MssqlTransaction) {
      this.req = new mssql.Request(connectionOrTransaction.tran);
    } else if (connectionOrTransaction && connectionOrTransaction.pool) {
      this.req = new mssql.Request(connectionOrTransaction.pool);
    } else {
      this.req = new mssql.Request(connectionOrTransaction);
    }
  }
  input(name, type, value) {
    this.req.input(name, type, value);
    return this;
  }
  output(name, type, value) {
    this.req.output(name, type, value);
    return this;
  }
  async query(sqlText) {
    let mssqlSql = sqlText;

    // Dịch PostgreSQL LIMIT sang SQL Server OFFSET FETCH (đòi hỏi có ORDER BY, nếu không tự động chèn ORDER BY (SELECT NULL))
    mssqlSql = mssqlSql.replace(/LIMIT\s+(\d+)/gi, (match, limitNum) => {
      if (/ORDER\s+BY/i.test(mssqlSql)) {
        return `OFFSET 0 ROWS FETCH NEXT ${limitNum} ROWS ONLY`;
      } else {
        return `ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT ${limitNum} ROWS ONLY`;
      }
    });

    // Dịch LEFT((col)::text, n) hoặc LEFT(col::text, n) sang LEFT(CONVERT(VARCHAR(30), col), n) cho SQL Server
    mssqlSql = mssqlSql.replace(
      /LEFT\s*\(\s*\(([^)]+)\)::text\s*,\s*(\d+)\s*\)/gi,
      "LEFT(CONVERT(VARCHAR(30), $1), $2)",
    );
    mssqlSql = mssqlSql.replace(
      /LEFT\s*\(\s*([^)]+)::text\s*,\s*(\d+)\s*\)/gi,
      "LEFT(CONVERT(VARCHAR(30), $1), $2)",
    );

    // Dịch ép kiểu ::text trực tiếp sang CONVERT(VARCHAR(MAX), ...)
    mssqlSql = mssqlSql.replace(
      /([a-zA-Z0-9_.]+)::text/gi,
      "CONVERT(VARCHAR(MAX), $1)",
    );

    // Dịch phép nối chuỗi (||) của PostgreSQL sang (+) của SQL Server
    mssqlSql = mssqlSql.replace(/\|\|/g, "+");

    // Dịch kiểu CAST(... AS TEXT) của PostgreSQL sang VARCHAR(MAX) của SQL Server
    mssqlSql = mssqlSql.replace(/\bAS\s+TEXT\b/gi, "AS VARCHAR(MAX)");

    // Dịch unnest(string_to_array(expr, delim)) của PostgreSQL sang value FROM STRING_SPLIT(expr, delim) của SQL Server
    mssqlSql = mssqlSql.replace(
      /unnest\s*\(\s*string_to_array\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*\)(?:::[a-zA-Z0-9_]+)?/gi,
      "value FROM STRING_SPLIT($1, $2)",
    );

    // Dịch phép cộng trừ ngày PostgreSQL CAST(... AS DATE) + n hoặc + CAST(... AS INT) sang DATEADD của SQL Server
    mssqlSql = mssqlSql.replace(
      /CAST\s*\(\s*(.+?)\s*AS\s*DATE\s*\)\s*([+-])\s*(CAST\s*\([^)]+\)|\d+|@[a-zA-Z0-9_]+)/gi,
      (match, expr, sign, rhs) => {
        const trimmedRhs = rhs.trim();
        if (sign === "-") {
          return `DATEADD(day, -(${trimmedRhs}), CAST(${expr} AS DATE))`;
        } else {
          return `DATEADD(day, ${trimmedRhs}, CAST(${expr} AS DATE))`;
        }
      },
    );

    return await this.req.query(mssqlSql);
  }
}

class MssqlPoolWrapper {
  constructor(pool) {
    this.pool = pool;
  }
  request() {
    return new MssqlRequest(this);
  }
  query(sqlText) {
    return new MssqlRequest(this).query(sqlText);
  }
}

async function connectDB() {
  if (mssqlPool) return new MssqlPoolWrapper(mssqlPool);

  const config = {
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "sa",
    server: process.env.DB_SERVER || "localhost",
    database: process.env.DB_DATABASE || "BeautySalonSystem1",
    port: parseInt(process.env.DB_PORT || "1433"),
    options: {
      encrypt: process.env.DB_ENCRYPT === "true",
      trustServerCertificate: process.env.DB_TRUST_CERT === "true",
    },
  };

  try {
    mssqlPool = await mssql.connect(config);
    console.log("Connected to SQL Server successfully!");
    return new MssqlPoolWrapper(mssqlPool);
  } catch (err) {
    console.error("Database connection to SQL Server failed: ", err);
    throw err;
  }
}

const wrappedMssql = {
  ...mssql,
  Request: MssqlRequest,
  Transaction: MssqlTransaction,
};

module.exports = {
  sql: wrappedMssql,
  connectDB,
};
