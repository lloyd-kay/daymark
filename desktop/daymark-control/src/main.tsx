import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./daymark-control.css";

const initialStatus = {
  state: "stopped" as const,
  mode: "service" as const,
  access: "local" as const,
  localUrl: "http://127.0.0.1:3210",
  publicUrl: null,
  version: "0.1.0",
  latestMigration: "0003_daymark_seed_recovery.sql",
  message: "Daymark is ready to start.",
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialStatus={initialStatus} />
  </StrictMode>,
);
