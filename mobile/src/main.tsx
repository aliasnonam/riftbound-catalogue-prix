import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@/app/globals.css";
import { SiteLanguageProvider } from "@/app/lib/site-language";

document.documentElement.classList.add("android-app");

createRoot(document.getElementById("root")!).render(
  <StrictMode><SiteLanguageProvider><App /></SiteLanguageProvider></StrictMode>,
);
