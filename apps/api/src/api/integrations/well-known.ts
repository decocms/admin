import type { Integration } from "@deco/sdk";

export const NEW_INTEGRATION_TEMPLATE: Omit<Integration, "id"> = {
  name: "New Integration",
  description: "A new multi-channel platform integration",
  icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
  connection: { type: "SSE", url: "https://example.com/sse" },
};

export const INNATE_INTEGRATIONS: Record<string, Integration> = {
  DECO_AGENTS: {
    id: "DECO_AGENTS",
    name: "Agents",
    description: "Tools for managing agents, integrations, triggers, and more.",
    icon: "https://assets.webdraw.app/uploads/agents.png",
    connection: { type: "INNATE", name: "DECO_AGENTS" },
  },
  DECO_FS: {
    id: "DECO_FS",
    name: "Filesystem",
    description: "Tools for managing files and directories.",
    icon: "https://assets.webdraw.app/uploads/filesystem.png",
    connection: { type: "INNATE", name: "DECO_FS" },
  },
  DECO_TRIGGER: {
    id: "DECO_TRIGGER",
    name: "Trigger",
    description: "Tools for managing triggers.",
    icon: "https://assets.webdraw.app/uploads/triggers.png",
    connection: { type: "INNATE", name: "DECO_TRIGGER" },
  },
  DECO_INTEGRATIONS: {
    id: "DECO_INTEGRATIONS",
    name: "Integrations",
    description: "Tools for managing integrations.",
    icon: "https://assets.webdraw.app/uploads/integrations.png",
    connection: { type: "INNATE", name: "DECO_INTEGRATIONS" },
  },
  DECO_WALLET: {
    id: "DECO_WALLET",
    name: "Wallet",
    description: "Tools for managing wallets.",
    icon: "https://assets.webdraw.app/uploads/wallet.png",
    connection: { type: "INNATE", name: "DECO_WALLET" },
  },
  DECO_THREADS: {
    id: "DECO_THREADS",
    name: "Threads",
    description: "Tools for managing threads.",
    icon: "https://assets.webdraw.app/uploads/threads.png",
    connection: { type: "INNATE", name: "DECO_THREADS" },
  },
  DECO_UTILS: {
    id: "DECO_UTILS",
    name: "Utils",
    description: "Tools for managing utils.",
    icon: "https://assets.webdraw.app/uploads/utils.png",
    connection: { type: "INNATE", name: "DECO_UTILS" },
  },
};
