import { serveStatic } from "hono/bun";
import { Hono } from "hono";
import { devServerProxy } from "./dev-server-proxy";

interface AssetServerConfig {
  env: "development" | "production" | "test";
  localDevProxyUrl?: string | URL;
  assetsDirectory?: string;
}

const DEFAULT_LOCAL_DEV_PROXY_URL = "http://localhost:4000";
const DEFAULT_ASSETS_DIRECTORY = "./dist/client";

export const applyAssetServerRoutes = (
  app: Hono,
  config: AssetServerConfig,
) => {
  const environment = config.env;
  const localDevProxyUrl =
    config.localDevProxyUrl ?? DEFAULT_LOCAL_DEV_PROXY_URL;
  const assetsDirectory = config.assetsDirectory ?? DEFAULT_ASSETS_DIRECTORY;

  if (environment === "development") {
    app.use("*", devServerProxy(localDevProxyUrl));
  } else if (environment === "production") {
    app.use("/assets/*", serveStatic({ root: assetsDirectory }));
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
