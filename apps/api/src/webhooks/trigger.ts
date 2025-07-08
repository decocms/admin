import { Trigger } from "@deco/ai/actors";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import { type AppEnv, assertHasWorkspace } from "../utils/context.ts";

export const handleTrigger = async (c: Context<AppEnv>) => {
  const appCtx = honoCtxToAppCtx(c);

  assertHasWorkspace(appCtx);

  const stub = c.get("stub");
  const { id } = c.req.param();

  if (!id) {
    throw new HTTPException(400, { message: "Trigger ID is required" });
  }

  const params = c.req.query();
  const body = await c.req.json();

  const result = await stub(Trigger)
    .new(`${appCtx.workspace.value}/triggers/${id}`)
    .run(body, params);

  return c.json({ result });
};
