export const API_SERVER_URL = "https://fs.deco.chat";
// export const API_SERVER_URL = "http://localhost:8000";

export const AUTH_URL = import.meta.env.PROD
  ? "https://auth.deco.chat"
  : "http://localhost:5173";
