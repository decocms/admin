export const Hosts = {
  API: "api.decocms.com",
  WEB_APP: "admin.decocms.com",
  APPS: "deco.page",
  LOCALHOST: "localhost:3000",
  API_LEGACY: "api.deco.chat",
  WEB_APP_LEGACY: "deco.chat",
} as const;

export const WELL_KNOWN_API_HOSTNAMES = [
  Hosts.API,
  Hosts.API_LEGACY,
  Hosts.LOCALHOST.split(":")[0],
] as const;

export const WELL_KNOWN_ORIGINS = [
  `http://${Hosts.LOCALHOST}`,
  `https://${Hosts.WEB_APP}`,
  `https://${Hosts.WEB_APP_LEGACY}`,
] as const;
