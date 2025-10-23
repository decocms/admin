import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { writeFileSync } from "fs";

const client = new SecretManagerServiceClient();
const PROJECT_ID = "decocms";

async function readSecret(secretName: string) {
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`,
  });
  if (!version.payload?.data) {
    throw new Error(`No payload found for secret ${secretName}`);
  }
  return version.payload.data.toString();
}

export async function downloadSecretToFile(secretName: string, filePath: string, transform?: (secret: string) => string) {
  const secret = await readSecret(secretName);
  writeFileSync(filePath, transform ? transform(secret) : secret);
  console.log(`✅ Wrote ${secretName} → ${filePath}`);
}

export function envLikeToObject(envLike: string) {
  const obj = {} as Record<string, string>;
  const lines = envLike.split("\n");
  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      continue;
    }
    const [key, ...value] = line.split("=");
    obj[key] = value.join("=");
  }
  return obj;
}
