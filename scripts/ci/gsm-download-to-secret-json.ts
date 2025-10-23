import { envLikeToObject, downloadSecretToFile } from "../secrets/core.ts";

await downloadSecretToFile(
  "decocms-api-dev-vars-prod",
  "../.secrets.json",
  (content) => JSON.stringify(envLikeToObject(content)),
);
