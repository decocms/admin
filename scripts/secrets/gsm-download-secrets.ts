import { downloadSecretToFile } from "./core.ts";

await downloadSecretToFile("decocms-api-dev-vars", "../apps/api/.dev.vars");
await downloadSecretToFile("decocms-web-env", "../apps/web/.env");
