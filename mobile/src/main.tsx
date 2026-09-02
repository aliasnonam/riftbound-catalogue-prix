import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@/app/globals.css";

document.documentElement.classList.add("android-app");

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
