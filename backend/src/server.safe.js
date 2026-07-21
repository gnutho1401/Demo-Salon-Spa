const app = require("./app");
const { port } = require("./config/env");
const { connectDB } = require("./config/db");

// Local verification server: expose the API without starting background jobs
// that can send notifications or mutate appointment/payment state.
async function startSafeServer() {
  await connectDB();

  app.listen(port, "127.0.0.1", () => {
    console.log(`Safe backend running at http://127.0.0.1:${port}`);
  });
}

startSafeServer().catch((error) => {
  console.error("Safe backend failed to start:", error.message);
  process.exit(1);
});
