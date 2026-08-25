import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import App from "./App.jsx";
import { APP_DISPLAY_NAME, APP_VERSION } from "./config/version.js";

document.title = APP_DISPLAY_NAME;
document.documentElement.dataset.appVersion = APP_VERSION;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

requestAnimationFrame(() => {
  document.body.classList.remove("app-booting");
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.warn("Não foi possível registrar o modo offline.", error);
    });
  });
}
