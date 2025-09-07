/**
 * This is where you define your views.
 *
 * Declaring views here will make them available on the user's
 * project when they install your MCP server.
 *
 * @see https://docs.deco.page/en/guides/building-views/
 */
import { StateSchema } from "./deco.gen";
import { Env } from "./main.ts";
import type { CreateMCPServerOptions } from "@deco/workers-runtime/mastra";

export const views: CreateMCPServerOptions<Env, typeof StateSchema>["views"] =
  () => [
    {
      title: "Apps",
      icon: "folder_managed", // Available icons: https://fonts.google.com/icons?selected=Material+Icons
      url: "https://mesh.deco.page/", // This will point to the built Astro view
    },
  ];
