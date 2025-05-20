import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { z } from "zod";
import { InternalServerError } from "../../errors.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  assertUserHasAccessToWorkspace,
} from "../assertions.ts";
import { createApiHandler } from "../context.ts";

const DEFAULT_INDEX_NAME = "KNOWLEDGE_BASE";
const openAIEmbedder = (apiKey: string) => {
  const openai = createOpenAI({
    apiKey,
  });
  return openai.embedding("text-embedding-3-small");
};
export const forget = createApiHandler({
  name: "KNOWLEDGE_BASE_FORGET",
  description: "Forget something",
  schema: z.object({
    docId: z.string().describe("The id of the content to forget"),
    name: z.string().describe("The name of the knowledge base").optional(),
  }),
  handler: async ({ docId, name }, c) => {
    assertHasWorkspace(c);
    await assertUserHasAccessToWorkspace(c);
    const mem = await WorkspaceMemory.create({
      workspace: c.workspace.value,
      tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
      tursoOrganization: c.envVars.TURSO_ORGANIZATION,
      tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
    });
    const vector = mem.vector;
    if (!vector) {
      throw new InternalServerError("Missing vector");
    }
    const indexName = name ?? DEFAULT_INDEX_NAME;
    await vector.deleteIndexById(indexName, docId);
  },
});

export const remember = createApiHandler({
  name: "KNOWLEDGE_BASE_REMEMBER",
  description: "Remember something",
  schema: z.object({
    docId: z.string().optional().describe(
      "The id of the content being remembered",
    ),
    content: z.string().describe("The content to remember"),
    name: z.string().describe("The name of the knowledge base").optional(),
    metadata: z.record(z.string(), z.string()).describe(
      "The metadata to remember",
    ).optional(),
  }),
  handler: async ({ content, name, metadata, docId: _id }, c) => {
    assertHasWorkspace(c);
    await assertUserHasAccessToWorkspace(c);
    const mem = await WorkspaceMemory.create({
      workspace: c.workspace.value,
      tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
      tursoOrganization: c.envVars.TURSO_ORGANIZATION,
      tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
    });
    const vector = mem.vector;
    if (!vector) {
      throw new InternalServerError("Missing vector");
    }
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const docId = _id ?? crypto.randomUUID();
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);

    // Create embeddings using OpenAI
    const { embedding } = await embed({
      model: embedder,
      value: content,
    });
    const indexName = name ?? DEFAULT_INDEX_NAME;
    await vector.createIndex({
      indexName,
      dimension: 1536,
    }).catch((err) => {
      console.error("Error creating index", err);
    });

    await vector.updateIndexById(indexName, docId, {
      vector: embedding,
      metadata,
    });

    return {
      docId,
    };
  },
});

export const search = createApiHandler({
  name: "KNOWLEDGE_BASE_SEARCH",
  description: "Search the knowledge base",
  schema: z.object({
    query: z.string().describe("The query to search the knowledge base"),
    name: z.string().describe("The name of the knowledge base").optional(),
    topK: z.number().describe("The number of results to return").optional(),
    content: z.boolean().describe("Whether to return the content").optional(),
  }),
  handler: async ({ query, name, topK }, c) => {
    assertHasWorkspace(c);
    await assertUserHasAccessToWorkspace(c);
    const mem = await WorkspaceMemory.create({
      workspace: c.workspace.value,
      tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
      tursoOrganization: c.envVars.TURSO_ORGANIZATION,
      tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
    });
    const vector = mem.vector;
    if (!vector) {
      throw new InternalServerError("Missing vector");
    }
    const indexName = name ?? DEFAULT_INDEX_NAME;
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);
    const { embedding } = await embed({
      model: embedder,
      value: query,
    });

    return await vector.query({
      indexName,
      queryVector: embedding,
      topK: topK ?? 10,
    });
  },
});
