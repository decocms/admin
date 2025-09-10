import { DurableObject } from "cloudflare:workers";
import type { Env } from "../main";

/**
 * Information about a stored blob including its content hash and size.
 */
export interface BlobInfo {
  /** SHA-256 hash of the blob content */
  hash: string;
  /** Size of the blob content in bytes */
  sizeInBytes: number;
}

/**
 * Content Addressable Storage (CAS) Durable Object for storing binary blobs.
 *
 * Blobs are stored by their SHA-256 hash, ensuring content integrity and
 * automatic deduplication. The same content will always produce the same hash.
 */
export class Blobs extends DurableObject {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = this.ctx.storage.sql;
    this.initializeStorage();
  }

  /**
   * Initialize the SQLite storage schema for blobs.
   * Creates the blobs table if it doesn't exist.
   * @private
   */
  private initializeStorage() {
    // Simple CAS table: HASH => Content
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS blobs (
        hash TEXT PRIMARY KEY,
        content BLOB NOT NULL
      )
    `);
  }

  /**
   * Calculate SHA-256 hash of the given buffer.
   * @private
   * @param buffer - The buffer to hash
   * @returns Promise resolving to the hex-encoded hash string
   */
  private async calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Store blob content from a ReadableStream and return its info.
   * The content will be hashed using SHA-256 and stored by that hash.
   *
   * @param content - ReadableStream containing the blob data
   * @returns Promise resolving to BlobInfo with hash and size
   */
  async put(content: ReadableStream<Uint8Array>): Promise<BlobInfo>;

  /**
   * Store blob content from an ArrayBuffer and return its info.
   * The content will be hashed using SHA-256 and stored by that hash.
   *
   * @param content - ArrayBuffer containing the blob data
   * @returns Promise resolving to BlobInfo with hash and size
   */
  async put(content: ArrayBuffer): Promise<BlobInfo>;

  /**
   * Store blob content and return its calculated hash and size.
   *
   * This method accepts either ReadableStream or ArrayBuffer content,
   * calculates the SHA-256 hash, stores the content by that hash,
   * and returns both the hash and size information.
   *
   * The operation is idempotent - storing the same content multiple times
   * will return the same hash and won't create duplicates.
   *
   * @param content - The content to store (ReadableStream or ArrayBuffer)
   * @returns Promise resolving to BlobInfo containing the hash and size
   */
  async put(
    content: ReadableStream<Uint8Array> | ArrayBuffer,
  ): Promise<BlobInfo> {
    let buffer: ArrayBuffer;

    if (content instanceof ArrayBuffer) {
      buffer = content;
    } else {
      // Convert stream to ArrayBuffer
      const reader = content.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLength += value.length;
        }
      } finally {
        reader.releaseLock();
      }

      // Combine chunks into single ArrayBuffer
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = combined.buffer;
    }

    // Calculate hash from content
    const hash = await this.calculateHash(buffer);
    const sizeInBytes = buffer.byteLength;

    // Store content by hash (idempotent)
    this.sql.exec(
      "INSERT OR REPLACE INTO blobs (hash, content) VALUES (?, ?)",
      hash,
      buffer,
    );

    return {
      hash,
      sizeInBytes,
    };
  }

  /**
   * Retrieve blob content as a ReadableStream by its hash.
   *
   * This method provides streaming access to the blob content, which is
   * memory-efficient for large blobs and provides automatic flow control.
   *
   * @param hash - The SHA-256 hash of the blob to retrieve
   * @returns Promise resolving to ReadableStream of the content, or null if not found
   */
  async getStream(hash: string): Promise<ReadableStream<Uint8Array> | null> {
    const result = this.sql.exec(
      "SELECT content FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }

    const content = row.content as ArrayBuffer;
    const uint8Array = new Uint8Array(content);

    return new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });
  }

  /**
   * Retrieve blob content as an ArrayBuffer by its hash.
   *
   * This method provides direct access to the blob content as a buffer,
   * which is convenient for small blobs that can fit in memory.
   *
   * @param hash - The SHA-256 hash of the blob to retrieve
   * @returns Promise resolving to ArrayBuffer of the content, or null if not found
   */
  async getBuffer(hash: string): Promise<ArrayBuffer | null> {
    const result = this.sql.exec(
      "SELECT content FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }
    return row.content as ArrayBuffer;
  }

  /**
   * Retrieve blob content as a ReadableStream by its hash (default method).
   *
   * This is the default get method that returns streaming content for
   * optimal performance and memory usage.
   *
   * @param hash - The SHA-256 hash of the blob to retrieve
   * @returns Promise resolving to ReadableStream of the content, or null if not found
   */
  async get(hash: string): Promise<ReadableStream<Uint8Array> | null> {
    return this.getStream(hash);
  }

  /**
   * Check if a blob exists by its hash.
   *
   * This is a lightweight operation that only checks for existence
   * without transferring any content.
   *
   * @param hash - The SHA-256 hash to check
   * @returns Promise resolving to true if the blob exists, false otherwise
   */
  async has(hash: string): Promise<boolean> {
    const result = this.sql.exec("SELECT 1 FROM blobs WHERE hash = ?", hash);
    return !!result.one();
  }

  /**
   * Get blob metadata without transferring the content.
   *
   * This method returns the hash and size information for a blob
   * without actually retrieving the blob content, making it very
   * efficient for metadata queries.
   *
   * @param hash - The SHA-256 hash of the blob
   * @returns Promise resolving to BlobInfo with hash and size, or null if not found
   */
  async getInfo(hash: string): Promise<BlobInfo | null> {
    const result = this.sql.exec(
      "SELECT LENGTH(content) as size FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }
    return {
      hash,
      sizeInBytes: row.size as number,
    };
  }

  /**
   * Store multiple blobs in a single batch operation.
   * This is more efficient than individual put operations when uploading many files.
   *
   * @param contents - Array of content to store (ReadableStream or ArrayBuffer)
   * @returns Promise resolving to array of BlobInfo with hash and size for each blob
   */
  async putBatch(
    contents: (ReadableStream<Uint8Array> | ArrayBuffer)[],
  ): Promise<BlobInfo[]> {
    // Process all content into buffers in parallel
    const bufferPromises = contents.map(async (content) => {
      if (content instanceof ArrayBuffer) {
        return content;
      } else {
        // Convert stream to ArrayBuffer
        const reader = content.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
          }
        } finally {
          reader.releaseLock();
        }

        // Combine chunks into single ArrayBuffer
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        return combined.buffer;
      }
    });

    // Wait for all streams to be processed in parallel
    const buffers = await Promise.all(bufferPromises);

    // Calculate all hashes in parallel
    const hashPromises = buffers.map((buffer) => this.calculateHash(buffer));
    const hashes = await Promise.all(hashPromises);

    // Prepare results and batch data
    const results: BlobInfo[] = [];
    const batchData: Array<{ hash: string; content: ArrayBuffer }> = [];

    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const hash = hashes[i];
      const sizeInBytes = buffer.byteLength;

      batchData.push({ hash, content: buffer });
      results.push({ hash, sizeInBytes });
    }

    // Batch insert all blobs (using INSERT OR REPLACE for idempotency)
    for (const { hash, content } of batchData) {
      this.sql.exec(
        "INSERT OR REPLACE INTO blobs (hash, content) VALUES (?, ?)",
        hash,
        content,
      );
    }

    return results;
  }
}
