import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { ensureBucketExists } from "../utils.ts";
import { PUBLIC_ASSETS_BUCKET } from "../../constants.ts";
import { createTool } from "../context.ts";
import { canAccessWorkspaceResource } from "../assertions.ts";

export const writeAsset = createTool({
  name: "FS_ASSET_WRITE",
  description: "Get a secure temporary link to upload a public asset",
  inputSchema: z.object({
    path: z.string(),
    expiresIn: z.number().optional().describe(
      "Seconds until URL expires (default: 60)",
    ),
    contentType: z.string().describe(
      "Content-Type for the asset. This is required.",
    ),
    metadata: z.record(z.string(), z.string()).optional().describe(
      "Metadata to be added to the asset",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path, expiresIn = 60, contentType, metadata }, c) => {
    await ensureBucketExists(c, PUBLIC_ASSETS_BUCKET);

    const putCommand = new PutObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: path,
      ContentType: contentType,
      Metadata: metadata,
    });

    const url = await getSignedUrl(c.s3, putCommand, {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    });

    return { url };
  },
});

export const deleteAsset = createTool({
  name: "FS_ASSET_DELETE",
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
