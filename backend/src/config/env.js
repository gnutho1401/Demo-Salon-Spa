require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const isProduction = process.env.NODE_ENV === "production";

function readOrCreateProductionJwtSecret() {
  const inlineSecret = String(process.env.JWT_SECRET || "").trim();
  if (inlineSecret.length >= 32 && inlineSecret !== "dev_secret_key") {
    return inlineSecret;
  }

  const configuredPath = String(process.env.JWT_SECRET_FILE || "").trim();
  const secretPath = configuredPath
    ? path.resolve(process.cwd(), configuredPath)
    : path.resolve(__dirname, "../../../.runtime/jwt-secret");

  fs.mkdirSync(path.dirname(secretPath), { recursive: true });

  try {
    const existingSecret = fs.readFileSync(secretPath, "utf8").trim();
    if (existingSecret.length >= 32) return existingSecret;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generatedSecret = crypto.randomBytes(48).toString("base64url");
  try {
    fs.writeFileSync(secretPath, generatedSecret, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    return generatedSecret;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const concurrentSecret = fs.readFileSync(secretPath, "utf8").trim();
    if (concurrentSecret.length >= 32) return concurrentSecret;
    throw new Error("JWT secret file exists but is invalid");
  }
}

const jwtSecret = isProduction
  ? readOrCreateProductionJwtSecret()
  : process.env.JWT_SECRET || "dev_secret_key";

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret,
  isProduction,
  db: {
    connectionString: process.env.DATABASE_URL,
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
  },
};
