import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const isIpBasedLocalhost = ["127.0.0.1", "::1"].includes(
  window.location.hostname,
);

if (import.meta.env.DEV && isIpBasedLocalhost) {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = "localhost";
  window.location.replace(canonicalUrl.toString());
} else {
  createRoot(document.getElementById("root")).render(<App />);
}
//lấy giao diện từ app.jsx hiển thị lên website
