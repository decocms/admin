import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  GetObjectCommand,
  GetObjectCommandOutput,
} from "npm:@aws-sdk/client-s3";
import {
  getContentTypeFromPath,
  getWorkspaceBucketName,
} from "@deco/sdk/storage";
import { AppEnv } from "./utils/context.ts";
import { withContextMiddleware } from "./middlewares/context.ts";

export const app = new Hono<AppEnv>();

app.use(withContextMiddleware);

app.get("/:root/:slug/*", async (c) => {
  try {
    if (!c.req.param("root") || !c.req.param("slug")) {
      throw new HTTPException(400, { message: "Workspace not found" });
    }

    const workspace = `/${c.req.param("root")}/${c.req.param("slug")}/`;

    const prefixIndex = c.req.path.indexOf(workspace);
    const imagePath = c.req.path.substring(prefixIndex + workspace.length);

    if (!imagePath) {
      throw new HTTPException(400, { message: "Image path is required" });
    }

    if (!imagePath.startsWith("public/")) {
      throw new HTTPException(403, { message: "Asset is not public" });
    }

    const bucketName = getWorkspaceBucketName(workspace);

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: imagePath,
    });

    const response = await c.var.s3.send(getCommand) as GetObjectCommandOutput;

    if (!response.Body) {
      throw new HTTPException(404, { message: "Image not found" });
    }

    const bodyBytes = await response.Body.transformToByteArray();

    const contentType = response.ContentType ||
      response.Metadata?.["content-type"] ||
      getContentTypeFromPath(imagePath || "") ||
      "application/octet-stream";

    const etag = response.ETag || "";
    const contentLength = String(bodyBytes?.length || 0);

    return new Response(bodyBytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000", // 1 year cache
        "ETag": etag,
        "Content-Length": contentLength,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, { message: "Internal server error" });
  }
});

export default app;
