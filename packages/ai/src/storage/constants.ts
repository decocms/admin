import { tools as agentsTools } from "../agents/tools.ts";
import { tools as integrationsTools } from "../integrations/tools.ts";
import { tools as threadTools } from "../threads/tools.ts";
import { tools as utilsTools } from "../tools.ts";
import { tools as triggersTools } from "../triggers/tools.ts";
import { tools as walletTools } from "../wallet/tools.ts";

export const INNATE_TOOLS = {
  DECO_AGENTS: agentsTools,
  DECO_TRIGGER: triggersTools,
  DECO_INTEGRATIONS: integrationsTools,
  DECO_WALLET: walletTools,
  DECO_THREADS: threadTools,
  DECO_UTILS: utilsTools,
};

