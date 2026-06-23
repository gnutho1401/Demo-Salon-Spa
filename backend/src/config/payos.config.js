const { PayOS } = require("@payos/node");

const clientId = process.env.PAYOS_CLIENT_ID;
const apiKey = process.env.PAYOS_API_KEY;
const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

let payosInstance = null;
let payosPayoutInstance = null;

function getPayOS() {
  if (!payosInstance) {
    if (!clientId || !apiKey || !checksumKey) {
      throw new Error("Thiếu cấu hình PayOS (PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY)");
    }
    payosInstance = new PayOS(clientId, apiKey, checksumKey);
  }
  return payosInstance;
}

function getPayOSPayout() {
  if (!payosPayoutInstance) {
    const payoutClientId = process.env.PAYOS_PAYOUT_CLIENT_ID || clientId;
    const payoutApiKey = process.env.PAYOS_PAYOUT_API_KEY || apiKey;
    const payoutChecksumKey = process.env.PAYOS_PAYOUT_CHECKSUM_KEY || checksumKey;

    if (!payoutClientId || !payoutApiKey || !payoutChecksumKey) {
      throw new Error("Thiếu cấu hình PayOS Payout");
    }
    payosPayoutInstance = new PayOS(payoutClientId, payoutApiKey, payoutChecksumKey);
  }
  return payosPayoutInstance;
}

module.exports = { getPayOS, getPayOSPayout };
