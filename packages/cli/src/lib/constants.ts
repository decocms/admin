import process from "node:process";
const LOCAL_DEBUGGER = process.env.VITE_USE_LOCAL_BACKEND === "true";

export const SUPABASE_URL = "https://auth.deco.cx";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96a3NnZG15cnFjeGN3aG5iZXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NzU3MDEsImV4cCI6MjA3MjM1MTcwMX0.X1SIxXbivIa2dEkWGfn6xigoHCms9Kri9SLu8N-VWck";

const DECO_CMS_WEB_URL = LOCAL_DEBUGGER
  ? "http://localhost:3000"
  : "https://admin.decocms.com";

export const DECO_CMS_API_PROD = "https://api.decocms.com";
export const DECO_CMS_API_LOCAL = "http://localhost:3001";

export const AUTH_PORT_CLI = 3457;

export const DECO_CMS_LOGIN_URL = new URL("/login?cli", DECO_CMS_WEB_URL).href;
