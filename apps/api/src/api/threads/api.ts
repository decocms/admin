import { createClient } from "@libsql/client/web";
import { env } from "hono/adapter";
import { z } from "zod";
import { assertUserHasAccessToWorkspace } from "../../auth/assertions.ts";
import { createApiHandler } from "../../utils/context.ts";
import { generateUUIDv5, toAlphanumericId } from "../../utils/slugify.ts";

const safeParse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

const ThreadSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
  metadata: z.string().transform(safeParse),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  content: z.string().transform(safeParse),
  role: z.string(),
  type: z.string(),
  createdAt: z.string(),
});

type Thread = z.infer<typeof ThreadSchema>;
type Message = z.infer<typeof MessageSchema>;

const TURSO_GROUP = "deco-agents-v2";

const createSQLClientFor = async (
  workspace: string,
  organization: string,
  authToken: string,
) => {
  const memoryId = await toAlphanumericId(
    `${workspace}/default`,
  );
  const uniqueDbName = await generateUUIDv5(
    `${memoryId}-${TURSO_GROUP}`,
  );

  return createClient({
    url: `libsql://${uniqueDbName}-${organization}.turso.io`,
    authToken: authToken,
  });
};

export const listThreads = createApiHandler({
  name: "THREADS_LIST",
  description: "List all threads in a workspace with pagination",
  schema: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }),
  handler: async ({ page, limit }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = env(c);
    const root = c.req.param("root");
    const slug = c.req.param("slug");
    const workspace = `/${root}/${slug}`;

    await assertUserHasAccessToWorkspace(root, slug, c);

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    const offset = (page - 1) * limit;

    // Get total count for pagination
    const countResult = await client.execute({
      sql: `SELECT COUNT(*) as total FROM mastra_threads`,
      args: [],
    });
    const total = Number(countResult.rows[0].total);

    // Get paginated threads
    const result = await client.execute({
      sql:
        `SELECT * FROM mastra_threads ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      args: [limit, offset],
    });

    const threads = result.rows
      .map((row: unknown) => ThreadSchema.safeParse(row)?.data)
      .filter((a): a is Thread => !!a);

    return {
      threads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
});

export const getThread = createApiHandler({
  name: "THREADS_GET_WITH_MESSAGES",
  description: "Get a thread and its messages by thread id",
  schema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = env(c);
    const root = c.req.param("root");
    const slug = c.req.param("slug");
    const workspace = `/${root}/${slug}`;

    await assertUserHasAccessToWorkspace(root, slug, c);

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    // Get thread details
    const threadResult = await client.execute({
      sql: "SELECT * FROM mastra_threads WHERE id = ?",
      args: [id],
    });

    if (!threadResult.rows.length) {
      throw new Error("Thread not found");
    }

    const thread = ThreadSchema.parse(threadResult.rows[0]);

    // Get messages for this thread
    const messagesResult = await client.execute({
      sql:
        "SELECT * FROM mastra_messages WHERE thread_id = ? ORDER BY createdAt ASC",
      args: [id],
    });

    const messages = messagesResult.rows
      .map((row: unknown) => MessageSchema.safeParse(row)?.data)
      .filter((a): a is Message => !!a);

    return {
      ...thread,
      messages,
    };
  },
});
