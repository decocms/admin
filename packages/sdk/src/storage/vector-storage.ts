import type { Client } from "./supabase/client.ts";

/**
 * Vector storage using Supabase pgvector
 */
export class VectorStorage {
  // oxlint-disable-next-line no-explicit-any
  private supabase: any;

  constructor(supabase: Client) {
    this.supabase = supabase;
  }

  /**
   * List all knowledge base indexes
   */
  async listIndexes(): Promise<string[]> {
    try {
      const {
        data,
        error,
      }: { data: Array<{ name: string }> | null; error: unknown } =
        await this.supabase
          .from("knowledge_bases")
          .select("name")
          .order("name");

      if (error) {
        // Table doesn't exist yet - return empty array
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42P01"
        ) {
          console.warn("Knowledge base tables not yet created in Supabase");
          return [];
        }
        console.error("Error listing indexes:", error);
        return [];
      }

      return data?.map((kb) => kb.name) ?? [];
    } catch (error) {
      console.error("Error listing indexes:", error);
      return [];
    }
  }

  /**
   * Create a new knowledge base index
   */
  async createIndex({
    indexName,
    dimension,
  }: {
    indexName: string;
    dimension: number;
  }): Promise<void> {
    try {
      const { error }: { error: unknown } = await this.supabase
        .from("knowledge_bases")
        .insert({
          name: indexName,
          dimension,
          created_at: new Date().toISOString(),
        });

      if (error) {
        // Table doesn't exist yet
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42P01"
        ) {
          throw new Error(
            "Knowledge base feature is not set up. Please run the database migrations to create the required tables.",
          );
        }
        // Ignore duplicate key errors
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "23505"
        ) {
          return; // Index already exists
        }
        throw new Error(
          `Failed to create index: ${
            typeof error === "object" && "message" in error
              ? error.message
              : String(error)
          }`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create index: ${String(error)}`);
    }
  }

  /**
   * Delete a knowledge base index and all its vectors
   */
  async deleteIndex({ indexName }: { indexName: string }): Promise<void> {
    try {
      // Delete all vectors first
      await this.supabase
        .from("knowledge_base_documents")
        .delete()
        .eq("knowledge_base_name", indexName);

      // Delete the index
      const { error }: { error: unknown } = await this.supabase
        .from("knowledge_bases")
        .delete()
        .eq("name", indexName);

      if (error) {
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42P01"
        ) {
          throw new Error(
            "Knowledge base feature is not set up. Please run the database migrations.",
          );
        }
        throw new Error(
          `Failed to delete index: ${
            typeof error === "object" && "message" in error
              ? error.message
              : String(error)
          }`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to delete index: ${String(error)}`);
    }
  }

  /**
   * Upsert vectors with metadata
   */
  async upsert({
    indexName,
    vectors,
    metadata,
  }: {
    indexName: string;
    vectors: number[][];
    metadata: Array<{ id: string; metadata: Record<string, unknown> }>;
  }): Promise<string[]> {
    try {
      const documents = vectors.map((vector, i) => ({
        id: metadata[i].id,
        knowledge_base_name: indexName,
        embedding: vector,
        content: (metadata[i].metadata?.content as string) ?? "",
        metadata: metadata[i].metadata,
        created_at: new Date().toISOString(),
      }));

      const {
        data,
        error,
      }: { data: Array<{ id: string }> | null; error: unknown } =
        await this.supabase
          .from("knowledge_base_documents")
          .upsert(documents, { onConflict: "id" })
          .select("id");

      if (error) {
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42P01"
        ) {
          throw new Error(
            "Knowledge base feature is not set up. Please run the database migrations.",
          );
        }
        throw new Error(
          `Failed to upsert vectors: ${
            typeof error === "object" && "message" in error
              ? error.message
              : String(error)
          }`,
        );
      }

      return data?.map((d) => d.id) ?? [];
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to upsert vectors: ${String(error)}`);
    }
  }

  /**
   * Query vectors by similarity
   */
  async query({
    indexName,
    queryVector,
    topK = 5,
    filter,
  }: {
    indexName: string;
    queryVector: number[];
    topK?: number;
    filter?: Record<string, unknown>;
  }): Promise<
    Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      similarity?: number;
    }>
  > {
    try {
      // Use Supabase's vector similarity search
      // Type annotation to avoid expensive inference
      let query = this.supabase.rpc("match_knowledge_base_documents", {
        query_embedding: queryVector,
        knowledge_base_name: indexName,
        match_count: topK,
      });

      // Apply metadata filters if provided
      if (filter) {
        for (const [key, value] of Object.entries(filter)) {
          query = query.filter(`metadata->${key}`, "eq", value);
        }
      }

      const {
        data,
        error,
      }: { data: Array<{ id: string }> | null; error: unknown } = await query;

      if (error) {
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42883"
        ) {
          // Function doesn't exist
          throw new Error(
            "Knowledge base feature is not set up. Please run the database migrations.",
          );
        }
        throw new Error(
          `Failed to query vectors: ${
            typeof error === "object" && "message" in error
              ? error.message
              : String(error)
          }`,
        );
      }

      return (
        data?.map((doc: Record<string, unknown>) => ({
          id: doc.id as string,
          content: doc.content as string,
          metadata: doc.metadata as Record<string, unknown>,
          similarity: doc.similarity as number | undefined,
        })) ?? []
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to query vectors: ${String(error)}`);
    }
  }

  /**
   * Delete a specific vector by ID
   */
  async deleteVector({
    indexName,
    id,
  }: {
    indexName: string;
    id: string;
  }): Promise<void> {
    try {
      const { error }: { error: unknown } = await this.supabase
        .from("knowledge_base_documents")
        .delete()
        .eq("id", id)
        .eq("knowledge_base_name", indexName);

      if (error) {
        if (
          typeof error === "object" &&
          "code" in error &&
          error.code === "42P01"
        ) {
          throw new Error(
            "Knowledge base feature is not set up. Please run the database migrations.",
          );
        }
        throw new Error(
          `Failed to delete vector: ${
            typeof error === "object" && "message" in error
              ? error.message
              : String(error)
          }`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to delete vector: ${String(error)}`);
    }
  }
}
