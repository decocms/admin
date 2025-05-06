import { Hono } from "hono";
import { AppEnv } from "./utils/context.ts";

export const app = new Hono<AppEnv>();

export default app;
