const app = require('./app');
const { port } = require('./config/env');
const { connectDB } = require('./config/db');
const { startAppointmentReminderScheduler } = require('./modules/notifications/notifications.service');
const { startWaitingListHoldScheduler } = require('./modules/waiting-list/waiting-list.service');
const { startAutoExpireScheduler } = require('./modules/appointments/appointments.service');

connectDB().catch(err => console.error('DB connection error:', err.message));

startAppointmentReminderScheduler();
startWaitingListHoldScheduler();
startAutoExpireScheduler(); // Tự động hủy lịch PENDING_PAYMENT sau 15 phút

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
