import { D1Store } from "@mastra/cloudflare-d1";
import { MessageList } from "@mastra/core/agent";
import { UIMessage } from "ai";
import { z } from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import {
  type AppContext,
  createToolGroup,
  type DatatabasesRunSqlInput,
  workspaceDB,
} from "../context.ts";
import { InternalServerError, NotFoundError } from "../index.ts";

const createTool = createToolGroup("Thread", {
  name: "Thread Management",
  description: "Track conversation history and usage.",
  icon: "https://assets.decocache.com/mcp/4306211f-3d5e-4f1b-b55f-b46787ac82fe/Thread-Management.png",
});

/**
 * Get D1Store instance for the workspace
 * Similar to _initializeMemoryStore in agent.ts
 */
async function getD1Store(c: AppContext): Promise<D1Store> {
  assertHasWorkspace(c);
  const db = await workspaceDB(c);

  // Create D1Client adapter for IWorkspaceDB
  const d1Store = new D1Store({
    client: {
      query: async (args: DatatabasesRunSqlInput) => {
        const result = await db.exec(args);
        return { result: result.result || [] };
      },
    },
  });

  await d1Store.init();
  return d1Store;
}

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

type Thread = z.infer<typeof ThreadSchema>;

export const listThreads = createTool({
  name: "THREADS_LIST",
  description:
    "List all threads in a workspace with cursor-based pagination and filtering",
  inputSchema: z.lazy(() =>
    z.object({
      limit: z.number().min(1).max(100).default(10).optional(),
      agentId: z.string().optional(),
      resourceId: z.string().optional(),
      orderBy: z
        .enum([
          "createdAt_desc",
          "createdAt_asc",
          "updatedAt_desc",
          "updatedAt_asc",
        ])
        .default("createdAt_desc")
        .optional(),
      cursor: z.string().optional(),
    }),
  ),
  handler: async (
    { limit = 10, agentId, orderBy = "createdAt_desc", cursor, resourceId },
    c,
  ) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // Parse orderBy parameter
    const [field, direction] = orderBy.split("_");
    const isDesc = direction === "desc";

    // Build the WHERE clause for filtering
    const whereClauses: string[] = [];
    const args: string[] = [];

    if (agentId) {
      whereClauses.push("json_extract(metadata, '$.agentId') = ?");
      args.push(agentId);
    }

    if (resourceId) {
      whereClauses.push("resourceId = ?");
      args.push(resourceId);
    }

    let cursorWhereClauseIdx: number | undefined = undefined;
    if (cursor) {
      const operator = isDesc ? "<" : ">";
      cursorWhereClauseIdx = whereClauses.length;
      whereClauses.push(`${field} ${operator} ?`);
      args.push(cursor);
    }

    // Filter out deleted threads
    whereClauses.push(
      "(json_extract(metadata, '$.deleted') IS NULL OR json_extract(metadata, '$.deleted') = false)",
    );

    const prevWhereClauses = [...whereClauses];
    const hasCursor = cursorWhereClauseIdx !== undefined;
    if (cursorWhereClauseIdx !== undefined) {
      const operator = isDesc ? ">" : "<"; // opposite of cursor
      prevWhereClauses[cursorWhereClauseIdx] = `${field} ${operator} ?`;
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const prevWhereClause =
      prevWhereClauses.length > 0
        ? `WHERE ${prevWhereClauses.join(" AND ")}`
        : "";

    const db = await workspaceDB(c);

    const generateQuery = async (where: string) => {
      try {
        using data = await db.exec({
          sql: `SELECT * FROM mastra_threads ${where} ORDER BY ${field} ${direction.toUpperCase()} LIMIT ?`,
          params: [...args, limit + 1], // Fetch one extra to determine if there are more
        });
        return { data, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    };

    const [{ data: currData, error }, { data: prevData }] = await Promise.all([
      generateQuery(whereClause),
      hasCursor
        ? generateQuery(prevWhereClause)
        : Promise.resolve({
            data: { result: [{ results: [] }] },
            error: null,
          } as const),
    ]);

    const currRows = currData?.result?.[0]?.results ?? [];
    const prevRows = prevData?.result?.[0]?.results ?? [];

    if (!currRows || error) {
      return {
        threads: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
          prevCursor: null,
          hasPrev: false,
        },
      };
    }

    const threads = currRows
      .map((row: unknown) => ThreadSchema.safeParse(row)?.data)
      .filter((a): a is Thread => !!a);
    const prevThreads = prevRows
      .map((row: unknown) => ThreadSchema.safeParse(row)?.data)
      .filter((t): t is Thread => !!t);

    // Check if there are more results
    const hasMore = threads.length > limit;
    if (hasMore) {
      threads.pop(); // Remove the extra item
    }

    // Get the cursor for the next page
    const nextCursor =
      threads.length > 0
        ? field === "createdAt"
          ? threads[threads.length - 1].createdAt
          : threads[threads.length - 1].updatedAt
        : null;

    const _prevCursor =
      prevThreads.length > 0
        ? field === "createdAt"
          ? prevThreads[0]?.createdAt
          : prevThreads[0]?.updatedAt
        : null;

    const prevCursor = _prevCursor ? new Date(_prevCursor) : null;
    if (prevCursor) {
      prevCursor.setMilliseconds(
        prevCursor.getMilliseconds() + (isDesc ? 1 : -1),
      );
    }

    return {
      threads,
      pagination: {
        hasMore,
        nextCursor,
        prevCursor: prevCursor?.toISOString() ?? null,
        hasPrev: !!prevCursor,
      },
    };
  },
});

export const getThreadMessages = createTool({
  name: "THREADS_GET_MESSAGES",
  description: "Get only the messages for a thread by thread id",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c): Promise<{ messages: UIMessage[] }> => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const store = await getD1Store(c);
    const messages = await store.getMessages({
      threadId: id,
      format: "v2",
    });

    const messageList = new MessageList({ threadId: id });

    messageList.add(messages, "memory");

    return {
      messages: messageList.get.all.aiV5.ui(),
    };
  },
});

