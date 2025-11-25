#!/usr/bin/env bun
/**
 * Migration Index Generator
 *
 * Automatically generates the migrations/index.ts file by scanning
 * the migrations folder for all migration files.
 *
 * Usage:
 *   bun run src/generate_migrations.ts
 */

import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function generateMigrationsIndex() {
  console.log("🔍 Scanning migrations folder...");

  const migrationsDir = join(import.meta.dirname, "../migrations");
  const files = await readdir(migrationsDir);

  // Filter for migration files (exclude index.ts and non-ts files)
  const migrationFiles = files
    .filter((file) => file.endsWith(".ts") && file !== "index.ts")
    .sort();

  console.log(`📦 Found ${migrationFiles.length} migration files:`);
  migrationFiles.forEach((file) => console.log(`   - ${file}`));

  // Generate imports
  const imports = migrationFiles
    .map((file) => {
      const name = file.replace(".ts", "");
      const varName = name.replace(/-/g, "");
      return `import * as migration${varName} from "./${file}";`;
    })
    .join("\n");

  // Generate migrations object
  const entries = migrationFiles
    .map((file) => {
      const name = file.replace(".ts", "");
      const varName = name.replace(/-/g, "");
      return `  "${name}": migration${varName},`;
    })
    .join("\n");

  // Generate the full file content
  const content = `import { type Migration } from "kysely";
${imports}

const migrations = {
${entries}
} satisfies Record<string, Migration>;

export default migrations;
`;

  // Write to migrations/index.ts
  const outputPath = join(migrationsDir, "index.ts");
  await writeFile(outputPath, content, "utf-8");

  console.log("\n✅ Generated migrations/index.ts successfully!");
  console.log(`📝 Path: ${outputPath}`);
}

// Run the generator
generateMigrationsIndex()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to generate migrations index:", error);
    process.exit(1);
  });
