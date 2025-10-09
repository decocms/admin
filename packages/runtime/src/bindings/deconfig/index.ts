/**
 * DeconfigResources 2.0
 *
 * This module provides file-based resource management using the Resources 2.0 system
 * with standardized `rsc://` URI format and consistent CRUD operations.
 *
 * Key Features:
 * - File-based resource storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe resource definitions with Zod validation
 * - Full CRUD operations with proper error handling
 * - Integration with existing deconfig file system
 * - Support for custom resource schemas and enhancements
 */

import { impl } from "../binder.ts";
import type { BaseResourceDataSchema } from "../resources/bindings.ts";
import { createResourceBindings } from "../resources/bindings.ts";
import { ResourceUriSchema } from "../resources/schemas.ts";
import {
  buildFilePath,
  constructResourceUri,
  extractResourceId,
  getMetadataString,
  normalizeDirectory,
} from "./helpers.ts";
import type { DeconfigClient, DeconfigResourceOptions } from "./types.ts";

export type {
  EnhancedResourcesTools,
  ResourcesBinding,
  ResourcesTools,
} from "./types.ts";
export type { DeconfigClient, DeconfigResourceOptions };

// Error classes - these will be imported from SDK when used there
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UserInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserInputError";
  }
}

export const createDeconfigResource = <
  TDataSchema extends BaseResourceDataSchema,
