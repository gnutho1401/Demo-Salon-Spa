const crypto = require('crypto');
const qs = require('qs');

function signMoMo(params, secretKey) {
  const raw = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHmac('sha256', secretKey).update(raw).digest('hex');
}

function buildSignedPayload(baseParams, secretKey) {
  const signature = signMoMo(baseParams, secretKey);
  return { ...baseParams, signature };
}

module.exports = { signMoMo, buildSignedPayload };
