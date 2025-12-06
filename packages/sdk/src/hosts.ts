export const Hosts = {
  API: "api.decocms.com",
  WEB_APP: "admin.decocms.com",
  APPS: "deco.page",
  SITES: "deco.site",
  LOCALHOST: "localhost:3000",
  API_LEGACY: "api.deco.chat",
  WEB_APP_LEGACY: "deco.chat",
} as const;

export const WELL_KNOWN_ORIGINS = [
  `http://${Hosts.LOCALHOST}`,
  `https://${Hosts.WEB_APP}`,
  `https://${Hosts.WEB_APP_LEGACY}`,
] as const;
