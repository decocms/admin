export * from "./src/actors.ts";
import { default as app } from "./src/app.ts";
import { instrument } from "@deco/sdk/observability";
import { getRuntimeKey } from "hono/adapter";

const instrumentedApp = getRuntimeKey() === "deno" ? app : instrument(app);

export default instrumentedApp;