>(
  options: DeconfigResourceOptions<TDataSchema>,
) => {
  const {
    resourceName,
    dataSchema,
    enhancements,
    env,
    directory: dir,
    validate: semanticValidate,
  } = options;
  const deconfig = env.DECONFIG;
  const directory = dir ? dir : `/resources/${resourceName}`;

  // Create resource-specific bindings using the provided data schema
  const resourceBindings = createResourceBindings(resourceName, dataSchema);

  const tools = impl(resourceBindings, [
    // deco_resource_search
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_SEARCH` as keyof typeof enhancements
        ]?.description ||
        `Search ${resourceName} resources in the DECONFIG directory ${directory}`,
      handler: async ({
        term,
        page = 1,
        pageSize = 10,
        filters,
        sortBy,
        sortOrder,
      }) => {
        const normalizedDir = normalizeDirectory(directory);
        const offset = pageSize !== Infinity ? (page - 1) * pageSize : 0;

        // List all files in the directory
        const filesList = await deconfig.LIST_FILES({
          prefix: normalizedDir,
        });

        // Filter files that end with .json
        const allFiles = Object.entries(filesList.files)
          .filter(([path]) => path.endsWith(".json"))
          .map(([path, metadata]) => ({
            path,
            resourceId: path
              .replace(`${normalizedDir}/`, "")
              .replace(".json", ""),
            metadata,
          }));

        // Simple search - filter by resource ID, path, title, description, created_by, or updated_by
        let filteredFiles = allFiles;
        if (term) {
          filteredFiles = allFiles.filter(({ resourceId, path, metadata }) => {
            const searchTerm = term.toLowerCase();
            return (
              resourceId.toLowerCase().includes(searchTerm) ||
              path.toLowerCase().includes(searchTerm) ||
              (
                getMetadataString(metadata, "name")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "description")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "createdBy")?.toLowerCase() ?? ""
              ).includes(searchTerm) ||
              (
                getMetadataString(metadata, "updatedBy")?.toLowerCase() ?? ""
              ).includes(searchTerm)
            );
          });
        }

        // Apply additional filters if provided
        if (filters) {
          const createdByFilter = filters.created_by as
            | string
            | string[]
            | undefined;
          const updatedByFilter = filters.updated_by as
            | string
            | string[]
            | undefined;

          if (createdByFilter) {
            const createdBySet = new Set(
              Array.isArray(createdByFilter)
                ? createdByFilter.map((v: unknown) => String(v))
                : [String(createdByFilter)],
            );
            filteredFiles = filteredFiles.filter(({ metadata }) => {
              const value = getMetadataString(metadata, "createdBy");
              return value ? createdBySet.has(value) : false;
            });
          }

          if (updatedByFilter) {
            const updatedBySet = new Set(
              Array.isArray(updatedByFilter)
                ? updatedByFilter.map((v: unknown) => String(v))
                : [String(updatedByFilter)],
            );
            filteredFiles = filteredFiles.filter(({ metadata }) => {
              const value = getMetadataString(metadata, "updatedBy");
              return value ? updatedBySet.has(value) : false;
            });
          }
        }

        // Sort if specified
        if (sortBy) {
          filteredFiles.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            if (sortBy === "resourceId") {
              aValue = a.resourceId;
              bValue = b.resourceId;
            } else if (sortBy === "name") {
              aValue = getMetadataString(a.metadata, "name") || a.resourceId;
              bValue = getMetadataString(b.metadata, "name") || b.resourceId;
            } else if (sortBy === "description") {
              aValue = getMetadataString(a.metadata, "description") || "";
              bValue = getMetadataString(b.metadata, "description") || "";
            } else {
              aValue = a.metadata.mtime;
              bValue = b.metadata.mtime;
            }

            if (sortOrder === "desc") {
              return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            } else {
              return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }
          });
        }

        // Apply pagination
        const totalCount = filteredFiles.length;
        const totalPages = Math.ceil(totalCount / pageSize);
        const hasNextPage = offset + pageSize < totalCount;
        const hasPreviousPage = page > 1;
        const items = filteredFiles.slice(offset, offset + pageSize);

        return {
          items: items.map(({ resourceId, metadata }) => {
            // Construct Resources 2.0 URI
            const uri = constructResourceUri(
              env.DECO_REQUEST_CONTEXT.integrationId as string,
              resourceName,
              resourceId,
            );

            // Extract title and description from metadata, with fallbacks
            const name = getMetadataString(metadata, "name") || resourceId;
            const description =
              getMetadataString(metadata, "description") || "";

            return {
              uri,
              data: { name, description },
              created_at:
                "ctime" in metadata && typeof metadata.ctime === "number"
                  ? new Date(metadata.ctime).toISOString()
                  : undefined,
              updated_at:
                "mtime" in metadata && typeof metadata.mtime === "number"
                  ? new Date(metadata.mtime).toISOString()
                  : undefined,
              created_by: getMetadataString(metadata, "createdBy"),
              updated_by:
                getMetadataString(metadata, "updatedBy") ||
                getMetadataString(metadata, "createdBy"),
            };
          }),
          totalCount,
          page,
          pageSize,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        };
      },
    },

    // deco_resource_read
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_READ` as keyof typeof enhancements
        ]?.description ||
        `Read a ${resourceName} resource from the DECONFIG directory ${directory}`,
      handler: async ({ uri }) => {
        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        try {
          const fileData = await deconfig.READ_FILE({
            path: filePath,
            format: "plainString",
          });

          const content = fileData.content as string;

          // Parse the JSON content
          let parsedData: Record<string, unknown> = {};
          try {
            parsedData = JSON.parse(content);
          } catch {
            throw new UserInputError("Invalid JSON content in resource file");
          }

          // Validate against schema
          const validatedData = dataSchema.parse(parsedData);

          return {
            uri,
            data: validatedData,
            created_at: new Date(fileData.ctime).toISOString(),
            updated_at: new Date(fileData.mtime).toISOString(),
            created_by:
              parsedData &&
              "created_by" in parsedData &&
              typeof parsedData.created_by === "string"
                ? parsedData.created_by
                : undefined,
            updated_by:
              parsedData &&
              "updated_by" in parsedData &&
              typeof parsedData.updated_by === "string"
                ? parsedData.updated_by
                : undefined,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            throw new NotFoundError(`Resource not found: ${uri}`);
          }
          throw error;
        }
      },
    },

    // deco_resource_create (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_CREATE` as keyof typeof enhancements
        ]?.description ||
        `Create a new ${resourceName} resource in the DECONFIG directory ${directory}`,
      handler: async ({ data }) => {
        // Validate data against schema
        const validatedData = dataSchema.parse(data);

        // Run semantic validation if provided
        if (semanticValidate) {
          await semanticValidate(validatedData);
        }

        // Extract resource ID from name or generate one
        const resourceId =
          (validatedData.name as string)?.replace(/[^a-zA-Z0-9-_]/g, "-") ||
          crypto.randomUUID();
        const uri = constructResourceUri(
          env.DECO_REQUEST_CONTEXT.integrationId as string,
          resourceName,
          resourceId,
        );
        const filePath = buildFilePath(directory, resourceId);

        const user = env.DECO_REQUEST_CONTEXT.ensureAuthenticated();
        // Prepare resource data with metadata
        const resourceData = {
          ...validatedData,
          id: resourceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: user?.id ? String(user.id) : undefined,
          updated_by: user?.id ? String(user.id) : undefined,
        };

        const fileContent = JSON.stringify(resourceData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: resourceName,
            resourceId,
            createdBy: user?.id,
            name: validatedData.name || resourceId,
            description: validatedData.description || "",
          },
        });

        return {
          uri,
          data: validatedData,
          created_at: resourceData.created_at,
          updated_at: resourceData.updated_at,
          created_by: user?.id ? String(user.id) : undefined,
          updated_by: user?.id ? String(user.id) : undefined,
        };
      },
    },

    // deco_resource_update (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_UPDATE` as keyof typeof enhancements
        ]?.description ||
        `Update a ${resourceName} resource in the DECONFIG directory ${directory}`,
      handler: async ({ uri, data }) => {
        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        // Read existing file to get current data
        let existingData: Record<string, unknown> = {};
        try {
          const fileData = await deconfig.READ_FILE({
            path: filePath,
            format: "plainString",
          });
          existingData = JSON.parse(fileData.content as string);
        } catch {
          throw new NotFoundError(`Resource not found: ${uri}`);
        }

        // Validate new data against schema
        const validatedData = dataSchema.parse(data);

        // Run semantic validation if provided
        if (semanticValidate) {
          await semanticValidate(validatedData);
        }

        const user = env.DECO_REQUEST_CONTEXT.ensureAuthenticated();

        // Merge existing data with updates
        const updatedData = {
          ...existingData,
          ...validatedData,
          id: resourceId,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ? String(user.id) : undefined,
        };

        const fileContent = JSON.stringify(updatedData, null, 2);

        await deconfig.PUT_FILE({
          path: filePath,
          content: fileContent,
          metadata: {
            resourceType: resourceName,
            resourceId,
            updatedBy: user?.id,
            name: validatedData.name || resourceId,
            description: validatedData.description || "",
          },
        });

        return {
          uri,
          data: validatedData,
          created_at: existingData.created_at as string,
          updated_at: updatedData.updated_at,
          created_by: existingData.created_by as string,
          updated_by: user?.id ? String(user.id) : undefined,
        };
      },
    },

    // deco_resource_delete (optional)
    {
      description:
        enhancements?.[
          `DECO_RESOURCE_${resourceName.toUpperCase()}_DELETE` as keyof typeof enhancements
        ]?.description ||
        `Delete a ${resourceName} resource from the DECONFIG directory ${directory}`,
      handler: async ({ uri }) => {
        // Validate URI format
        ResourceUriSchema.parse(uri);

        const resourceId = extractResourceId(uri);
        const filePath = buildFilePath(directory, resourceId);

        try {
          await deconfig.DELETE_FILE({
            path: filePath,
          });

          return {
            success: true,
            uri,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("not found")) {
            throw new NotFoundError(`Resource not found: ${uri}`);
          }
          throw error;
        }
      },
    },
  ]);

  return tools;
};
