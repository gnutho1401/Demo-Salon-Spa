const { getComboHistoryAndReviews, submitComboReview } = require('../src/modules/packages/packages.service');

async function main() {
  console.log('=== TESTING COMBO HISTORY & REVIEW FUNCTIONALITY ===');
  const history = await getComboHistoryAndReviews(1); // CustomerId 1
  console.log('Found completed combo appointments for customer 1:', history.length);
  if (history.length > 0) {
    console.log('Sample appointment services breakdown:', history[0].Services);
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
