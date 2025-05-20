import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { z } from "zod";
import { InternalServerError } from "../../errors.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  assertUserHasAccessToWorkspace,
} from "../assertions.ts";
import {
  AppContext,
  createApiHandler,
  createApiHandlerFactory,
} from "../context.ts";

export interface KnowledgeBaseContext extends AppContext {
  name: string;
}
export const KNOWLEDGE_BASE_GROUP = "knowledge_base";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "standard";
const createKnowledgeBaseApiHandler = createApiHandlerFactory<
  KnowledgeBaseContext
>((c) => ({
  ...c,
  name: c.params.name ?? DEFAULT_KNOWLEDGE_BASE_NAME,
}), KNOWLEDGE_BASE_GROUP);

const openAIEmbedder = (apiKey: string) => {
  const openai = createOpenAI({
    apiKey,
  });
  return openai.embedding("text-embedding-3-small");
};

const DEFAULT_DIMENSION = 1536;

export const listKnowledgeBases = createApiHandler({
  name: "KNOWLEDGE_BASE_LIST",
  description: "List all knowledge bases",
  schema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    const mem = await WorkspaceMemory.create({
      workspace: c.workspace.value,
      tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
      tursoOrganization: c.envVars.TURSO_ORGANIZATION,
      tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
      discriminator: KNOWLEDGE_BASE_GROUP, // used to create a unique database for the knowledge base
    });
    const vector = mem.vector;
    if (!vector) {
      throw new InternalServerError("Missing vector");
    }

    const names = await vector.listIndexes();
    // lazily create the default knowledge base
    if (!names.includes(DEFAULT_KNOWLEDGE_BASE_NAME)) {
      // create default knowledge base
      await createBase.handler({
        name: DEFAULT_KNOWLEDGE_BASE_NAME,
      });
      names.push(DEFAULT_KNOWLEDGE_BASE_NAME);
    }
    return { names };
  },
});

export const deleteBase = createApiHandler({
  name: "KNOWLEDGE_BASE_DELETE",
  description: "Delete a knowledge base",
  schema: z.object({
    name: z.string().describe("The name of the knowledge base"),
  }),
  handler: async ({ name }, c) => {
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

    await vector.deleteIndex(name);
  },
});
export const createBase = createApiHandler({
  name: "KNOWLEDGE_BASE_CREATE",
  description: "Create a knowledge base",
  schema: z.object({
    name: z.string().describe("The name of the knowledge base"),
    dimension: z.number().describe("The dimension of the knowledge base")
      .optional(),
  }),
  handler: async ({ name, dimension }, c) => {
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
    await vector.createIndex({
      indexName: name,
      dimension: dimension ?? DEFAULT_DIMENSION,
    });
  },
});

export const forget = createKnowledgeBaseApiHandler({
  name: "KNOWLEDGE_BASE_FORGET",
  description: "Forget something",
  schema: z.object({
    docId: z.string().describe("The id of the content to forget"),
  }),
  handler: async ({ docId }, c) => {
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
    await vector.deleteIndexById(c.name, docId);
  },
});

export const remember = createKnowledgeBaseApiHandler({
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
  handler: async ({ content, metadata, docId: _id }, c) => {
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
    await vector.upsert(c.name, [embedding], [{
      id: docId,
      metadata,
    }]);

    return {
      docId,
    };
  },
});

export const search = createKnowledgeBaseApiHandler({
  name: "KNOWLEDGE_BASE_SEARCH",
  description: "Search the knowledge base",
  schema: z.object({
    query: z.string().describe("The query to search the knowledge base"),
    topK: z.number().describe("The number of results to return").optional(),
    content: z.boolean().describe("Whether to return the content").optional(),
  }),
  handler: async ({ query, topK }, c) => {
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

    const indexName = c.name;
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);
    const { embedding } = await embed({
      model: embedder,
      value: query,
    });

    return await vector.query({
      indexName,
      queryVector: embedding,
      topK: topK ?? 1,
    });
  },
});
