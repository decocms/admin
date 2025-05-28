import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { ensureBucketExists, getAssetUrl } from "../utils.ts";
import { PUBLIC_ASSETS_BUCKET } from "../../constants.ts";
import { createTool } from "../context.ts";
import { canAccessWorkspaceResource } from "../assertions.ts";

export const uploadAsset = createTool({
  name: "ASSET_UPLOAD",
  description: "Upload a public asset",
  inputSchema: z.object({
    contentType: z.string().describe(
      "Content-Type for the asset. This is required.",
    ),
    metadata: z.record(z.string(), z.string()).optional().describe(
      "Metadata to be added to the asset",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ contentType, metadata }, c) => {
    await ensureBucketExists(c, PUBLIC_ASSETS_BUCKET);

    const key = crypto.randomUUID();

    const putCommand = new PutObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: `/${key}`,
      ContentType: contentType,
      Metadata: metadata,
    });

    await c.s3.send(putCommand);

    const url = getAssetUrl(key);

    return { url };
  },
});

export const deleteAsset = createTool({
  name: "ASSET_DELETE",
  description: "Delete a public asset",
  inputSchema: z.object({ path: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path }, c) => {
    await ensureBucketExists(c, PUBLIC_ASSETS_BUCKET);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: path,
    });

    return c.s3.send(deleteCommand);
  },
});
