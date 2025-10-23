import { envLikeToObject, downloadSecretToFile } from "../secrets/core.ts";

await downloadSecretToFile(
    "decocms-api-dev-vars", 
    "../.secrets.json", 
    (content) => JSON.stringify(envLikeToObject(content)),
);