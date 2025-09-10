This project is **DECONFIG**, a git-like, versioned configuration manager filesystem built on top of **Cloudflare Durable Objects**.

### System Overview

* A single DECONFIG project contains many **branches**.
* Branch operations (`create`, `delete`, `clone`, `branch`, `merge`) are **O(1)**.
* Peers use branches as a **FileSystem-like API with steroids**.
* Peers can **WATCH files** for real-time changes via Server-Sent Events (SSE).
* **Path prefixing** enables multiple peers to work on different virtual directories within the same branch.

### Core Components

1. **Blobs Durable Object** (Content Addressable Storage)

   * Each project owns a Blobs DO (`blobs:blob-1` addressing).
   * Functions as **content-addressable storage (CAS)** using SHA-256 hashing.
   * Stores blobs keyed by hash with **BlobInfo** metadata (hash + size).
   * Supports both **ReadableStream** and **ArrayBuffer** for efficient data transfer.
   * **Batch operations** with `putBatch()` for parallel processing.
   * Scales to virtually infinite storage using `DurableObjectStorage` SQLite.

2. **Branch Durable Object** (Versioned File Trees)

   * Each Branch DO maintains its state in **SQLite** with two tables:
     - `branch_state`: Current tree state and metadata
     - `patches`: Historical changes (delta-based storage)
   * Stores **Tree** as `Record<FilePath, FileMetadata>`.
   * `FileMetadata` includes:
     - `address`: Blob address (`blobs:blob-1:$HASH`)
     - `metadata`: User-defined key/value data
     - `mtime`: Modification time (content changes)
     - `ctime`: Change time (content or metadata changes)
   * **Patch-based history**: Only stores deltas, not full trees (O(1) updates).
   * The Branch DO caches the **current tree in memory** for O(1) lookups.
   * **RPC-based communication** with typed interfaces for tool integration.

3. **Branch Creation & Branching**

   * **BranchConfig interface** for clean initialization:
     - `projectId`: The workspace/project owning this branch
     - `branchName`: Optional name (auto-generated if not provided)
     - `tree`: Initial tree state for efficient branching (O(1) copy)
     - `origin`: Parent branch name for lineage tracking
   * **Lazy creation**: Branches exist as empty when first accessed
   * **O(1) branching**: `sourceRpc.branch(newBranchName)` copies current tree instantly

### Architecture Patterns

**Tool Structure:**
```typescript
// Branch CRUD tools
CREATE_BRANCH     // Create empty or branch from existing
LIST_BRANCHES     // List all branches with metadata
DELETE_BRANCH     // Remove branch and soft-delete files
MERGE_BRANCH      // Merge with conflict resolution
DIFF_BRANCH       // Compare branch states

// File CRUD tools (within branches)
PUT_FILE          // Create/update with conflict detection
READ_FILE         // Stream file content
DELETE_FILE       // Remove file from branch
LIST_FILES        // List files with optional prefix filter
```

**Key Features:**
- **Git-like semantics**: branches, merging, conflict resolution
- **Real-time sync**: SSE file watching with event streams
- **Efficient storage**: Content-addressable blobs with deduplication
- **Transactional writes**: Atomic multi-file operations with conflict detection
- **Workspace isolation**: Database-managed branch metadata per workspace

**Performance Characteristics:**
- Branch creation: O(1) - tree copying, not file copying
- File operations: O(1) - direct SQLite lookups with in-memory caching
- Conflict detection: O(1) - ctime-based optimistic locking
- Storage: O(log n) - content-addressed with automatic deduplication

