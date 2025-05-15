import { z } from "zod";
import { AppContext, createApiHandler, getEnv } from "../../utils/context.ts";
import { createWalletClient } from "@deco/sdk/wallet";

function getWorkspace(c: AppContext) {
  const root = c.req.param("root");
  const wksSlug = c.req.param("slug");
  const workspace = `${root}/${wksSlug}`;
  return { root, wksSlug, workspace };
}

export const getWalletAccount = createApiHandler({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspace(c);
    const envVars = getEnv(c);

    // @ts-expect-error todo: type the worker binding
    const wallet = createWalletClient(envVars.WALLET_API_KEY, c.var?.WALLET);

  },
});

export const createCheckoutSession = createApiHandler({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  schema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspace(c);
    const envVars = getEnv(c);
    
    
  },
});
