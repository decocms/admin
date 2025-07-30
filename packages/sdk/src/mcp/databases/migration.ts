// deno-lint-ignore-file no-explicit-any
import z from "zod";
import { workspaceDB } from "../context.ts";
import { assertHasWorkspace, assertWorkspaceResourceAccess } from "../index.ts";
import { createDatabaseTool } from "./api.ts";

export { getWorkspaceD1Database } from "./d1.ts";

// Helper function to create a basic table schema without constraints
function createBasicTableSchema(
  originalSql: string,
  tableName: string,
): string {
  // Extract the column definitions from the CREATE TABLE statement
  const createTableMatch = originalSql.match(
    /CREATE\s+TABLE\s+["`]?(\w+)["`]?\s*\((.*)\)/is,
  );

  if (!createTableMatch) {
    // Fallback: use the original SQL if we can't parse it
    return originalSql.replace(
      /CREATE\s+TABLE\s+["`]?\w+["`]?/i,
      `CREATE TABLE IF NOT EXISTS "${tableName}"`,
    );
  }

  const columnDefinitions = createTableMatch[2];

  // Split by commas, but be careful about nested parentheses
  const columns: string[] = [];
  let currentColumn = "";
  let parenDepth = 0;
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < columnDefinitions.length; i++) {
    const char = columnDefinitions[i];

    if (!inQuotes && (char === '"' || char === "'" || char === "`")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = "";
    } else if (!inQuotes) {
      if (char === "(") parenDepth++;
      else if (char === ")") parenDepth--;
      else if (char === "," && parenDepth === 0) {
        columns.push(currentColumn.trim());
        currentColumn = "";
        continue;
      }
    }

    currentColumn += char;
  }

  if (currentColumn.trim()) {
    columns.push(currentColumn.trim());
  }

  // Filter out constraints and keep only basic column definitions
  const basicColumns = columns.filter((col) => {
    const upperCol = col.toUpperCase();
    return !upperCol.startsWith("FOREIGN KEY") &&
      !upperCol.startsWith("PRIMARY KEY") &&
      !upperCol.startsWith("UNIQUE") &&
      !upperCol.startsWith("CHECK") &&
      !upperCol.startsWith("CONSTRAINT");
  }).map((col) => {
    // Remove inline constraints from column definitions
    return col
      .replace(/\s+REFERENCES\s+[^,)]+/gi, "") // Remove REFERENCES
      .replace(/\s+ON\s+(DELETE|UPDATE)\s+[^,)]+/gi, "") // Remove ON DELETE/UPDATE
      .replace(/\s+CHECK\s*\([^)]+\)/gi, "") // Remove CHECK constraints
      .trim();
  });

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${
    basicColumns.join(", ")
  })`;
}

export const migrate = createDatabaseTool({
  name: "DATABASES_MIGRATE",
  description: "Migrate data from legacy database to new database",
  inputSchema: z.object({
    migrateWorkflows: z.boolean().optional().describe(
      "If true, workflows will be migrated",
    ),
    dryRun: z.boolean().optional().describe(
      "If true, only shows what would be migrated without executing",
    ),
    tables: z.array(z.string()).optional().describe(
      "Specific tables to migrate. If not provided, all tables will be migrated",
    ),
    batchSize: z.number().default(1000).describe(
      "Number of rows to migrate per batch",
    ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    migratedTables: z.array(z.object({
      tableName: z.string(),
      rowCount: z.number(),
      status: z.enum(["success", "error", "skipped"]),
      error: z.string().optional(),
    })),
    totalRowsMigrated: z.number(),
    executionTimeMs: z.number(),
  }),
  handler: async (
    { dryRun = false, tables, migrateWorkflows = true, batchSize = 1000 },
    c,
  ) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess("DATABASES_RUN_SQL", c);

    const startTime = Date.now();
    const legacyDb = await workspaceDB(c, true);
    const newDb = await workspaceDB(c, false);

    // Disable foreign key constraints during migration to avoid constraint errors
    try {
      using _ = await newDb.exec({
        sql: "PRAGMA foreign_keys = OFF",
        params: [],
      });
    } catch {
      // If we can't disable foreign keys, continue anyway
    }

    const migratedTables: Array<{
      tableName: string;
      rowCount: number;
      status: "success" | "error" | "skipped";
      error?: string;
    }> = [];

    let totalRowsMigrated = 0;

    try {
      // Get all tables from legacy database
      using legacyTablesResponse = await legacyDb.exec({
        sql:
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        params: [],
      });

      const allTables =
        legacyTablesResponse.result[0]?.results as Array<{ name: string }> ||
        [];

      // Filter out system tables that shouldn't be migrated
      const systemTablesToExclude = [
        "_cf_KV",
        "_litestream_seq",
        "_litestream_lock",
        ...(migrateWorkflows ? ["mastra_workflow_snapshot"] : []),
      ];
      const filteredTables = allTables.filter((table) =>
        !systemTablesToExclude.includes(table.name) &&
        !table.name.startsWith("_cf_") &&
        !table.name.startsWith("sqlite_")
      );

      const tablesToMigrate = tables
        ? filteredTables.filter((table) => tables.includes(table.name))
        : filteredTables;

      if (dryRun) {
        for (const table of tablesToMigrate) {
          try {
            using countResponse = await legacyDb.exec({
              sql: `SELECT COUNT(*) as count FROM "${table.name}"`,
              params: [],
            });
            const count =
              (countResponse.result[0]?.results?.[0] as { count: number })
                ?.count || 0;
            migratedTables.push({
              tableName: table.name,
              rowCount: count,
              status: "success",
            });
          } catch (error) {
            migratedTables.push({
              tableName: table.name,
              rowCount: 0,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        return {
          success: true,
          migratedTables,
          totalRowsMigrated: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Actual migration
      for (const table of tablesToMigrate) {
        try {
          // Get table schema from legacy database
          using schemaResponse = await legacyDb.exec({
            sql:
              `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table.name}'`,
            params: [],
          });

          const createTableSql =
            (schemaResponse.result[0]?.results?.[0] as { sql: string })?.sql;

          if (!createTableSql) {
            migratedTables.push({
              tableName: table.name,
              rowCount: 0,
              status: "error",
              error: "Could not retrieve table schema",
            });
            continue;
          }

          // Check if table already exists in new database
          let tableExists = false;
          try {
            using checkTableResponse = await newDb.exec({
              sql:
                `SELECT name FROM sqlite_master WHERE type='table' AND name='${table.name}'`,
              params: [],
            });
            tableExists =
              (checkTableResponse.result[0]?.results?.length || 0) > 0;
          } catch {
            // If we can't check, assume table doesn't exist and try to create it
            tableExists = false;
          }

          if (!tableExists) {
            // Create table in new database with simplified schema (no constraints)
            // Extract just the basic column definitions
            const basicCreateSql = createBasicTableSchema(
              createTableSql,
              table.name,
            );

            try {
              using _ = await newDb.exec({
                sql: basicCreateSql,
                params: [],
              });
            } catch (createError) {
              migratedTables.push({
                tableName: table.name,
                rowCount: 0,
                status: "error",
                error: `Cannot create table: ${
                  createError instanceof Error
                    ? createError.message
                    : String(createError)
                }`,
              });
              continue;
            }
          }

          // Get column information for the table
          using columnsResponse = await legacyDb.exec({
            sql: `PRAGMA table_info("${table.name}")`,
            params: [],
          });

          const columns =
            columnsResponse.result[0]?.results as Array<{ name: string }> || [];
          const columnNames = columns.map((col) => `"${col.name}"`).join(", ");

          // Check if table already has data (for idempotency)
          let existingRowCount = 0;
          try {
            using existingCountResponse = await newDb.exec({
              sql: `SELECT COUNT(*) as count FROM "${table.name}"`,
              params: [],
            });
            existingRowCount =
              (existingCountResponse.result[0]?.results?.[0] as {
                count: number;
              })?.count || 0;
          } catch {
            // If we can't count existing rows, assume table is empty
            existingRowCount = 0;
          }

          // Count total rows in legacy database
          let totalRows = 0;
          try {
            using countResponse = await legacyDb.exec({
              sql: `SELECT COUNT(*) as count FROM "${table.name}"`,
              params: [],
            });
            totalRows =
              (countResponse.result[0]?.results?.[0] as { count: number })
                ?.count || 0;
          } catch (countError) {
            // If we can't count rows, the table might have dependency issues, skip it
            migratedTables.push({
              tableName: table.name,
              rowCount: 0,
              status: "error",
              error: `Cannot access table for counting: ${
                countError instanceof Error
                  ? countError.message
                  : String(countError)
              }`,
            });
            continue;
          }

          // Skip migration if target table already has the same or more rows (idempotency)
          if (existingRowCount >= totalRows && totalRows > 0) {
            migratedTables.push({
              tableName: table.name,
              rowCount: existingRowCount,
              status: "success",
            });
            totalRowsMigrated += existingRowCount;
            continue;
          }

          let migratedRows = 0;
          let offset = 0;
          let hasError = false;

          // Migrate data in batches
          while (offset < totalRows && !hasError) {
            let rows: any[] = [];
            try {
              using dataResponse = await legacyDb.exec({
                sql:
                  `SELECT ${columnNames} FROM "${table.name}" LIMIT ${batchSize} OFFSET ${offset}`,
                params: [],
              });
              rows = dataResponse.result[0]?.results || [];
            } catch (dataError) {
              // If we can't read data, log error and set error flag
              migratedTables.push({
                tableName: table.name,
                rowCount: migratedRows,
                status: "error",
                error: `Cannot read data from table: ${
                  dataError instanceof Error
                    ? dataError.message
                    : String(dataError)
                }`,
              });
              hasError = true;
              break;
            }

            if (rows.length === 0) break;

            // SQLite has a limit of 999 variables per statement
            // Use a very conservative limit as some implementations have lower limits
            const maxRowsPerInsert = Math.max(
              1,
              Math.min(10, Math.floor(50 / columns.length)),
            );

            // Process rows in chunks to respect SQLite variable limit
            for (let i = 0; i < rows.length; i += maxRowsPerInsert) {
              const rowChunk = rows.slice(i, i + maxRowsPerInsert);

              try {
                // Prepare bulk insert for this chunk
                const placeholders = columns.map(() => "?").join(", ");
                const insertSql =
                  `INSERT OR REPLACE INTO "${table.name}" (${columnNames}) VALUES ${
                    rowChunk.map(() => `(${placeholders})`).join(", ")
                  }`;

                // Flatten row data for parameters
                const params: any[] = [];
                for (const row of rowChunk) {
                  for (const column of columns) {
                    params.push((row as any)[column.name]);
                  }
                }

                using _ = await newDb.exec({
                  sql: insertSql,
                  params,
                });
              } catch {
                // If bulk insert fails, fall back to single-row inserts
                const placeholders = columns.map(() => "?").join(", ");
                const singleInsertSql =
                  `INSERT OR REPLACE INTO "${table.name}" (${columnNames}) VALUES (${placeholders})`;

                for (const row of rowChunk) {
                  const params: any[] = [];
                  for (const column of columns) {
                    params.push((row as any)[column.name]);
                  }

                  using _ = await newDb.exec({
                    sql: singleInsertSql,
                    params,
                  });
                }
              }
            }

            migratedRows += rows.length;
            offset += batchSize;
          }

          // Only report success if there was no error
          if (!hasError) {
            migratedTables.push({
              tableName: table.name,
              rowCount: migratedRows,
              status: "success",
            });

            totalRowsMigrated += migratedRows;
          }
        } catch (error) {
          migratedTables.push({
            tableName: table.name,
            rowCount: 0,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Re-enable foreign key constraints after migration
      try {
        using _ = await newDb.exec({
          sql: "PRAGMA foreign_keys = ON",
          params: [],
        });
      } catch {
        // If we can't re-enable foreign keys, continue anyway
      }

      return {
        success: true,
        migratedTables,
        totalRowsMigrated,
        executionTimeMs: Date.now() - startTime,
      };
    } catch {
      // Re-enable foreign key constraints even on error
      try {
        using _ = await newDb.exec({
          sql: "PRAGMA foreign_keys = ON",
          params: [],
        });
      } catch {
        // If we can't re-enable foreign keys, continue anyway
      }

      return {
        success: false,
        migratedTables,
        totalRowsMigrated,
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
});
