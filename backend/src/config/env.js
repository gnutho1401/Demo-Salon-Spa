require('dotenv').config();

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key',
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE,
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt: toBool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.DB_TRUST_CERT, true),
      enableArithAbort: true,
    }
  },
  vnpay: {
    tmnCode: process.env.VNPAY_TMN_CODE || process.env.VNP_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET || process.env.VNP_HASH_SECRET,
    url: process.env.VNPAY_URL || process.env.VNP_URL,
    returnUrl: process.env.VNPAY_RETURN_URL || process.env.VNP_RETURN_URL,
    ipnUrl: process.env.VNPAY_IPN_URL || process.env.VNP_IPN_URL,
  },
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    endpoint: process.env.MOMO_ENDPOINT,
    queryEndpoint: process.env.MOMO_QUERY_ENDPOINT,
    refundEndpoint: process.env.MOMO_REFUND_ENDPOINT,
    returnUrl: process.env.MOMO_RETURN_URL,
    ipnUrl: process.env.MOMO_IPN_URL,
  },
  payos: {
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  }
};
