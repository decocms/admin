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
  description:
    "List all threads in a workspace with cursor-based pagination and filtering",
  schema: z.object({
    limit: z.number().min(1).max(10).default(10),
    agentId: z.string().optional(),
    resourceId: z.string().optional(),
    orderBy: z.enum([
      "createdAt_desc",
      "createdAt_asc",
      "updatedAt_desc",
      "updatedAt_asc",
    ]).default("createdAt_desc"),
    cursor: z.string().optional(),
  }),
  handler: async ({ limit, agentId, orderBy, cursor, resourceId }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = env(c);
    const root = c.req.param("root");
    const slug = c.req.param("slug");
    const workspace = `/${root}/${slug}`;

    const [_, client] = await Promise.all([
      assertUserHasAccessToWorkspace(root, slug, c),
      createSQLClientFor(
        workspace,
        TURSO_ORGANIZATION,
        TURSO_GROUP_DATABASE_TOKEN,
      ),
    ]);

    // Parse orderBy parameter
    const [field, direction] = orderBy.split("_");
    const isDesc = direction === "desc";

    // Build the WHERE clause for filtering
    const whereClauses = [];
    const args = [];

    if (agentId) {
      whereClauses.push("json_extract(metadata, '$.agentId') = ?");
      args.push(agentId);
    }

    if (resourceId) {
      whereClauses.push("resourceId = ?");
      args.push(resourceId);
    }

    if (cursor) {
      const operator = isDesc ? "<" : ">";
      whereClauses.push(`${field} ${operator} ?`);
      args.push(cursor);
    }

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    // Get paginated threads
    const result = await client.execute({
      sql:
        `SELECT * FROM mastra_threads ${whereClause} ORDER BY ${field} ${direction.toUpperCase()} LIMIT ?`,
      args: [...args, limit + 1], // Fetch one extra to determine if there are more
    });

    const threads = result.rows
      .map((row: unknown) => ThreadSchema.safeParse(row)?.data)
      .filter((a): a is Thread => !!a);

    // Check if there are more results
    const hasMore = threads.length > limit;
    if (hasMore) {
      threads.pop(); // Remove the extra item
    }

    // Get the cursor for the next page
    const nextCursor = threads.length > 0
      ? field === "createdAt"
        ? threads[threads.length - 1].createdAt
        : threads[threads.length - 1].updatedAt
      : null;

    return {
      threads,
      pagination: {
        hasMore,
        nextCursor,
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

    const [_, client] = await Promise.all([
      assertUserHasAccessToWorkspace(root, slug, c),
      createSQLClientFor(
        workspace,
        TURSO_ORGANIZATION,
        TURSO_GROUP_DATABASE_TOKEN,
      ),
    ]);

    // Get thread details and messages in a single query
    const result = await client.execute({
      sql: `
        SELECT 
          t.*,
          json_group_array(
            json_object(
              'id', m.id,
              'thread_id', m.thread_id,
              'content', m.content,
              'role', m.role,
              'type', m.type,
              'createdAt', m.createdAt
            )
          ) as messages
        FROM mastra_threads t
        LEFT JOIN mastra_messages m ON t.id = m.thread_id
        WHERE t.id = ?
        GROUP BY t.id
      `,
      args: [id],
    });

    if (!result.rows.length) {
      throw new Error("Thread not found");
    }

    const thread = ThreadSchema.parse(result.rows[0]);
    const messages = JSON.parse(String(result.rows[0].messages || "[]"))
      .map((row: unknown) => MessageSchema.safeParse(row)?.data)
      .filter((a: Message | undefined): a is Message => !!a);

    return {
      ...thread,
      messages,
    };
  },
});
