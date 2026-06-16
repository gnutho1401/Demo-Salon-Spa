const app = require('./app');
const { port } = require('./config/env');
const { connectDB } = require('./config/db');
const { startAppointmentReminderScheduler } = require('./modules/notifications/notifications.service');

connectDB().catch(err => console.error('DB connection error:', err.message));

startAppointmentReminderScheduler();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