export const getThread = createTool({
  name: "THREADS_GET",
  description: "Get a thread by thread id (without messages)",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const store = await getD1Store(c);
    const thread = await store.getThreadById({ threadId: id });

    if (!thread) {
      throw new NotFoundError("Thread not found");
    }

    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title ?? "Untitled",
      metadata: thread.metadata,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
  },
});
export const updateThreadTitle = createTool({
  name: "THREADS_UPDATE_TITLE",
  description: "Update a thread's title",
  inputSchema: z.lazy(() =>
    z.object({
      threadId: z.string(),
      title: z.string(),
    }),
  ),
  handler: async ({ threadId, title }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const store = await getD1Store(c);

    // Get existing thread first to preserve metadata
    const existingThread = await store.getThreadById({ threadId });
    if (!existingThread) {
      throw new NotFoundError("Thread not found");
    }

    const result = await store.updateThread({
      id: threadId,
      title,
      metadata: existingThread.metadata ?? {},
    });

    return {
      id: result.id,
      resourceId: result.resourceId,
      title: result.title,
      metadata: result.metadata,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  },
});

export const updateThreadMetadata = createTool({
  name: "THREADS_UPDATE_METADATA",
  description: "Update a thread's metadata",
  inputSchema: z.lazy(() =>
    z.object({
      threadId: z.string(),
      metadata: z.record(z.unknown()),
    }),
  ),
  handler: async ({ threadId, metadata }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const store = await getD1Store(c);

    const currentThread = await store.getThreadById({ threadId });
    if (!currentThread) {
      throw new NotFoundError("Thread not found");
    }

    const result = await store.updateThread({
      id: threadId,
      title: (currentThread.title ?? "Untitled") as string,
      metadata: { ...currentThread.metadata, ...metadata },
    });

    if (!result) {
      throw new InternalServerError("Failed to update thread metadata");
    }

    return {
      id: result.id,
      resourceId: result.resourceId,
      title: result.title,
      metadata: result.metadata,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  },
});
