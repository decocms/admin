import { withRuntime } from "@decocms/runtime";

interface Env {
  ASSETS: {
    fetch: (req: Request) => Promise<Response>;
  };
}

const runtime = withRuntime<Env>({
  fetch: (req, env) => {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(new URL("/en/introduction", req.url), 302);
    }
    return env.ASSETS.fetch(req);
  },
});

export default runtime;
