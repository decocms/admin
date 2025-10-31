/**
 * This is where you define your views.
 *
 * Declaring views here will make them available on the user's
 * project when they install your MCP server.
 * 
 * Since we need absolute URLs for now, the app must be deployed to have
 * a app-name.deco.page url to be used here.
 *
 * @see https://docs.deco.page/en/guides/building-views/
 */
import { StateSchema } from "../shared/deco.gen.ts";
import { Env } from "./main.ts";
import type { CreateMCPServerOptions } from "@deco/workers-runtime/mastra";

export const views: CreateMCPServerOptions<Env, typeof StateSchema>["views"] =
  () => [
    // {
    //     title: "My View",
    //     icon: "mode_cool", // Available icons: https://fonts.google.com/icons?selected=Material+Icons
    //     url: "https://my-view.deco.page",
    // },
  ];
