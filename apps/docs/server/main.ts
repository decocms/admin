import { withRuntime } from "@decocms/runtime";
import { createAssetServer } from "@decocms/runtime/asset-server";

const assetServer = createAssetServer({
  env: process.env.NODE_ENV as "development" | "production" | "test",
  assetsMiddlewarePath: "*",
});

const runtime = withRuntime({
  fetch: (req, env) => {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/en/introduction", req.url), 302);
    }
    return assetServer.fetch(req, env);
  },
});

export default runtime;
