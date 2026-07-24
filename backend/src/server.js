const { port } = require('./config/env');
const app = require('./app');
const { connectDB } = require('./config/db');
const { startAppointmentReminderScheduler } = require('./modules/notifications/notifications.service');
const { startWaitingListHoldScheduler } = require('./modules/waiting-list/waiting-list.service');
const { startAutoExpireScheduler } = require('./modules/appointments/appointments.service');

// Prevent unhandled async errors from crashing the entire server process
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection] Unhandled promise rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Uncaught exception:', err.message);
});

connectDB().catch(err => console.error('DB connection error:', err.message));

startAppointmentReminderScheduler();
startWaitingListHoldScheduler();
startAutoExpireScheduler(); // Tự động hủy lịch PENDING_PAYMENT sau 15 phút

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
