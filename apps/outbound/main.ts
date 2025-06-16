const Hosts = {
  API: "api.deco.chat",
  APPS: "deco.page",
} as const;

export interface Env {
  DECO_CHAT_API: Service;
}

const wellKnownHosts = Object.values(Hosts) as string[];
export const isWellKnownHost = (host: string): boolean => {
  return wellKnownHosts.includes(host) || host.endsWith(Hosts.APPS);
};

export default {
  fetch: (req: Request, env: Env) => {
    const host = req.headers.get("host") ?? new URL(req.url).hostname;
    const fetcher = isWellKnownHost(host)
      ? (req: Request, opts?: RequestInit) =>
        env?.DECO_CHAT_API?.fetch(req, opts) ?? fetch(req, opts)
      : fetch;
    return fetcher(req);
  },
};
