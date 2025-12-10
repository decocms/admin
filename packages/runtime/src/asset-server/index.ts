import { serveStatic } from "hono/bun";
import { Hono } from "hono";
import { devServerProxy } from "./dev-server-proxy";
import { Handler } from "hono/types";

interface AssetServerConfig {
  env: "development" | "production" | "test";
  localDevProxyUrl?: string | URL;
  /**
   * The prefix to use for serving the assets.
   * Default: "/assets/*"
   */
  assetsMiddlewarePath?: string;
  assetsDirectory?: string;
}

const DEFAULT_LOCAL_DEV_PROXY_URL = "http://localhost:4000";
const DEFAULT_ASSETS_DIRECTORY = "./dist/client";

interface HonoApp {
  use: (path: string, handler: Handler) => void;
  get: (path: string, handler: Handler) => void;
}

export const applyAssetServerRoutes = (
  app: HonoApp,
  config: AssetServerConfig,
) => {
  const environment = config.env;
  const localDevProxyUrl =
    config.localDevProxyUrl ?? DEFAULT_LOCAL_DEV_PROXY_URL;
  const assetsDirectory = config.assetsDirectory ?? DEFAULT_ASSETS_DIRECTORY;

  if (environment === "development") {
    app.use("*", devServerProxy(localDevProxyUrl));
  } else if (environment === "production") {
    app.use(config.assetsMiddlewarePath ?? "/assets/*", serveStatic({ root: assetsDirectory }));
    app.get("*", serveStatic({ path: `${assetsDirectory}/index.html` }));
  }
};

export const createAssetServer = (config: AssetServerConfig) => {
  const app = new Hono();
  applyAssetServerRoutes(app, config);
  return app;
};

export const createAssetServerFetcher = (config: AssetServerConfig) =>
  createAssetServer(config).fetch;
