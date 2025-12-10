import { withRuntime } from "@decocms/runtime";
import { createAssetServer } from "@decocms/runtime/asset-server";

interface Env {
  ASSETS?: {
    fetch: (req: Request) => Promise<Response>;
  };
}

const runtime = withRuntime<Env>({
  fetch: (req, env) => {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/en/introduction", req.url), 302);
    }

    const assets =
      env.ASSETS ??
      createAssetServer({
        env: "development",
        assetsMiddlewarePath: "*",
      });

    return assets.fetch(req);
  },
});

export default runtime;
