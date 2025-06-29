import logo from "../assets/images/logo.png";
import { getEnv } from "./Utils";

export function serverUrl_fn() {
  const env = getEnv();
  const serverurl = env?.REACT_APP_SERVERURL
    ? env.REACT_APP_SERVERURL // env.REACT_APP_SERVERURL is used for prod
    : process.env.REACT_APP_SERVERURL; //  process.env.REACT_APP_SERVERURL is used for dev (locally)
  let baseUrl = serverurl ? serverurl : window.location.origin + "/api/app"; // This was for Parse server with /api/app
  return baseUrl;
}

export function getApiBaseUrl() {
  // For Vite, env vars are accessed via import.meta.env
  const viteApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (viteApiBaseUrl) {
    return viteApiBaseUrl;
  }
  // Fallback for older CRA-style env vars if they exist, or a default for local dev
  const craApiBaseUrl = getEnv()?.REACT_APP_API_BASE_URL || process.env.REACT_APP_API_BASE_URL;
  if (craApiBaseUrl) {
    return craApiBaseUrl;
  }
  // Default if nothing is set - assumes backend runs on 8080, and API routes are at root.
  // Our backend routes are /api/signup, /api/login etc. so this should just be the server origin.
  return "http://localhost:8080";
}

export const appInfo = {
  applogo: logo,
  appId: import.meta.env.VITE_APPID || process.env.REACT_APP_APPID || "opensign", // Updated for Vite
  parseServerUrl: serverUrl_fn(), // Keep old Parse server URL if needed during transition
  apiBaseUrl: getApiBaseUrl(), // New API base URL for our Express/Firebase backend
  defaultRole: "contracts_User",
  fev_Icon:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAALlJREFUaEPtmN0NwjAMBpNxYDKYiM1Yp90g93CKStH1NbIdfz921Dker2Pc+Js1cDF7MXAxASMGYkAigBI6vh9ZwoXP53uZoAYcvhwdA3mAVbI2aSb+9zFKU4IURB6j/HoPUIEa2G3iGIAhQQDlAUIoE2diabIklISS0NoFPebo77RF6OenEF3QntOm128he0GKrwHyACFoz2MgBqSGkpAEcHs47oHtN5AFakACqMNjQEMoE8SABFCHn4HE2zGHSLeEAAAAAElFTkSuQmCC",
  googleClietId: process.env.REACT_APP_GOOGLECLIENTID
    ? `${process.env.REACT_APP_GOOGLECLIENTID}`
    : "",
  metaDescription:
    "The fastest way to sign PDFs & request signatures from others.",
  settings: [
    {
      role: "contracts_Admin",
      menuId: "VPh91h0ZHk",
      pageType: "dashboard",
      pageId: "35KBoSgoAK",
      extended_class: "contracts_Users"
    },
    {
      role: "contracts_OrgAdmin",
      menuId: "VPh91h0ZHk",
      pageType: "dashboard",
      pageId: "35KBoSgoAK",
      extended_class: "contracts_Users"
    },
    {
      role: "contracts_Editor",
      menuId: "H9vRfEYKhT",
      pageType: "dashboard",
      pageId: "35KBoSgoAK",
      extended_class: "contracts_Users"
    },
    {
      role: "contracts_User",
      menuId: "H9vRfEYKhT",
      pageType: "dashboard",
      pageId: "35KBoSgoAK",
      extended_class: "contracts_Users"
    }
  ]
};
